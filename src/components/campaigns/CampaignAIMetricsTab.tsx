/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  Clock,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { CampaignModel } from '../../types/campaign';
import { useAuth } from '../../contexts/AuthContext';
import { AIOperationalMetrics, ProductivityMetrics } from '../../types/aiAudit';
import { CostSummaryMetrics, ROIFrameworkMetrics } from '../../types/cost';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { LoadingState } from '../ui/LoadingState';

interface CampaignAIMetricsTabProps {
  campaign: CampaignModel;
}

export const CampaignAIMetricsTab: React.FC<CampaignAIMetricsTabProps> = ({ campaign }) => {
  const { user, session } = useAuth();
  const [operational, setOperational] = useState<AIOperationalMetrics | null>(null);
  const [productivity, setProductivity] = useState<ProductivityMetrics | null>(null);
  const [roi, setRoi] = useState<ROIFrameworkMetrics | null>(null);
  const [costs, setCosts] = useState<CostSummaryMetrics | null>(null);
  const [hasFinancialAccess, setHasFinancialAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(() => {
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
  }, [user, session]);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/ai-metrics`, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Erro HTTP ${res.status}`);
      }

      const data = await res.json();
      setOperational(data.operational);
      setProductivity(data.productivity);
      setRoi(data.roi);
      setCosts(data.costs);
      setHasFinancialAccess(data.hasFinancialAccess);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao obter métricas de IA da campanha.');
    } finally {
      setLoading(false);
    }
  }, [campaign.id, getAuthHeaders]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

    if (loading) {
    return <LoadingState message="A carregar métricas de inferência da campanha..." />;
  }

  if (error || !operational) {
    return (
      <div className="p-6 rounded-xl bg-red-50 border border-red-200 text-center space-y-2">
        <AlertTriangle className="w-6 h-6 text-red-600 mx-auto" />
        <h4 className="text-sm font-semibold text-slate-900">Métricas não disponíveis</h4>
        <p className="text-xs text-red-700">{error || 'Não foi possível carregar as métricas.'}</p>
        <Button variant="outline" size="sm" onClick={fetchMetrics}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Métricas de IA e Eficiência da Campanha
          </h3>
          <p className="text-xs text-slate-500">
            Telemetria de execuções associadas exclusivamente a esta campanha
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchMetrics}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Atualizar
        </Button>
      </div>

      {/* Operational Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[11px] text-slate-500 font-medium">Operações de IA</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">
            {operational.totalOperations}
          </div>
          <span className="text-[10px] text-slate-400">Nesta campanha</span>
        </div>

        <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 shadow-2xs">
          <span className="text-[11px] text-emerald-700 font-medium">Concluídas com Sucesso</span>
          <div className="text-xl font-bold font-mono text-emerald-800 mt-1">
            {operational.successfulOperations}
          </div>
          <span className="text-[10px] text-emerald-600">
            {operational.totalOperations > 0
              ? `${((operational.successfulOperations / operational.totalOperations) * 100).toFixed(0)}% de taxa`
              : '0%'}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 shadow-2xs">
          <span className="text-[11px] text-amber-700 font-medium">Bloqueios de Governação</span>
          <div className="text-xl font-bold font-mono text-amber-800 mt-1">
            {operational.blockedOperations}
          </div>
          <span className="text-[10px] text-amber-600">Moderação / Chaves</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[11px] text-slate-500 font-medium">Latência Média</span>
          <div className="text-xl font-bold font-mono text-blue-700 mt-1">
            {operational.averageDurationMs !== null ? `${operational.averageDurationMs} ms` : 'N/D'}
          </div>
          <span className="text-[10px] text-slate-400">Tempo de inferência</span>
        </div>
      </div>

      {/* Productivity Comparison */}
      {productivity && (
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3">
          <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
            Produtividade e Ciclo de Aprovação
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-500">Versões Totais</span>
              <div className="text-base font-bold font-mono text-blue-700 mt-1">
                {productivity.contentVersionsCreated}
              </div>
              <span className="text-[10px] text-slate-500">{productivity.aiAssistedVersions} IA / {productivity.humanEditedVersions} manual</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-500">Peças e Imagens</span>
              <div className="text-base font-bold font-mono text-slate-800 mt-1">
                {productivity.contentGenerated + productivity.imagesGenerated}
              </div>
              <span className="text-[10px] text-slate-500">{productivity.contentGenerated} txt / {productivity.imagesGenerated} img</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-500">Aprovados / Rejeitados</span>
              <div className="text-base font-bold font-mono text-slate-800 mt-1">
                {productivity.approvedContentCount} / {productivity.rejectedContentCount}
              </div>
              <span className="text-[10px] text-slate-500">{productivity.revisionCount} revisões</span>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <span className="text-[11px] text-emerald-700">Ciclo Médio de Revisão</span>
              <div className="text-base font-bold font-mono text-emerald-800 mt-1">
                {productivity.averageReviewCycleFormatted}
              </div>
              <span className="text-[10px] text-emerald-600">criação até aprovação</span>
            </div>
          </div>
        </div>
      )}

      {/* Financial Costs Section (Restricted to Admin / costs.view) */}
      <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
            Custos de Inferência da Campanha
          </h4>
          {hasFinancialAccess ? (
            <Badge variant="success" size="sm">CONFIRMADO</Badge>
          ) : (
            <Badge variant="neutral" size="sm">
              <Lock className="w-3 h-3 mr-1 inline" />
              ACESSO RESTRITO
            </Badge>
          )}
        </div>

        {hasFinancialAccess && costs ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <span className="text-[11px] text-slate-500">Custo Conhecido</span>
                <div className="text-lg font-bold font-mono text-emerald-700 mt-1">
                  ${costs.totalKnownCostUSD.toFixed(4)} USD
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-500">Custo Estimado</span>
                <div className="text-lg font-bold font-mono text-slate-800 mt-1">
                  ${costs.totalEstimatedCostUSD.toFixed(4)} USD
                </div>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <span className="text-[11px] text-amber-700">Operações Sem Custo</span>
                <div className="text-lg font-bold font-mono text-amber-800 mt-1">
                  {costs.unknownCostOperationsCount}
                </div>
              </div>
            </div>

            {costs.hasPartialCostWarning && (
              <div className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                {costs.partialCostNotice}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center space-y-1">
            <Lock className="w-5 h-5 text-slate-400 mx-auto mb-1" />
            <div className="text-xs font-medium text-slate-700">
              Dados Financeiros Confidenciais
            </div>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Unicamente os administradores têm acesso à visualização de custos monetários de inferência.
            </p>
          </div>
        )}
      </div>

      {/* ROI Status Note */}
      {roi && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-blue-900">Conformidade de ROI:</span>
            <Badge variant="blue" size="sm">{roi.status}</Badge>
          </div>
          <p className="text-blue-800 leading-relaxed">
            {roi.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
};
