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
  const { user } = useAuth();
  const [operational, setOperational] = useState<AIOperationalMetrics | null>(null);
  const [productivity, setProductivity] = useState<ProductivityMetrics | null>(null);
  const [roi, setRoi] = useState<ROIFrameworkMetrics | null>(null);
  const [costs, setCosts] = useState<CostSummaryMetrics | null>(null);
  const [hasFinancialAccess, setHasFinancialAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(() => {
    return {
      'Content-Type': 'application/json',
      'x-user-id': user?.id || 'anonymous',
      'x-user-role': user?.role || 'Designer',
      'x-user-email': user?.email || '',
      'x-user-name': user?.displayName || '',
    };
  }, [user]);

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
    return <LoadingState message="Cargando métricas de inferencia de la campaña..." />;
  }

  if (error || !operational) {
    return (
      <div className="p-6 rounded-xl bg-red-50 border border-red-200 text-center space-y-2">
        <AlertTriangle className="w-6 h-6 text-red-600 mx-auto" />
        <h4 className="text-sm font-semibold text-slate-900">Métricas no disponibles</h4>
        <p className="text-xs text-red-700">{error || 'No fue posible cargar las métricas.'}</p>
        <Button variant="outline" size="sm" onClick={fetchMetrics}>
          Reintentar
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
            Métricas de IA y Eficiencia de la Campaña
          </h3>
          <p className="text-xs text-slate-500">
            Telemetría de ejecuciones vinculadas exclusivamente a esta campaña
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchMetrics}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Actualizar
        </Button>
      </div>

      {/* Operational Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[11px] text-slate-500 font-medium">Operaciones de IA</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">
            {operational.totalOperations}
          </div>
          <span className="text-[10px] text-slate-400">En esta campaña</span>
        </div>

        <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 shadow-2xs">
          <span className="text-[11px] text-emerald-700 font-medium">Completadas con Éxito</span>
          <div className="text-xl font-bold font-mono text-emerald-800 mt-1">
            {operational.successfulOperations}
          </div>
          <span className="text-[10px] text-emerald-600">
            {operational.totalOperations > 0
              ? `${((operational.successfulOperations / operational.totalOperations) * 100).toFixed(0)}% de tasa`
              : '0%'}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 shadow-2xs">
          <span className="text-[11px] text-amber-700 font-medium">Bloqueos de Gobernanza</span>
          <div className="text-xl font-bold font-mono text-amber-800 mt-1">
            {operational.blockedOperations}
          </div>
          <span className="text-[10px] text-amber-600">Moderación / Claves</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[11px] text-slate-500 font-medium">Latencia Media</span>
          <div className="text-xl font-bold font-mono text-blue-700 mt-1">
            {operational.averageDurationMs !== null ? `${operational.averageDurationMs} ms` : 'N/D'}
          </div>
          <span className="text-[10px] text-slate-400">Tiempo de inferencia</span>
        </div>
      </div>

      {/* Productivity Comparison */}
      {productivity && (
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3">
          <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
            Productividad y Ciclo de Aprobación
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-500">Versiones Totales</span>
              <div className="text-base font-bold font-mono text-blue-700 mt-1">
                {productivity.contentVersionsCreated}
              </div>
              <span className="text-[10px] text-slate-500">{productivity.aiAssistedVersions} IA / {productivity.humanEditedVersions} manual</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-500">Piezas e Imágenes</span>
              <div className="text-base font-bold font-mono text-slate-800 mt-1">
                {productivity.contentGenerated + productivity.imagesGenerated}
              </div>
              <span className="text-[10px] text-slate-500">{productivity.contentGenerated} txt / {productivity.imagesGenerated} img</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-500">Aprobados / Rechazados</span>
              <div className="text-base font-bold font-mono text-slate-800 mt-1">
                {productivity.approvedContentCount} / {productivity.rejectedContentCount}
              </div>
              <span className="text-[10px] text-slate-500">{productivity.revisionCount} revisiones</span>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <span className="text-[11px] text-emerald-700">Ciclo Medio de Revisión</span>
              <div className="text-base font-bold font-mono text-emerald-800 mt-1">
                {productivity.averageReviewCycleFormatted}
              </div>
              <span className="text-[10px] text-emerald-600">creación hasta aprobación</span>
            </div>
          </div>
        </div>
      )}

      {/* Financial Costs Section (Restricted to Admin / costs.view) */}
      <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
            Costes de Inferencia de la Campaña
          </h4>
          {hasFinancialAccess ? (
            <Badge variant="success" size="sm">CONFIRMADO</Badge>
          ) : (
            <Badge variant="neutral" size="sm">
              <Lock className="w-3 h-3 mr-1 inline" />
              ACCESO RESTRINGIDO
            </Badge>
          )}
        </div>

        {hasFinancialAccess && costs ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <span className="text-[11px] text-slate-500">Coste Conocido</span>
                <div className="text-lg font-bold font-mono text-emerald-700 mt-1">
                  ${costs.totalKnownCostUSD.toFixed(4)} USD
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-500">Coste Estimado</span>
                <div className="text-lg font-bold font-mono text-slate-800 mt-1">
                  ${costs.totalEstimatedCostUSD.toFixed(4)} USD
                </div>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <span className="text-[11px] text-amber-700">Operaciones Sin Coste</span>
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
              Datos Financieros Confidenciales
            </div>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Únicamente los administradores tienen acceso a la visualización de costes monetarios de inferencia.
            </p>
          </div>
        )}
      </div>

      {/* ROI Status Note */}
      {roi && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-blue-900">Conformidad de ROI:</span>
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
