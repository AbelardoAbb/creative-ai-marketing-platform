/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Cpu,
  AlertTriangle,
  FileText,
  Eye,
  CheckCircle2,
  XCircle,
  Download,
  AlertCircle,
} from 'lucide-react';
import { AIAuditEvent } from '../../types/aiAudit';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { AuditEventDetailModal } from './AuditEventDetailModal';
import { LoadingState } from '../ui/LoadingState';

export const AIAuditTrailView: React.FC = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<AIAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedProvider, setSelectedProvider] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedModStatus, setSelectedModStatus] = useState<string>('ALL');
  const [selectedOperation, setSelectedOperation] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected event for modal detail
  const [inspectedEvent, setInspectedEvent] = useState<AIAuditEvent | null>(null);

  const getAuthHeaders = useCallback(() => {
    return {
      'Content-Type': 'application/json',
      'x-user-id': user?.id || 'anonymous',
      'x-user-role': user?.role || 'Administrator',
      'x-user-email': user?.email || '',
      'x-user-name': user?.displayName || '',
    };
  }, [user]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedProvider !== 'ALL') params.append('provider', selectedProvider);
      if (selectedStatus !== 'ALL') params.append('status', selectedStatus);
      if (selectedModStatus !== 'ALL') params.append('moderationStatus', selectedModStatus);
      if (selectedOperation !== 'ALL') params.append('operation', selectedOperation);
      params.append('limit', '100');

      const res = await fetch(`/api/governance/ai-audit?${params.toString()}`, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Erro HTTP ${res.status}`);
      }

      const data = await res.json();
      setEvents(data.events || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar trilha de auditoria.');
    } finally {
      setLoading(false);
    }
  }, [selectedProvider, selectedStatus, selectedModStatus, selectedOperation, getAuthHeaders]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Client-side search filtering
  const filteredEvents = events.filter((ev) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      ev.campaign_name?.toLowerCase().includes(q) ||
      ev.user_name?.toLowerCase().includes(q) ||
      ev.model.toLowerCase().includes(q) ||
      ev.operation.toLowerCase().includes(q) ||
      ev.error_code?.toLowerCase().includes(q) ||
      ev.error_message?.toLowerCase().includes(q)
    );
  });

  const handleExportCSV = () => {
      const headers = [
      'ID',
      'Fecha/Hora',
      'Campaña',
      'Usuario',
      'Rol',
      'Proveedor',
      'Modelo',
      'Operación',
      'Estado',
      'Moderación',
      'Duración (ms)',
      'Tokens Total',
      'Coste Estimado (USD)',
      'Estado Coste',
      'Error',
    ];

    const rows = filteredEvents.map((e) => [
      e.id,
      e.started_at,
      e.campaign_name || e.campaign_id || 'N/A',
      e.user_name || e.user_id,
      e.user_role || 'N/A',
      e.provider,
      e.model,
      e.operation,
      e.status,
      e.moderation_status,
      e.duration_ms ?? 'N/A',
      e.total_tokens ?? 'UNKNOWN',
      e.estimated_cost !== null ? e.estimated_cost : 'UNKNOWN',
      e.cost_status,
      `"${(e.error_message || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pista_auditoria_ia_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Pista de Auditoría de IA</h2>
            <Badge variant="purple" size="sm">
              Append-Only (Inmutable)
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Registro detallado de cada inferencia, tiempo de ejecución, consumo de tokens y moderación de seguridad
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchEvents}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Actualizar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportCSV}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-[#0f1523] border border-[#202b42] space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar campaña, usuario..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#141c2e] border border-[#202b42] rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Provider */}
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            className="bg-[#141c2e] border border-[#202b42] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Todos los proveedores</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="stability_ai">Stability AI</option>
            <option value="fallback_provider">Fallback Provider</option>
          </select>

          {/* Status */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-[#141c2e] border border-[#202b42] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Todos los estados</option>
            <option value="SUCCESS">ÉXITO</option>
            <option value="BLOCKED">BLOQUEADO</option>
            <option value="FAILED">FALLO</option>
          </select>

          {/* Moderation */}
          <select
            value={selectedModStatus}
            onChange={(e) => setSelectedModStatus(e.target.value)}
            className="bg-[#141c2e] border border-[#202b42] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Toda la moderación</option>
            <option value="LOW_RISK">Bajo riesgo</option>
            <option value="REQUIRES_HUMAN_REVIEW">Revisión humana</option>
            <option value="HIGH_RISK">Alto riesgo (Bloqueado)</option>
          </select>

          {/* Operation */}
          <select
            value={selectedOperation}
            onChange={(e) => setSelectedOperation(e.target.value)}
            className="bg-[#141c2e] border border-[#202b42] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Todas las operaciones</option>
            <option value="generate">Redacción (Generate)</option>
            <option value="expand">Expandir contenido</option>
            <option value="shorten">Resumir contenido</option>
            <option value="tone_shift">Ajustar tono</option>
            <option value="image_generate">Generar imagen</option>
            <option value="image_variation">Variación de imagen</option>
          </select>
        </div>
      </div>

      {/* Audit Events Table */}
      {loading ? (
        <LoadingState message="Cargando eventos de auditoría inmutables..." />
      ) : error ? (
        <div className="p-6 rounded-2xl bg-red-950/20 border border-red-800/40 text-center space-y-2">
          <AlertCircle className="w-6 h-6 text-red-400 mx-auto" />
          <div className="text-sm font-semibold text-white">Error al obtener auditoría</div>
          <p className="text-xs text-red-300">{error}</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#0f1523] border border-[#202b42] text-center space-y-3">
          <ShieldCheck className="w-8 h-8 text-slate-500 mx-auto" />
          <div className="text-sm font-semibold text-slate-300">Ningún evento registrado</div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No se encontraron operaciones de IA con los filtros seleccionados.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-[#0f1523] border border-[#202b42] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141c2e] border-b border-[#202b42] text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Fecha / Hora</th>
                  <th className="py-3 px-4">Campaña / Usuario</th>
                  <th className="py-3 px-4">Proveedor y Modelo</th>
                  <th className="py-3 px-4">Operación</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Moderación</th>
                  <th className="py-3 px-4">Tokens / Latencia</th>
                  <th className="py-3 px-4">Coste</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1b253b]">
                {filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-[#131b2c] transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="text-slate-200 font-mono">
                        {new Date(ev.started_at).toLocaleDateString('es-ES')}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {new Date(ev.started_at).toLocaleTimeString('es-ES')}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-white truncate max-w-[150px]">
                        {ev.campaign_name || 'Global'}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <span>{ev.user_name || ev.user_id}</span>
                        {ev.user_role && (
                          <span className="px-1 py-0.2 rounded bg-slate-800 text-slate-400 text-[9px] font-mono border border-slate-700">
                            {ev.user_role}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-200">{ev.provider}</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]" title={ev.model}>
                        {ev.model}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 font-mono text-[10px] border border-indigo-900/50">
                        {ev.operation}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {ev.status === 'SUCCESS' ? (
                        <Badge variant="success" size="sm">ÉXITO</Badge>
                      ) : ev.status === 'BLOCKED' ? (
                        <Badge variant="warning" size="sm">BLOQUEADO</Badge>
                      ) : (
                        <Badge variant="danger" size="sm">FALLO</Badge>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {ev.moderation_status === 'LOW_RISK' ? (
                        <Badge variant="success" size="sm">Bajo</Badge>
                      ) : ev.moderation_status === 'HIGH_RISK' ? (
                        <Badge variant="danger" size="sm">Alto (Bloq.)</Badge>
                      ) : (
                        <Badge variant="purple" size="sm">Revisión</Badge>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap font-mono">
                      <div className="text-slate-300">
                        {ev.total_tokens !== null
                          ? `${ev.total_tokens.toLocaleString()} tok`
                          : <span className="text-slate-500 text-[10px]">TOK_UNKNOWN</span>}
                      </div>
                      <div className="text-[10px] text-amber-400">
                        {ev.duration_ms !== null ? `${ev.duration_ms} ms` : '0 ms'}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap font-mono">
                      {ev.estimated_cost !== null ? (
                        <span className="text-emerald-400 font-semibold">
                          ${ev.estimated_cost.toFixed(5)}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[10px]">COST_UNKNOWN</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setInspectedEvent(ev)}
                        leftIcon={<Eye className="w-3.5 h-3.5" />}
                      >
                        Ver
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-3 border-t border-[#202b42] bg-[#141c2e] flex items-center justify-between text-xs text-slate-400">
            <span>Mostrando {filteredEvents.length} de {events.length} eventos auditados</span>
            <span className="text-[11px] font-mono">Filtros Activos: Proveedor [{selectedProvider}] | Estado [{selectedStatus}]</span>
          </div>
        </div>
      )}

      {/* Modal Detail */}
      <AuditEventDetailModal
        event={inspectedEvent}
        onClose={() => setInspectedEvent(null)}
      />
    </div>
  );
};
