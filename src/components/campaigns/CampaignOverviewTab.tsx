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
    { next: 'active', label: 'Publicar e ativar campanha' },
    { next: 'archived', label: 'Arquivar rascunho' },
  ],
  active: [
    { next: 'in_review', label: 'Enviar para revisão e governação' },
    { next: 'completed', label: 'Concluir campanha' },
    { next: 'archived', label: 'Arquivar' },
  ],
  in_review: [
    { next: 'active', label: 'Devolver à produção ativa' },
    { next: 'completed', label: 'Aprovar e concluir' },
    { next: 'archived', label: 'Arquivar' },
  ],
  completed: [{ next: 'archived', label: 'Mover para o arquivo' }],
  archived: [{ next: 'draft', label: 'Restaurar para rascunho' }],
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
        setError(res.error || 'Falha ao atualizar o estado da campanha.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha na transição de estado.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: CampaignStatus) => {
    switch (status) {
      case 'active':
        return 'Ativa';
      case 'in_review':
        return 'Em revisão';
      case 'completed':
        return 'Concluída';
      case 'archived':
        return 'Arquivada';
      case 'draft':
      default:
        return 'Rascunho';
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
            <span className="text-xs text-slate-500 font-medium">Estado do Ciclo de Vida</span>
            <div className="w-2 h-2 rounded-full bg-blue-600" />
          </div>
          <p className="text-lg font-semibold text-slate-900 mt-2">
            {getStatusLabel(campaign.status)}
          </p>
          <span className="text-[11px] text-slate-500 block mt-1">
            {campaign.status === 'draft' && 'Pronta para configuração do briefing'}
            {campaign.status === 'active' && 'Em produção criativa e geração de ativos'}
            {campaign.status === 'in_review' && 'A aguardar validação de governação'}
            {campaign.status === 'completed' && 'Entregáveis validados com sucesso'}
            {campaign.status === 'archived' && 'Campanha arquivada'}
          </span>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Equipa Atribuída</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-lg font-semibold text-slate-900 mt-2">{members.length} membros</p>
          <span className="text-[11px] text-slate-500 block mt-1">
            Isolamento de RLS ativo por campanha
          </span>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Canais de Distribuição</span>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-lg font-semibold text-slate-900 mt-2">
            {campaign.channels?.length || 0} canais
          </p>
          <span className="text-[11px] text-slate-500 block mt-1">
            {campaign.channels?.slice(0, 2).join(', ') || 'Nenhum canal ativo'}
          </span>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Preparação para IA</span>
            <Sparkles className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-lg font-semibold text-slate-900 mt-2">
            {campaign.campaign_objective && campaign.visual_direction ? '100%' : '80%'}
          </p>
          <span className="text-[11px] text-slate-500 block mt-1">
            Contexto pronto para Claude e SD
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
                Resumo Executivo do Briefing
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
              {campaign.campaign_objective || 'Nenhum objetivo especificado.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
              <div>
                <span className="text-[11px] text-slate-500 block">Público-Alvo</span>
                <span className="text-xs text-slate-800 font-medium block mt-0.5">
                  {campaign.target_audience || 'Não especificado'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Tom de Voz</span>
                <span className="text-xs text-slate-800 font-medium block mt-0.5">
                  {campaign.tone_of_voice || 'Profissional e Persuasivo'}
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
                  Espaço de Trabalho Ligado à Cadeia Criativa
                </h4>
                <p className="text-[11px] text-slate-500">
                  As fases de geração (Claude em redação e Stability em imagens) consomem
                  automaticamente estes metadados.
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
                  <span className="text-xs text-slate-900 font-medium block">Editor de Conteúdo (Claude)</span>
                  <span className="text-[10px] text-slate-500">Copywriting e transformações</span>
                </div>
                <Badge variant="blue" size="sm">
                  Ativo
                </Badge>
              </button>
              <button
                type="button"
                onClick={() => onNavigateToTab('studio')}
                className="p-2.5 rounded-lg bg-white border border-slate-200 hover:border-blue-300 flex items-center justify-between text-left transition-colors cursor-pointer shadow-2xs"
              >
                <div>
                  <span className="text-xs text-slate-900 font-medium block">Estúdio de Imagem (IA)</span>
                  <span className="text-[10px] text-slate-500">Geração e moderação visual</span>
                </div>
                <Badge variant="info" size="sm">
                  Ativo
                </Badge>
              </button>
            </div>
          </Card>
        </div>

        {/* Right Column: Workflow Control & Lifecycle */}
        <div className="space-y-6">
          <Card padding="md" className="space-y-4">
            <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider block">
              Controlo do Ciclo de Vida
            </span>

            {canEdit && allowedNextStatuses.length > 0 ? (
              <div className="space-y-2.5">
                <p className="text-xs text-slate-500">
                  Avance a campanha conforme o progresso da equipa criativa:
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
                <span>Nenhuma transição de estado autorizada para o seu perfil neste momento.</span>
              </div>
            )}
          </Card>

          <Card padding="md" className="space-y-3">
            <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider block">
              Auditoria de Criação
            </span>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Criado em:</span>
                <span className="text-slate-800 font-medium">
                  {new Date(campaign.created_at).toLocaleDateString('pt-PT')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Última atualização:</span>
                <span className="text-slate-800 font-medium">
                  {new Date(campaign.updated_at).toLocaleDateString('pt-PT')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ID da Campanha:</span>
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
