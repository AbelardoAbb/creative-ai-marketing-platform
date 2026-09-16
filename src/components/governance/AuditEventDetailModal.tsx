/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, ShieldCheck, AlertCircle, Clock, Cpu, FileText, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { AIAuditEvent } from '../../types/aiAudit';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface AuditEventDetailModalProps {
  event: AIAuditEvent | null;
  onClose: () => void;
}

export const AuditEventDetailModal: React.FC<AuditEventDetailModalProps> = ({ event, onClose }) => {
  if (!event) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <Badge variant="success" size="md">ÉXITO</Badge>;
      case 'BLOCKED':
        return <Badge variant="warning" size="md">BLOQUEADO</Badge>;
      case 'FAILED':
      default:
        return <Badge variant="danger" size="md">FALLO</Badge>;
    }
  };

  const getModerationBadge = (mod: string) => {
    switch (mod) {
      case 'LOW_RISK':
        return <Badge variant="success" size="sm">BAJO RIESGO</Badge>;
      case 'MEDIUM_RISK':
        return <Badge variant="warning" size="sm">RIESGO MEDIO</Badge>;
      case 'HIGH_RISK':
        return <Badge variant="danger" size="sm">ALTO RIESGO (BLOQUEADO)</Badge>;
      case 'REQUIRES_HUMAN_REVIEW':
        return <Badge variant="purple" size="sm">REVISIÓN HUMANA</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{mod}</Badge>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-3xl rounded-2xl bg-[#0f1523] border border-[#202b42] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#202b42]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white">Evento de Auditoría de IA</h3>
                {getStatusBadge(event.status)}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{event.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1c273e] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-[#141c2e] border border-[#202b42]">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Proveedor</span>
              <div className="text-xs font-semibold text-white mt-1">{event.provider}</div>
            </div>

            <div className="p-3 rounded-xl bg-[#141c2e] border border-[#202b42]">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Modelo</span>
              <div className="text-xs font-mono font-semibold text-slate-300 mt-1 truncate" title={event.model}>
                {event.model}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#141c2e] border border-[#202b42]">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Operación</span>
              <div className="text-xs font-semibold text-indigo-400 mt-1">{event.operation}</div>
            </div>

            <div className="p-3 rounded-xl bg-[#141c2e] border border-[#202b42]">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Duración</span>
              <div className="text-xs font-mono font-semibold text-amber-400 mt-1">
                {event.duration_ms !== null ? `${event.duration_ms} ms` : 'N/A (Bloqueado)'}
              </div>
            </div>
          </div>

          {/* User & Campaign Context */}
          <div className="p-4 rounded-xl bg-[#141c2e] border border-[#202b42] space-y-3">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Contexto de Ejecución</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400">Usuario ejecutor:</span>
                <span className="text-white font-medium ml-2">
                  {event.user_name || event.user_id}{' '}
                  {event.user_role && (
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono border border-slate-700">
                      {event.user_role}
                    </span>
                  )}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Campaña:</span>
                <span className="text-white font-medium ml-2">
                  {event.campaign_name || event.campaign_id || 'Global'}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Inicio:</span>
                <span className="text-slate-300 font-mono ml-2">
                  {new Date(event.started_at).toLocaleString('es-ES')}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Moderación de seguridad:</span>
                <span className="ml-2">{getModerationBadge(event.moderation_status)}</span>
              </div>
            </div>
          </div>

          {/* Tokens & Cost Telemetry */}
          <div className="p-4 rounded-xl bg-[#141c2e] border border-[#202b42] space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Telemetría de Tokens y Coste Financiero
              </h4>
              <Badge
                variant={event.cost_status === 'KNOWN' ? 'success' : event.cost_status === 'ESTIMATED' ? 'warning' : 'neutral'}
                size="sm"
              >
                Coste: {event.cost_status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-2.5 rounded-lg bg-[#0d131f] border border-[#1a2337]">
                <span className="text-[11px] text-slate-400">Tokens de entrada</span>
                <div className="text-xs font-mono font-semibold text-slate-200 mt-0.5">
                  {event.input_tokens !== null ? event.input_tokens.toLocaleString('es-ES') : 'N/A'}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0d131f] border border-[#1a2337]">
                <span className="text-[11px] text-slate-400">Tokens de salida</span>
                <div className="text-xs font-mono font-semibold text-slate-200 mt-0.5">
                  {event.output_tokens !== null ? event.output_tokens.toLocaleString('es-ES') : 'N/A'}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0d131f] border border-[#1a2337]">
                <span className="text-[11px] text-slate-400">Total de tokens</span>
                <div className="text-xs font-mono font-semibold text-indigo-300 mt-0.5">
                  {event.total_tokens !== null ? event.total_tokens.toLocaleString('es-ES') : 'N/A'}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0d131f] border border-[#1a2337]">
                <span className="text-[11px] text-slate-400">Coste computado</span>
                <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                  {event.estimated_cost !== null
                    ? `$${event.estimated_cost.toFixed(6)} ${event.currency}`
                    : 'COST_UNKNOWN'}
                </div>
              </div>
            </div>
          </div>

          {/* Error / Block Justification */}
          {(event.error_code || event.error_message) && (
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4" />
                <span>Justificación técnica de error / bloqueo</span>
              </div>
              {event.error_code && (
                <div className="text-xs font-mono text-amber-300">
                  Código: <span className="font-bold">{event.error_code}</span>
                </div>
              )}
              {event.error_message && (
                <p className="text-xs text-amber-200/80 leading-relaxed font-mono bg-[#0d131f] p-3 rounded-lg border border-amber-900/30">
                  {event.error_message}
                </p>
              )}
            </div>
          )}

          {/* Metadata JSON Viewer */}
          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <div className="p-4 rounded-xl bg-[#141c2e] border border-[#202b42] space-y-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Metadatos adicionales
              </h4>
              <pre className="text-[11px] font-mono text-slate-300 bg-[#0d131f] p-3 rounded-lg border border-[#1a2337] overflow-x-auto">
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#202b42] flex justify-between items-center bg-[#090d16]">
          <span className="text-[11px] text-slate-500 font-mono">
            Pista inmutable de auditoría (Append-Only)
          </span>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
};
