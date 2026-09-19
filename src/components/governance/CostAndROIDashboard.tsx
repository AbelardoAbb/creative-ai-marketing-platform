/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  DollarSign,
  Clock,
  Cpu,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  Info,
  HelpCircle,
  ChevronRight,
  Lock,
  Layers,
  Calendar,
  Users,
  Building2,
} from 'lucide-react';
import { CompleteGovernanceMetricsResponse, AIAuditEvent } from '../../types/aiAudit';
import { PricingModelConfig } from '../../types/cost';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { LoadingState } from '../ui/LoadingState';
import { PricingCatalogModal } from './PricingCatalogModal';
import { AuditEventDetailModal } from './AuditEventDetailModal';

export const CostAndROIDashboard: React.FC<{ onNavigateToAudit?: () => void }> = ({
  onNavigateToAudit,
}) => {
  const { user, session } = useAuth();
  const [data, setData] = useState<CompleteGovernanceMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pricing Catalog Modal
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [pricingCatalog, setPricingCatalog] = useState<PricingModelConfig[]>([]);

  // Inspected Event for modal
  const [inspectedEvent, setInspectedEvent] = useState<AIAuditEvent | null>(null);

  const getAuthHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-id': user?.id || 'anonymous',
      'x-user-role': user?.role || 'Administrator',
      'x-user-email': user?.email || '',
      'x-user-name': user?.displayName || '',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  }, [user, session]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [roiRes, pricingRes] = await Promise.all([
        fetch('/api/governance/costs-roi', { headers: getAuthHeaders() }),
        fetch('/api/governance/pricing-config', { headers: getAuthHeaders() }),
      ]);

      if (!roiRes.ok) {
        const errJson = await roiRes.json().catch(() => ({}));
        throw new Error(errJson.message || `Erro HTTP ${roiRes.status}`);
      }

      const roiData: CompleteGovernanceMetricsResponse = await roiRes.json();
      setData(roiData);

      if (pricingRes.ok) {
        const pData = await pricingRes.json();
        setPricingCatalog(pData.pricingCatalog || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar métricas de governação.');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <LoadingState message="A consolidar métricas de auditoria, custos e produtividade de IA..." />;
  }

  if (error || !data) {
    return (
      <div className="p-8 rounded-2xl bg-red-950/20 border border-red-800/40 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
        <h3 className="text-base font-semibold text-white">Erro ao carregar dados de governação</h3>
        <p className="text-xs text-red-300">{error || 'Dados não disponíveis.'}</p>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const { operational, costs, productivity, roi, recentAuditEvents } = data;

  return (
    <div className="space-y-8">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Auditoria de IA, Custos e Produtividade
            </h1>
            <Badge variant="purple" size="sm">
              Fase 10B
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Rastreabilidade integral, controlo de consumo de inferência e métricas operacionais sem fabricação de dados
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsPricingModalOpen(true)}
            leftIcon={<DollarSign className="w-3.5 h-3.5 text-emerald-400" />}
          >
            Tabela de Preços
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchData}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Atualizar
          </Button>
        </div>
      </div>

      {/* Partial Cost Notice (if applicable) */}
      {costs.hasPartialCostWarning && (
        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/50 flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-amber-200">
              Aviso de Custo Parcial (Princípio de Não Fabricação)
            </h4>
            <p className="text-xs text-amber-300/80 leading-relaxed">
              {costs.partialCostNotice} O valor informado corresponde estritamente ao total de operações com tarifação e telemetria confirmadas. As operações com chaves não configuradas ou fornecedor de contingência sem medição de tokens não são inventadas nem estimadas com valores fictícios.
            </p>
          </div>
        </div>
      )}

      {/* Provider Status Disclosures */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Claude Status Box */}
        <div className="p-4 rounded-xl bg-[#141c2e] border border-amber-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-bold text-white">Anthropic Claude (claude-3-5-sonnet)</span>
            </div>
            <Badge variant="warning" size="sm">
              CHAVE BLOQUEADA
            </Badge>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            A chave <code className="text-amber-300 font-mono">ANTHROPIC_API_KEY</code> não está
            configurada no ambiente. As operações são registadas como{' '}
            <span className="text-amber-400 font-semibold font-mono">BLOCKED</span> com tokens e custos marcados
            explicitamente como <code className="text-slate-300 font-mono">COST_UNKNOWN</code>. Nenhuma geração de texto é fabricada.
          </p>
        </div>

        {/* Image Generation Provider Status Box */}
        <div className="p-4 rounded-xl bg-[#141c2e] border border-[#202b42] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
              <span className="text-xs font-bold text-white">Stability AI / Fornecedor de Contingência</span>
            </div>
            <Badge variant="neutral" size="sm">
              TELEMETRIA ATIVA
            </Badge>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Gerações visuais auditadas com dimensões, latência e identificação inequívoca de fornecedor real
            vs contingência. As gerações de contingência têm um custo computado como{' '}
            <span className="text-slate-300 font-mono">COST_UNKNOWN</span> para evitar desvios orçamentais.
          </p>
        </div>
      </div>

      {/* SECTION 1: Operational Metrics Overview */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          1. Métricas Operacionais de IA (Total de Inferências: {operational.totalOperations})
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="p-4 rounded-xl bg-[#0f1523] border border-[#202b42]">
            <span className="text-[11px] text-slate-400">Total de Operações</span>
            <div className="text-xl font-bold font-mono text-white mt-1">
              {operational.totalOperations}
            </div>
            <span className="text-[10px] text-slate-500">100% auditadas</span>
          </div>

          <div className="p-4 rounded-xl bg-[#0f1523] border border-emerald-900/40">
            <span className="text-[11px] text-emerald-400">Sucessos Concluídos</span>
            <div className="text-xl font-bold font-mono text-emerald-300 mt-1">
              {operational.successfulOperations}
            </div>
            <span className="text-[10px] text-emerald-500/80">
              Taxa: {operational.totalOperations > 0 ? ((operational.successfulOperations / operational.totalOperations) * 100).toFixed(1) : 0}%
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#0f1523] border border-amber-900/40">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-amber-400">Bloqueios de Governação</span>
              <HelpCircle className="w-3 h-3 text-amber-500" title="Os bloqueios não são falhas; são retenções preventivas de segurança" />
            </div>
            <div className="text-xl font-bold font-mono text-amber-300 mt-1">
              {operational.blockedOperations}
            </div>
            <span className="text-[10px] text-amber-500/80">Chaves ausentes / Moderação</span>
          </div>

          <div className="p-4 rounded-xl bg-[#0f1523] border border-red-900/40">
            <span className="text-[11px] text-red-400">Falhas Técnicas</span>
            <div className="text-xl font-bold font-mono text-red-300 mt-1">
              {operational.failedOperations}
            </div>
            <span className="text-[10px] text-red-500/80">Erros de API / Timeout</span>
          </div>

          <div className="p-4 rounded-xl bg-[#0f1523] border border-[#202b42]">
            <span className="text-[11px] text-slate-400">Latência Média</span>
            <div className="text-xl font-bold font-mono text-indigo-300 mt-1">
              {operational.averageDurationMs !== null ? `${operational.averageDurationMs} ms` : 'N/A'}
            </div>
            <span className="text-[10px] text-slate-500">Exclui pedidos bloqueados</span>
          </div>
        </div>
      </div>

      {/* SECTION 2: Cost Tracking & Observability */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            2. Monitorização de Custos Financeiros de Inferência
          </h3>
          <span className="text-[11px] font-mono text-slate-400">Moeda Base: USD</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl bg-[#0f1523] border border-emerald-500/30 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Custo Conhecido (Faturável)</span>
              <Badge variant="success" size="sm">CONFIRMADO</Badge>
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              ${costs.totalKnownCostUSD.toFixed(4)} <span className="text-xs text-slate-400">USD</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Derivado estritamente de tokens e pedidos confirmados
            </p>
          </div>

          <div className="p-5 rounded-xl bg-[#0f1523] border border-[#202b42] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Custo Estimado</span>
              <Badge variant="neutral" size="sm">ESTIMADO</Badge>
            </div>
            <div className="text-2xl font-bold font-mono text-slate-300 mt-1">
              ${costs.totalEstimatedCostUSD.toFixed(4)} <span className="text-xs text-slate-400">USD</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Quando aplicável um método heurístico aprovado
            </p>
          </div>

          <div className="p-5 rounded-xl bg-[#0f1523] border border-amber-900/30 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-amber-400">Operações Sem Custo Definido</span>
              <Badge variant="warning" size="sm">COST_UNKNOWN</Badge>
            </div>
            <div className="text-2xl font-bold font-mono text-amber-300 mt-1">
              {costs.unknownCostOperationsCount}{' '}
              <span className="text-xs text-slate-400 font-normal">operações</span>
            </div>
            <p className="text-[11px] text-amber-500/80">
              Operações bloqueadas ou de contingência sem relatório de tokens
            </p>
          </div>
        </div>

        {/* Cost Tables: by Provider & by Campaign */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* By Provider Table */}
          <div className="p-4 rounded-xl bg-[#0f1523] border border-[#202b42] space-y-3">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
              Consumo por Fornecedor
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#202b42] text-slate-400 text-[11px]">
                  <tr>
                    <th className="pb-2">Fornecedor</th>
                    <th className="pb-2">Chamadas</th>
                    <th className="pb-2">Custo Conhecido</th>
                    <th className="pb-2">Indefinidas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#182236]">
                  {(
                    Object.entries(costs.costByProvider) as Array<
                      [
                        string,
                        {
                          knownUSD: number;
                          estimatedUSD: number;
                          unknownCount: number;
                          totalOperations: number;
                        }
                      ]
                    >
                  ).map(([prov, item]) => (
                    <tr key={prov}>
                      <td className="py-2.5 font-medium text-slate-200">{prov}</td>
                      <td className="py-2.5 font-mono text-slate-400">{item.totalOperations}</td>
                      <td className="py-2.5 font-mono text-emerald-400 font-semibold">
                        ${item.knownUSD.toFixed(4)}
                      </td>
                      <td className="py-2.5">
                        {item.unknownCount > 0 ? (
                          <Badge variant="warning" size="sm">{item.unknownCount} UNKNOWN</Badge>
                        ) : (
                          <Badge variant="success" size="sm">0</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* By Campaign Table */}
          <div className="p-4 rounded-xl bg-[#0f1523] border border-[#202b42] space-y-3">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
              Consumo por Campanha
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#202b42] text-slate-400 text-[11px]">
                  <tr>
                    <th className="pb-2">Campanha</th>
                    <th className="pb-2">Custo Conhecido</th>
                    <th className="pb-2">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#182236]">
                  {costs.costByCampaign.map((c) => (
                    <tr key={c.campaignId}>
                      <td className="py-2.5 font-medium text-slate-200 truncate max-w-[180px]" title={c.campaignName}>
                        {c.campaignName}
                      </td>
                      <td className="py-2.5 font-mono text-emerald-400 font-semibold">
                        ${c.knownCostUSD.toFixed(4)}
                      </td>
                      <td className="py-2.5">
                        {c.hasPartialCostWarning ? (
                          <Badge variant="warning" size="sm">PARCIAL</Badge>
                        ) : (
                          <Badge variant="success" size="sm">COMPLETO</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* User Consumption Table (if present) */}
        {costs.costByUser && costs.costByUser.length > 0 && (
          <div className="p-4 rounded-xl bg-[#0f1523] border border-[#202b42] space-y-3">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
              Consumo e gerações por utilizador
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#202b42] text-slate-400 text-[11px]">
                  <tr>
                    <th className="pb-2">Utilizador</th>
                    <th className="pb-2">Função</th>
                    <th className="pb-2">Total de Gerações</th>
                    <th className="pb-2">Texto / Imagem</th>
                    <th className="pb-2">Custo Conhecido</th>
                    <th className="pb-2">Operações Sem Custo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#182236]">
                  {costs.costByUser.map((u) => (
                    <tr key={u.userId}>
                      <td className="py-2.5 font-medium text-slate-200">{u.userName}</td>
                      <td className="py-2.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono border border-slate-700">
                          {u.userRole}
                        </span>
                      </td>
                      <td className="py-2.5 font-mono text-slate-300">{u.totalGenerations}</td>
                      <td className="py-2.5 font-mono text-slate-400">
                        {u.textOperations} txt / {u.imageOperations} img
                      </td>
                      <td className="py-2.5 font-mono text-emerald-400 font-semibold">
                        ${u.knownCostUSD.toFixed(4)}
                      </td>
                      <td className="py-2.5">
                        {u.unknownCostOperationsCount > 0 ? (
                          <span className="text-amber-400 font-mono text-xs">
                            {u.unknownCostOperationsCount} unk
                          </span>
                        ) : (
                          <span className="text-slate-500 font-mono text-xs">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: Productivity & Operational Efficiency */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            3. Eficiência Operacional e Produtividade
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">
            Diferenciação Estrita: Duração de Fluxo vs Tempo Poupado
          </span>
        </div>

        <div className="p-6 rounded-2xl bg-[#0f1523] border border-[#202b42] space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#141c2e] border border-[#202b42]">
              <span className="text-[11px] text-slate-400">Versões Criadas</span>
              <div className="text-xl font-bold font-mono text-white mt-1">
                {productivity.contentVersionsCreated}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                {productivity.aiAssistedVersions} com IA / {productivity.humanEditedVersions} manuais
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#141c2e] border border-[#202b42]">
              <span className="text-[11px] text-slate-400">Aprovados / Rejeitados</span>
              <div className="text-xl font-bold font-mono text-slate-200 mt-1">
                {productivity.approvedContentCount} / {productivity.rejectedContentCount}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                {productivity.revisionCount} revisões solicitadas
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#141c2e] border border-[#202b42]">
              <span className="text-[11px] text-slate-400">Ativos Gerados</span>
              <div className="text-xl font-bold font-mono text-indigo-300 mt-1">
                {productivity.contentGenerated + productivity.imagesGenerated}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                {productivity.contentGenerated} peças / {productivity.imagesGenerated} imagens
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#141c2e] border border-emerald-900/30">
              <span className="text-[11px] text-emerald-400">Ciclo Médio de Aprovação</span>
              <div className="text-xl font-bold font-mono text-emerald-300 mt-1">
                {productivity.averageReviewCycleFormatted}
              </div>
              <p className="text-[10px] text-emerald-500/80 mt-1">
                Criação até à aprovação final
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#0d131f] border border-[#1a2337] flex items-start gap-3">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-400 leading-relaxed">
              <span className="text-slate-200 font-semibold">Metodologia de Produtividade:</span>{' '}
              A duração computacional da IA representa o tempo técnico de inferência. A plataforma não reivindica horas poupadas sem um estudo prévio de linha de base (baseline) de produtividade com o cliente.
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: ROI Framework & Governance Disclosure */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          4. Quadro de Retorno sobre o Investimento (ROI)
        </h3>

        <div className="p-6 rounded-2xl bg-[#0f1523] border border-indigo-950/60 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Estado do ROI Financeiro</h4>
                <p className="text-xs text-slate-400">Conformidade com os padrões de auditoria corporativa</p>
              </div>
            </div>
            <Badge variant="purple" size="md">
              {roi.status}
            </Badge>
          </div>

          <div className="p-4 rounded-xl bg-[#141c2e] border border-purple-900/30 space-y-2">
            <div className="text-xs font-semibold text-purple-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Diretriz de Transparência Financeira</span>
            </div>
            <p className="text-xs text-purple-200/80 leading-relaxed">
              {roi.disclaimer}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-400">
            <div className="p-3 rounded-lg bg-[#0d131f] border border-[#1a2337]">
              <span className="font-semibold text-slate-300 block mb-1">Custo de Inferência Registado:</span>
              <span className="font-mono text-emerald-400 text-sm">
                ${roi.availableInputs.aiOperationalKnownCostUSD.toFixed(4)} USD
              </span>
            </div>
            <div className="p-3 rounded-lg bg-[#0d131f] border border-[#1a2337]">
              <span className="font-semibold text-slate-300 block mb-1">Entradas Não Disponíveis para ROI:</span>
              <span className="font-mono text-slate-400 text-xs">
                {roi.unavailableInputs.join(' • ')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 5: Recent Traceable Audit Stream */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              5. Fluxo Recente de Trilha Imutável de Auditoria
            </h3>
            <p className="text-xs text-slate-500">Últimos eventos registados no sink central</p>
          </div>
          {onNavigateToAudit && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onNavigateToAudit}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              Abrir Trilha Completa
            </Button>
          )}
        </div>

        <div className="rounded-xl bg-[#0f1523] border border-[#202b42] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141c2e] border-b border-[#202b42] text-slate-400 text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Data/Hora</th>
                  <th className="py-2.5 px-4">Campanha</th>
                  <th className="py-2.5 px-4">Utilizador</th>
                  <th className="py-2.5 px-4">Fornecedor/Modelo</th>
                  <th className="py-2.5 px-4">Operação</th>
                  <th className="py-2.5 px-4">Estado</th>
                  <th className="py-2.5 px-4">Custo</th>
                  <th className="py-2.5 px-4 text-right">Detalhe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a243a]">
                {recentAuditEvents.slice(0, 8).map((ev) => (
                  <tr key={ev.id} className="hover:bg-[#131b2c] transition-colors">
                    <td className="py-2.5 px-4 whitespace-nowrap text-slate-300 font-mono">
                      {new Date(ev.started_at).toLocaleTimeString('pt-PT')}
                    </td>
                    <td className="py-2.5 px-4 text-slate-200 font-medium">
                      {ev.campaign_name || 'Global'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-300">
                      {ev.user_name || ev.user_id}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">
                      {ev.provider} ({ev.model})
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-indigo-300">
                      {ev.operation}
                    </td>
                    <td className="py-2.5 px-4">
                      {ev.status === 'SUCCESS' ? (
                        <Badge variant="success" size="sm">SUCESSO</Badge>
                      ) : ev.status === 'BLOCKED' ? (
                        <Badge variant="warning" size="sm">BLOQUEADO</Badge>
                      ) : (
                        <Badge variant="danger" size="sm">FALHA</Badge>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-emerald-400">
                      {ev.estimated_cost !== null
                        ? `$${ev.estimated_cost.toFixed(5)}`
                        : <span className="text-slate-500 text-[10px]">UNKNOWN</span>}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setInspectedEvent(ev)}
                      >
                        Inspecionar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pricing Catalog Modal */}
      <PricingCatalogModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
        pricingCatalog={pricingCatalog}
      />

      {/* Audit Event Detail Modal */}
      <AuditEventDetailModal
        event={inspectedEvent}
        onClose={() => setInspectedEvent(null)}
      />
    </div>
  );
};
