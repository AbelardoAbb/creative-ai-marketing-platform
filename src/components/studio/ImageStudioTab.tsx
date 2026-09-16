/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Layers,
  Wand2,
  AlertTriangle,
  ShieldCheck,
  Building2,
  Info,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import {
  ImageAssetModel,
  SupportedImageStyle,
  SupportedAspectRatio,
  ModerationResult,
} from '../../types/imageAsset';
import { CampaignModel } from '../../types/campaign';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { ImageAssetCard } from './ImageAssetCard';

export interface ImageStudioTabProps {
  campaign: CampaignModel;
  onAssetGenerated?: (asset: ImageAssetModel) => void;
}

export const ImageStudioTab: React.FC<ImageStudioTabProps> = ({
  campaign,
  onAssetGenerated,
}) => {
  const { user, session } = useAuth();

  // Generator form states
  const [userPrompt, setUserPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<SupportedImageStyle>('Advertising');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<SupportedAspectRatio>('1:1');
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [allowFallback, setAllowFallback] = useState(true);

  // Status and results
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [moderationWarning, setModerationWarning] = useState<ModerationResult | null>(null);
  const [lastGeneratedAsset, setLastGeneratedAsset] = useState<ImageAssetModel | null>(null);
  const [campaignAssets, setCampaignAssets] = useState<ImageAssetModel[]>([]);
  const [providerStatus, setProviderStatus] = useState<{
    status: 'READY' | 'BLOCKED';
    message: string;
    provider: string;
    supportedModel: string;
  } | null>(null);

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-id': user?.id || 'anonymous',
      'x-user-role': user?.role || 'Designer',
      'x-user-email': user?.email || '',
      'x-user-name': user?.displayName || '',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  };

  // Check provider status & load campaign assets
  const fetchProviderStatus = async () => {
    try {
      const res = await fetch('/api/assets/provider-status', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setProviderStatus(data);
      }
    } catch {
      // Ignore initial network probe
    }
  };

  const fetchCampaignAssets = async () => {
    try {
      const res = await fetch(`/api/assets?campaignId=${campaign.id}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setCampaignAssets(data.assets || []);
      }
    } catch {
      // Handled gracefully
    }
  };

  useEffect(() => {
    fetchProviderStatus();
    fetchCampaignAssets();
  }, [campaign.id]);

  // Pre-fill prompt suggestion based on campaign briefing
  const handleInsertBriefingSuggestion = () => {
    const suggestion = `Composición visual premium para ${campaign.product_or_service || campaign.name}. ${
      campaign.visual_direction ? `Dirección de arte: ${campaign.visual_direction}. ` : ''
    }Público objetivo: ${campaign.target_audience || 'General'}. Iluminación natural refinada.`;
    setUserPrompt(suggestion);
  };

  // Submit Image Generation
  const handleGenerateImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPrompt.trim()) return;

    setIsGenerating(true);
    setErrorMessage(null);
    setModerationWarning(null);

    try {
      const res = await fetch('/api/assets/generate', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          campaignId: campaign.id,
          userPrompt: userPrompt.trim(),
          negativePrompt: negativePrompt.trim() || undefined,
          style: selectedStyle,
          aspectRatio: selectedAspectRatio,
          additionalInstructions: additionalInstructions.trim() || undefined,
          allowFallback,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.statusCode === 'MODERATION_BLOCKED') {
          setModerationWarning(data.moderation);
          setErrorMessage(data.message || 'Prompt bloqueado por moderación de seguridad.');
        } else {
          setErrorMessage(data.message || 'Error durante la generación de imagen.');
        }
        return;
      }

      if (data.asset) {
        setLastGeneratedAsset(data.asset);
        setCampaignAssets((prev) => [data.asset, ...prev]);
        if (onAssetGenerated) {
          onAssetGenerated(data.asset);
        }
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error en la conexión con el servidor.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Human Evaluation callback
  const handleEvaluateAsset = async (assetId: string, rating: number, feedback: string) => {
    const res = await fetch(`/api/assets/${assetId}/evaluate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ rating, feedback }),
    });

    if (res.ok) {
      const data = await res.json();
      setCampaignAssets((prev) =>
        prev.map((a) => (a.id === assetId ? data.asset : a))
      );
      if (lastGeneratedAsset?.id === assetId) {
        setLastGeneratedAsset(data.asset);
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Briefing Context Header */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Estudio de Creación Visual Contextualizado
            </h3>
            <Badge variant="blue" size="sm">Fase 7</Badge>
          </div>
          <p className="text-xs text-slate-500">
            La IA consume el briefing de <span className="text-slate-800 font-semibold">{campaign.name}</span> ({campaign.client}) para guiar estilo y coherencia visual.
          </p>
        </div>

        {/* Provider Status Pill */}
        <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
          <div className="text-xs">
            <span className="text-slate-500 font-medium">Proveedor: </span>
            <span className="font-semibold text-slate-900">Stability AI (SD3.5 Core)</span>
          </div>
        </div>
      </div>

      {/* Main Studio Grid: Left Form, Right Active Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Contextual Prompt Studio */}
        <div className="lg:col-span-6 space-y-6">
          <Card variant="default" padding="lg" className="bg-white border-slate-200 shadow-sm">
            <form onSubmit={handleGenerateImage} className="space-y-4">
              {/* Campaign Context Helper Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1.5 font-semibold text-blue-700">
                    <Building2 className="w-3.5 h-3.5" />
                    Briefing Activo
                  </span>
                  <button
                    type="button"
                    onClick={handleInsertBriefingSuggestion}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Wand2 className="w-3 h-3" />
                    Usar sugerencia del briefing
                  </button>
                </div>
                <p className="text-xs text-slate-700">
                  <span className="text-slate-500">Dirección Visual: </span>
                  {campaign.visual_direction || 'Dirección libre conforme a la estética corporativa'}
                </p>
                {campaign.creative_constraints && (
                  <p className="text-[11px] text-amber-700">
                    <span className="text-slate-500">Restricciones Creativas: </span>
                    {campaign.creative_constraints}
                  </p>
                )}
              </div>

              {/* User Prompt Textarea */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-800">
                  Concepto Visual / Prompt Principal <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="Describa el elemento central, acción, iluminación y composición deseada..."
                  rows={4}
                  required
                />
              </div>

              {/* Style and Aspect Ratio Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-800">
                    Estilo Artístico
                  </label>
                  <Select
                    value={selectedStyle}
                    onChange={(e) => setSelectedStyle(e.target.value as SupportedImageStyle)}
                    options={[
                      { value: 'Advertising', label: 'Advertising (Publicitario)' },
                      { value: 'Photorealistic', label: 'Photorealistic (Estudio / 35mm)' },
                      { value: 'Editorial', label: 'Editorial (High-Fashion)' },
                      { value: 'Cinematic', label: 'Cinematic (Anamórfico)' },
                      { value: 'Minimalist', label: 'Minimalist (Minimalista)' },
                      { value: 'Anime', label: 'Anime (Ilustración Digital)' },
                      { value: 'Oil Painting', label: 'Oil Painting (Óleo sobre Lienzo)' },
                    ]}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-800">
                    Proporción de Pantalla
                  </label>
                  <Select
                    value={selectedAspectRatio}
                    onChange={(e) => setSelectedAspectRatio(e.target.value as SupportedAspectRatio)}
                    options={[
                      { value: '1:1', label: '1:1 (Cuadrado • 1024x1024)' },
                      { value: '16:9', label: '16:9 (Horizontal / Banner • 1344x768)' },
                      { value: '9:16', label: '9:16 (Stories / Reels • 768x1344)' },
                      { value: '4:3', label: '4:3 (Medio Estándar • 1152x864)' },
                      { value: '3:2', label: '3:2 (Fotografía Clásica • 1216x832)' },
                    ]}
                  />
                </div>
              </div>

              {/* Negative Prompt (Optional) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-800">
                  Prompt Negativo (Lo que se desea excluir)
                </label>
                <Input
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="Ej: brillos plásticos, ruido, saturación excesiva..."
                />
              </div>

              {/* Fallback & Safeguard Toggle */}
              <div className="pt-2 flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="space-y-0.5">
                  <span className="text-xs font-medium text-slate-800">Proveedor de Contingencia</span>
                  <p className="text-[11px] text-slate-500">
                    Si Stability AI no está disponible o sin créditos, genera un activo prototipo auditado.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={allowFallback}
                  onChange={(e) => setAllowFallback(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 bg-white"
                />
              </div>

              {/* Error / Moderation Warning Box */}
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Error en la Generación:</span>
                    <span>{errorMessage}</span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full justify-center"
                isLoading={isGenerating}
                leftIcon={<Sparkles className="w-4 h-4" />}
                disabled={!userPrompt.trim() || isGenerating}
              >
                {isGenerating ? 'Procesando Inferencia Visual...' : 'Generar Imagen con IA'}
              </Button>
            </form>
          </Card>
        </div>

        {/* Right Column: Latest Result & Real-Time Inspection */}
        <div className="lg:col-span-6 space-y-6">
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Resultado Más Reciente y Evaluación
            </h4>

            {lastGeneratedAsset ? (
              <ImageAssetCard
                asset={lastGeneratedAsset}
                onEvaluate={handleEvaluateAsset}
                canEvaluate={true}
              />
            ) : (
              <div className="h-[420px] rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-8 text-center bg-slate-50">
                <div className="p-4 rounded-2xl bg-white border border-slate-200 text-blue-600 mb-3 shadow-sm">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800">Ninguna imagen generada en esta sesión</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Utilice el estudio contextualizado a la izquierda para iniciar la generación. El briefing será incorporado y los resultados se guardarán en el repositorio de la campaña.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gallery of Existing Campaign Assets */}
      <div className="pt-6 border-t border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              Galería de Activos de la Campaña ({campaignAssets.length})
            </h3>
            <p className="text-xs text-slate-500">
              Activos generados y almacenados en Supabase Storage vinculados a esta campaña.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchCampaignAssets}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Actualizar
          </Button>
        </div>

        {campaignAssets.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaignAssets.map((asset) => (
              <ImageAssetCard
                key={asset.id}
                asset={asset}
                onEvaluate={handleEvaluateAsset}
                canEvaluate={true}
              />
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500 shadow-sm">
            Ningún activo visual generado hasta el momento para esta campaña.
          </div>
        )}
      </div>
    </div>
  );
};
