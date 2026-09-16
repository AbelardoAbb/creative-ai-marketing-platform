/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FolderKanban,
  Search,
  Filter,
  Plus,
  Users,
  Calendar,
  Layers,
  ChevronRight,
  Sparkles,
  Building2,
  Lock,
} from 'lucide-react';
import { CampaignModel, CampaignStatus } from '../../types/campaign';
import { UserRole } from '../../types/auth';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { EmptyState } from '../ui/EmptyState';

export interface CampaignListViewProps {
  campaigns: CampaignModel[];
  currentUser: { id: string; role: UserRole; email?: string } | null;
  onSelectCampaign: (campaign: CampaignModel) => void;
  onCreateClick: () => void;
  canCreate: boolean;
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'draft', label: 'Borrador' },
  { value: 'active', label: 'Activa' },
  { value: 'in_review', label: 'En revisión' },
  { value: 'completed', label: 'Completada' },
  { value: 'archived', label: 'Archivada' },
];

export const CampaignListView: React.FC<CampaignListViewProps> = ({
  campaigns,
  currentUser,
  onSelectCampaign,
  onCreateClick,
  canCreate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredCampaigns = campaigns.filter((camp) => {
    const matchesSearch =
      camp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (camp.client && camp.client.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (camp.campaign_objective &&
        camp.campaign_objective.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || camp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadgeVariant = (status: CampaignStatus) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'in_review':
        return 'warning';
      case 'completed':
        return 'blue';
      case 'archived':
        return 'neutral';
      case 'draft':
      default:
        return 'info';
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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Gestión de Campañas y Briefings
            </h1>
            <Badge variant="blue" size="sm">
              Fase 6
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Espacio centralizado para gestionar briefings e impulsar las cadenas de generación de IA con contexto comercial.
          </p>
        </div>

        {canCreate ? (
          <Button
            variant="primary"
            size="sm"
            onClick={onCreateClick}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Nueva Campaña
          </Button>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Creación reservada a Diseñadores y Administradores</span>
          </div>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, cliente u objetivo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-colors"
          />
        </div>

        <div className="w-full sm:w-56">
          <Select
            options={STATUS_FILTERS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Campaigns Grid */}
      {filteredCampaigns.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Ninguna campaña encontrada"
          description={
            searchQuery || statusFilter !== 'all'
              ? 'Intente ajustar los filtros o términos de su búsqueda.'
              : 'Comience creando la primera campaña y configurando el briefing creativo.'
          }
          actionLabel={canCreate && !searchQuery && statusFilter === 'all' ? 'Crear Primera Campaña' : undefined}
          onAction={canCreate ? onCreateClick : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCampaigns.map((camp) => {
            return (
              <div
                key={camp.id}
                onClick={() => onSelectCampaign(camp)}
                className="group relative flex flex-col justify-between p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer shadow-sm"
              >
                <div>
                  {/* Top Tags & Status */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider truncate">
                      {camp.client || 'Cliente General'}
                    </span>
                    <Badge variant={getStatusBadgeVariant(camp.status)} size="sm">
                      {getStatusLabel(camp.status)}
                    </Badge>
                  </div>

                  {/* Title & Product */}
                  <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-700 transition-colors line-clamp-1">
                    {camp.name}
                  </h3>
                  {camp.product_or_service && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                      {camp.product_or_service}
                    </p>
                  )}

                  {/* Objective Snip */}
                  <p className="text-xs text-slate-600 mt-3 line-clamp-2 leading-relaxed">
                    {camp.campaign_objective || 'Sin descripción de objetivo definida.'}
                  </p>
                </div>

                {/* Bottom Metadata & CTA */}
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{new Date(camp.created_at).toLocaleDateString('es-ES')}</span>
                  </div>

                  <div className="flex items-center gap-1 font-medium text-blue-600 group-hover:text-blue-700 transition-colors">
                    <span>Acceder al Workspace</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
