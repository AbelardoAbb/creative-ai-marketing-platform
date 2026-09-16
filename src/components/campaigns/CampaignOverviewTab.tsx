/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Sparkles,
  Layers,
  FileText,
  Users,
  Clock,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { CampaignModel, CampaignStatus, CampaignMemberModel } from '../../types/campaign';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export interface CampaignOverviewTabProps {
  campaign: CampaignModel;
  members: CampaignMemberModel[];
  canEdit: boolean;
  onStatusChange: (newStatus: CampaignStatus) => Promise<{ success: boolean; error?: string }>;
  onNavigateToTab: (tabId: string) => void;
}

const STATUS_TRANSITION_MAP: Record<CampaignStatus, { next: CampaignStatus; label: string }[]> = {
  draft: [
    { next: 'active', label: 'Publicar y activar campaña' },
    { next: 'archived', label: 'Archivar borrador' },
  ],
  active: [
    { next: 'in_review', label: 'Enviar a revisión y gobernanza' },
    { next: 'completed', label: 'Concluir campaña' },
    { next: 'archived', label: 'Archivar' },
  ],
  in_review: [
    { next: 'active', label: 'Devolver a producción activa' },
    { next: 'completed', label: 'Aprobar y concluir' },
    { next: 'archived', label: 'Archivar' },
  ],
  completed: [{ next: 'archived', label: 'Mover al archivo' }],
  archived: [{ next: 'draft', label: 'Restaurar a borrador' }],
};

export const CampaignOverviewTab: React.FC<CampaignOverviewTabProps> = ({
  campaign,
  members,
  canEdit,
  onStatusChange,
  onNavigateToTab,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTransition = async (nextStatus: CampaignStatus) => {
    setError(null);
    setLoading(true);
    try {
      const res = await onStatusChange(nextStatus);
      if (!res.success) {
        setError(res.error || 'Fallo al actualizar el estado de la campaña.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fallo en la transición de estado.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: CampaignStatus) => {
    switch (status) {
      case 'active':
        return 'Activa';
      case 'in_review':
        return 'En revisión';
      case 'completed':
        return 'Completada';
      case 'archived':
        return 'Archivada';
      case 'draft':
      default:
        return 'Borrador';
    }
  };

  const allowedNextStatuses = STATUS_TRANSITION_MAP[campaign.status] || [];

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-red-700 text-xs sm:text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Estado del Ciclo de Vida</span>
            <div className="w-2 h-2 rounded-full bg-blue-600" />
          </div>
          <p className="text-lg font-semibold text-slate-900 mt-2">
            {getStatusLabel(campaign.status)}
          </p>
          <span className="text-[11px] text-slate-500 block mt-1">
            {campaign.status === 'draft' && 'Lista para configuración del briefing'}
            {campaign.status === 'active' && 'En producción creativa y generación de assets'}
            {campaign.status === 'in_review' && 'En espera de validación de gobernanza'}
            {campaign.status === 'completed' && 'Entregables validados con éxito'}
            {campaign.status === 'archived' && 'Campaña archivada'}
          </span>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Equipo Asignado</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-lg font-semibold text-slate-900 mt-2">{members.length} miembros</p>
          <span className="text-[11px] text-slate-500 block mt-1">
            Aislamiento de RLS activo por campaña
          </span>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Canales de Distribución</span>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-lg font-semibold text-slate-900 mt-2">
            {campaign.channels?.length || 0} canales
          </p>
          <span className="text-[11px] text-slate-500 block mt-1">
            {campaign.channels?.slice(0, 2).join(', ') || 'Ningún canal activo'}
          </span>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Preparación para IA</span>
            <Sparkles className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-lg font-semibold text-slate-900 mt-2">
            {campaign.campaign_objective && campaign.visual_direction ? '100%' : '80%'}
          </p>
          <span className="text-[11px] text-slate-500 block mt-1">
            Contexto listo para Claude y SD
          </span>
        </Card>
      </div>

      {/* Main Overview Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Briefing Quickview & Callouts (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
                Resumen Ejecutivo del Briefing
              </span>
              <button
                type="button"
                onClick={() => onNavigateToTab('briefing')}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer"
              >
                Ver completo <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">
              {campaign.campaign_objective || 'Ningún objetivo especificado.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
              <div>
                <span className="text-[11px] text-slate-500 block">Público Objetivo</span>
                <span className="text-xs text-slate-800 font-medium block mt-0.5">
                  {campaign.target_audience || 'No especificado'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Tono de Voz</span>
                <span className="text-xs text-slate-800 font-medium block mt-0.5">
                  {campaign.tone_of_voice || 'Profesional y Persuasivo'}
                </span>
              </div>
            </div>
          </Card>

          {/* Phase 6 Workspace Status Callout */}
          <Card padding="md" className="bg-slate-50 border-slate-200 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-900">
                  Espacio de Trabajo Conectado a la Cadena Creativa
                </h4>
                <p className="text-[11px] text-slate-500">
                  Las fases de generación (Claude en redacción y Stability en imágenes) consumen
                  automáticamente estos metadatos.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => onNavigateToTab('content')}
                className="p-2.5 rounded-lg bg-white border border-slate-200 hover:border-blue-300 flex items-center justify-between text-left transition-colors cursor-pointer shadow-2xs"
              >
                <div>
                  <span className="text-xs text-slate-900 font-medium block">Editor de Contenido (Claude)</span>
                  <span className="text-[10px] text-slate-500">Copywriting y transformaciones</span>
                </div>
                <Badge variant="blue" size="sm">
                  Activo
                </Badge>
              </button>
              <button
                type="button"
                onClick={() => onNavigateToTab('studio')}
                className="p-2.5 rounded-lg bg-white border border-slate-200 hover:border-blue-300 flex items-center justify-between text-left transition-colors cursor-pointer shadow-2xs"
              >
                <div>
                  <span className="text-xs text-slate-900 font-medium block">Estudio de Imagen (IA)</span>
                  <span className="text-[10px] text-slate-500">Generación y moderación visual</span>
                </div>
                <Badge variant="info" size="sm">
                  Activo
                </Badge>
              </button>
            </div>
          </Card>
        </div>

        {/* Right Column: Workflow Control & Lifecycle */}
        <div className="space-y-6">
          <Card padding="md" className="space-y-4">
            <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider block">
              Control de Ciclo de Vida
            </span>

            {canEdit && allowedNextStatuses.length > 0 ? (
              <div className="space-y-2.5">
                <p className="text-xs text-slate-500">
                  Haga avanzar la campaña según el progreso del equipo creativo:
                </p>
                {allowedNextStatuses.map((item) => (
                  <Button
                    key={item.next}
                    variant={item.next === 'active' ? 'primary' : 'outline'}
                    size="sm"
                    className="w-full justify-start text-xs"
                    disabled={loading}
                    onClick={() => handleTransition(item.next)}
                  >
                    <ChevronRight className="w-3.5 h-3.5 mr-1" />
                    {item.label}
                  </Button>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-slate-50 text-xs text-slate-500 flex items-center gap-2 border border-slate-200">
                <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Ninguna transición de estado autorizada para su perfil en este momento.</span>
              </div>
            )}
          </Card>

          <Card padding="md" className="space-y-3">
            <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider block">
              Auditoría de Creación
            </span>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Creado el:</span>
                <span className="text-slate-800 font-medium">
                  {new Date(campaign.created_at).toLocaleDateString('es-ES')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Última actualización:</span>
                <span className="text-slate-800 font-medium">
                  {new Date(campaign.updated_at).toLocaleDateString('es-ES')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ID de la Campaña:</span>
                <span className="font-mono text-[11px] text-blue-700">
                  {campaign.id.substring(0, 16)}...
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
