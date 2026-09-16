import React, { useState } from 'react';
import {
  FolderKanban,
  Clock,
  Cpu,
  DollarSign,
  Zap,
  Award,
  Plus,
  ArrowRight,
  Sparkles,
  Info,
  Layers,
} from 'lucide-react';
import {
  MOCK_METRIC_CARDS,
  MOCK_CAMPAIGNS,
  MOCK_IMAGE_ASSETS,
  MOCK_TEXT_CONTENTS,
  MOCK_ACTIVITIES,
} from '../../mock/uiPresentationData';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { CampaignCard } from '../cards/CampaignCard';
import { ImageAssetCard } from '../cards/ImageAssetCard';
import { TextContentCard } from '../cards/TextContentCard';
import { ActivityItem } from '../cards/ActivityItem';
import { Modal } from '../ui/Modal';
import { NavigationId, PresentationImageAsset } from '../../types/ui';

export interface DashboardViewProps {
  onNavigate: (tabId: NavigationId) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const [selectedAsset, setSelectedAsset] = useState<PresentationImageAsset | null>(null);

  const getMetricIcon = (name: string) => {
    switch (name) {
      case 'FolderKanban':
        return <FolderKanban className="w-5 h-5 text-blue-600" />;
      case 'Clock':
        return <Clock className="w-5 h-5 text-amber-600" />;
      case 'Cpu':
        return <Cpu className="w-5 h-5 text-blue-600" />;
      case 'DollarSign':
        return <DollarSign className="w-5 h-5 text-emerald-600" />;
      case 'Zap':
        return <Zap className="w-5 h-5 text-blue-600" />;
      case 'Award':
        return <Award className="w-5 h-5 text-blue-600" />;
      default:
        return <Sparkles className="w-5 h-5 text-blue-600" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Notice Banner */}
      <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-slate-700">
          <span className="font-semibold text-blue-900">
            Plataforma Enterprise de IA Creativa:
          </span>{' '}
          Entorno operativo activo con diseño profesional, control de calidad editorial humano (Human-in-the-Loop) y trazabilidad completa de costos y auditoría.
        </div>
      </div>

      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Panel de Operaciones Creativas
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Supervisión en tiempo real de campañas, generaciones con IA y cola de aprobaciones.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Sparkles className="w-3.5 h-3.5 text-blue-600" />}
            onClick={() => onNavigate('generate-image')}
          >
            Generar imagen
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => onNavigate('campaigns')}
          >
            Nueva campaña
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {MOCK_METRIC_CARDS.map((metric) => (
          <Card key={metric.id} variant="default" padding="sm" className="flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-medium text-slate-500 truncate">
                {metric.title}
              </span>
              <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200">
                {getMetricIcon(metric.iconName)}
              </div>
            </div>

            <div className="mt-1">
              <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {metric.value}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                <span
                  className={
                    metric.isPositive
                      ? 'text-emerald-700 font-medium'
                      : 'text-amber-700 font-medium'
                  }
                >
                  {metric.change}
                </span>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 mt-2.5 pt-2 border-t border-slate-200 truncate">
              {metric.caption}
            </p>
          </Card>
        ))}
      </div>

      {/* Main Grid: Active Campaigns & Visual Assets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Campaigns & Visual Gallery Preview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Campaigns */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                  Campañas en curso
                </h3>
              </div>
              <button
                onClick={() => onNavigate('campaigns')}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer"
              >
                Ver todas <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {MOCK_CAMPAIGNS.map((camp) => (
                <CampaignCard
                  key={camp.id}
                  campaign={camp}
                  onSelect={() => onNavigate('campaigns')}
                />
              ))}
            </div>
          </div>

          {/* Visual Assets Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                  Recursos visuales recientes
                </h3>
              </div>
              <button
                onClick={() => onNavigate('gallery')}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer"
              >
                Abrir galería <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {MOCK_IMAGE_ASSETS.map((asset) => (
                <ImageAssetCard
                  key={asset.id}
                  asset={asset}
                  onPreview={(a) => setSelectedAsset(a)}
                  onSubmitApproval={() => onNavigate('approvals')}
                />
              ))}
            </div>
          </div>

          {/* Text Content Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                  Redacciones y contenido asistido por IA
                </h3>
              </div>
              <button
                onClick={() => onNavigate('create-content')}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer"
              >
                Abrir editor <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {MOCK_TEXT_CONTENTS.map((txt) => (
                <TextContentCard
                  key={txt.id}
                  content={txt}
                  onOpenEditor={() => onNavigate('create-content')}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Recent Activities & Governance */}
        <div className="space-y-6">
          <Card variant="default" padding="md">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">
                Actividades del equipo
              </h3>
              <span className="text-[10px] font-mono text-slate-600 px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                TIEMPO REAL
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {MOCK_ACTIVITIES.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center text-xs text-slate-600 hover:text-slate-900"
                onClick={() => onNavigate('history')}
              >
                Ver registro de auditoría completo
              </Button>
            </div>
          </Card>

          {/* Quality & Human-in-the-loop reminder */}
          <Card variant="outline" padding="md" className="bg-slate-50 border-slate-200">
            <div className="flex items-center gap-2 text-blue-700 text-xs font-semibold uppercase tracking-wider">
              <Award className="w-4 h-4" />
              <span>Supervisión humana (Human-in-the-Loop)</span>
            </div>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Todas las piezas visuales y textuales generadas con asistencia de IA pasan obligatoriamente por revisión editorial y aprobación antes de su publicación.
            </p>
          </Card>
        </div>
      </div>

      {/* Asset Preview Modal */}
      {selectedAsset && (
        <Modal
          isOpen={Boolean(selectedAsset)}
          onClose={() => setSelectedAsset(null)}
          title={selectedAsset.title}
          description={`Campaña: ${selectedAsset.campaignName} • Creado por ${selectedAsset.creatorName}`}
          maxWidth="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-slate-500 font-mono">
                Estilo: {selectedAsset.style} ({selectedAsset.aspectRatio})
              </span>
              <Button size="sm" variant="outline" onClick={() => setSelectedAsset(null)}>
                Cerrar
              </Button>
            </div>
          }
        >
          <div className="rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
            <img
              src={selectedAsset.thumbnailUrl}
              alt={selectedAsset.title}
              className="w-full h-auto max-h-[60vh] object-contain mx-auto"
              referrerPolicy="no-referrer"
            />
          </div>
        </Modal>
      )}
    </div>
  );
};
