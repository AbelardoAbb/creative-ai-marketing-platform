/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sparkles, AlertCircle, X, Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { CreateCampaignPayload } from '../../types/campaign';

export interface CampaignCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateCampaignPayload) => Promise<{ success: boolean; error?: string }>;
}

const CHANNEL_OPTIONS = [
  'Instagram',
  'LinkedIn',
  'TikTok',
  'YouTube',
  'Google Ads',
  'Facebook',
  'Twitter / X',
  'Email Marketing',
  'Medios Exteriores (OOH)',
  'Portal de Noticias',
];

const TONE_OPTIONS = [
  { value: 'Profesional y Persuasivo', label: 'Profesional y Persuasivo (Estándar B2B)' },
  { value: 'Inspirador y Cercano', label: 'Inspirador y Cercano (Lifestyle y Bienestar)' },
  { value: 'Enérgico y Dinámico', label: 'Enérgico y Dinámico (Retail y Tecnología)' },
  { value: 'Técnico y Confiable', label: 'Técnico y Confiable (Finanzas e Infraestructura)' },
  { value: 'Desenfadado y Juvenil', label: 'Desenfadado y Juvenil (Generación Z)' },
  { value: 'Sofisticado y Exclusivo', label: 'Sofisticado y Exclusivo (Premium y Lujo)' },
];

export const CampaignCreateModal: React.FC<CampaignCreateModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [productOrService, setProductOrService] = useState('');
  const [objective, setObjective] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [keyMessage, setKeyMessage] = useState('');
  const [toneOfVoice, setToneOfVoice] = useState('Profesional y Persuasivo');
  const [language, setLanguage] = useState('es-ES');
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['Instagram', 'LinkedIn']);
  const [visualDirection, setVisualDirection] = useState('');
  const [creativeConstraints, setCreativeConstraints] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleChannel = (channel: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre de la campaña es obligatorio.');
      return;
    }
    if (!objective.trim()) {
      setError('El objetivo principal de la campaña es obligatorio.');
      return;
    }

    setLoading(true);
    try {
      const payload: CreateCampaignPayload = {
        name: name.trim(),
        client: client.trim() || 'General',
        product_or_service: productOrService.trim() || undefined,
        campaign_objective: objective.trim(),
        target_audience: targetAudience.trim() || undefined,
        key_message: keyMessage.trim() || undefined,
        tone_of_voice: toneOfVoice,
        language: language.trim() || 'es-ES',
        channels: selectedChannels.length > 0 ? selectedChannels : ['Instagram', 'LinkedIn'],
        visual_direction: visualDirection.trim() || undefined,
        creative_constraints: creativeConstraints.trim() || undefined,
      };

      const result = await onSubmit(payload);
      if (result.success) {
        onClose();
      } else {
        setError(result.error || 'Error al crear la campaña.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear la campaña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl my-8 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-100 text-blue-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Nueva Campaña y Briefing</h3>
              <p className="text-xs text-slate-500">
                Configure los metadatos y directrices creativas que impulsarán la generación de IA.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Scrollable Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-red-700 text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Identificación & Cliente */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              1. Identificación de la Campaña
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nombre de la Campaña *"
                placeholder="Ej: Primavera Sostenible 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                label="Cliente / Marca *"
                placeholder="Ej: EcoVibe Cosméticos"
                value={client}
                onChange={(e) => setClient(e.target.value)}
              />
            </div>
            <Input
              label="Producto o Servicio en Foco"
              placeholder="Ej: Línea Bio-Active Skincare Hidratante"
              value={productOrService}
              onChange={(e) => setProductOrService(e.target.value)}
            />
          </div>

          {/* Section 2: Estrategia & Briefing */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              2. Estrategia y Objetivos de Negocio
            </h4>
            <Textarea
              label="Objetivo Principal de la Campaña *"
              placeholder="Ej: Generar 15.000 registros para lista de espera y posicionar la marca como pionera en envases compostables."
              rows={3}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Textarea
                label="Público Objetivo y Demografía"
                placeholder="Ej: Mujeres y hombres de 22 a 40 años, perfil sostenible y consumidor consciente."
                rows={2}
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
              />
              <Textarea
                label="Mensaje Clave (Key Message)"
                placeholder="Ej: Cuidado genuino de tu piel y respeto absoluto por el planeta."
                rows={2}
                value={keyMessage}
                onChange={(e) => setKeyMessage(e.target.value)}
              />
            </div>
          </div>

          {/* Section 3: Voz, Tom & Canais */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              3. Tono de Voz y Canales de Distribución
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Tono de Voz Primario"
                options={TONE_OPTIONS}
                value={toneOfVoice}
                onChange={(e) => setToneOfVoice(e.target.value)}
              />
              <Input
                label="Idioma Principal"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="es-ES"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 block mb-2">
                Canales de Activación
              </label>
              <div className="flex flex-wrap gap-2">
                {CHANNEL_OPTIONS.map((ch) => {
                  const isSelected = selectedChannels.includes(ch);
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => toggleChannel(ch)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-blue-600" />}
                      {ch}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 4: Diretrizes Criativas & Restrições (Future AI Context) */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              4. Directrices Visuales y Restricciones de Marca
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Textarea
                label="Dirección Visual y Estilo"
                placeholder="Ej: Fotografía con luz solar natural matutina, tonos botánicos, acabado mate y sin brillos artificiales."
                rows={2}
                value={visualDirection}
                onChange={(e) => setVisualDirection(e.target.value)}
              />
              <Textarea
                label="Restricciones Creativas (Negative Constraints)"
                placeholder="Ej: No utilizar animales en cautiverio, no incluir envases plásticos en las escenas. Destacar certificación orgánica."
                rows={2}
                value={creativeConstraints}
                onChange={(e) => setCreativeConstraints(e.target.value)}
              />
            </div>
          </div>

          {/* Footer Action Bar */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={loading}
              leftIcon={<Sparkles className="w-4 h-4" />}
            >
              Crear Campaña y Briefing
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
