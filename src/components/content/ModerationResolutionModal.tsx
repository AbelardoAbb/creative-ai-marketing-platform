/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, X, AlertTriangle, FileText } from 'lucide-react';
import { ModerationEventModel } from '../../types/moderation';

interface ModerationResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: ModerationEventModel | null;
  onResolve: (decision: 'ALLOW' | 'BLOCK', notes: string) => Promise<void>;
  isProcessing: boolean;
}

export const ModerationResolutionModal: React.FC<ModerationResolutionModalProps> = ({
  isOpen,
  onClose,
  event,
  onResolve,
  isProcessing,
}) => {
  const [decision, setDecision] = useState<'ALLOW' | 'BLOCK'>('ALLOW');
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen || !event) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim() || notes.trim().length < 5) {
      setValidationError('La justificación de la moderación debe contener al menos 5 caracteres.');
      return;
    }
    setValidationError(null);
    await onResolve(decision, notes.trim());
  };

  return (
    <div
      id="moderation-resolution-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
    >
      <div
        className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-100">
                Resolución de moderación de seguridad
              </h3>
              <p className="text-xs text-neutral-400">
                Evaluación humana obligatoria para liberación o bloqueo definitivo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-neutral-500 hover:text-neutral-300 p-1 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Event Details Card */}
        <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-neutral-800 text-neutral-300">
              Etapa: {event.stage === 'INPUT' ? 'Entrada (Prompt)' : 'Salida (Generación)'}
            </span>
            <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300">
              Riesgo: {event.risk_level}
            </span>
            <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-neutral-800 text-neutral-400">
              {event.provider} · {event.model}
            </span>
          </div>

          {event.categories && event.categories.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-neutral-400">Categorías:</span>
              {event.categories.map((cat) => (
                <span
                  key={cat}
                  className="px-2 py-0.5 text-[10px] rounded-md bg-red-500/10 border border-red-500/20 text-red-300 font-mono"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}

          {event.reason && (
            <div className="text-xs text-amber-200/90 bg-amber-500/5 p-2.5 rounded-lg border border-amber-500/20">
              <strong>Motivo detectado:</strong> {event.reason}
            </div>
          )}

          {event.evaluated_snippet && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-medium">
                <FileText className="w-3.5 h-3.5" />
                <span>Fragmento evaluado:</span>
              </div>
              <p className="text-xs text-neutral-300 font-mono bg-neutral-900 p-2.5 rounded-lg border border-neutral-800 line-clamp-4 break-words">
                {event.evaluated_snippet}
              </p>
            </div>
          )}

          <div className="text-[11px] text-neutral-400 pt-1">
            Enviado por: <strong className="text-neutral-300">{event.user_name}</strong> ({event.user_role}) el {new Date(event.timestamp).toLocaleString('es-ES')}
          </div>
        </div>

        {/* Decision Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">Decisión del revisor:</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDecision('ALLOW')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  decision === 'ALLOW'
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
                    : 'border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <ShieldCheck className={`w-4 h-4 mt-0.5 ${decision === 'ALLOW' ? 'text-emerald-400' : 'text-neutral-500'}`} />
                <div>
                  <div className="text-xs font-bold text-neutral-200">ALLOW (Permitir)</div>
                  <div className="text-[11px] text-neutral-400">Clasifica como falso positivo o aceptable en el contexto.</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDecision('BLOCK')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  decision === 'BLOCK'
                    ? 'border-red-500/50 bg-red-500/10 text-red-200'
                    : 'border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <AlertTriangle className={`w-4 h-4 mt-0.5 ${decision === 'BLOCK' ? 'text-red-400' : 'text-neutral-500'}`} />
                <div>
                  <div className="text-xs font-bold text-neutral-200">BLOCK (Bloquear)</div>
                  <div className="text-[11px] text-neutral-400">Confirma infracción de seguridad y bloquea definitivamente.</div>
                </div>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">
              Justificación obligatoria de auditoría:
            </label>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="Describa detalladamente el análisis técnico de seguridad y el motivo de la decisión..."
              rows={3}
              className="w-full text-xs bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-neutral-200 placeholder-neutral-500 focus:outline-hidden focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
            />
            {validationError && (
              <p className="text-xs text-red-400 font-medium">{validationError}</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className={`px-4 py-2 text-xs font-semibold rounded-xl text-white transition-all shadow-sm flex items-center gap-1.5 ${
                decision === 'ALLOW'
                  ? 'bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50'
                  : 'bg-red-600 hover:bg-red-500 disabled:opacity-50'
              }`}
            >
              {isProcessing ? 'Guardando resolución...' : decision === 'ALLOW' ? 'Confirmar permiso' : 'Confirmar bloqueo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
