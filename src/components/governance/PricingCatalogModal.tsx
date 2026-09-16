/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, DollarSign, Cpu, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { PricingModelConfig } from '../../types/cost';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface PricingCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  pricingCatalog: PricingModelConfig[];
}

export const PricingCatalogModal: React.FC<PricingCatalogModalProps> = ({
  isOpen,
  onClose,
  pricingCatalog,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-3xl rounded-2xl bg-[#0f1523] border border-[#202b42] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#202b42]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Catálogo de precios de IA</h3>
              <p className="text-xs text-slate-400">
                Tabla oficial de costes de inferencia configurada en CostEngine
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1c273e] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-800/40 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-200/90 leading-relaxed">
              <span className="font-semibold text-white">Regla de integridad financiera:</span> Los costes
              se calculan estrictamente en base a los tokens y unidades devueltos por la API de los proveedores.
              Los proveedores bloqueados o sin credencial activa reportan estado{' '}
              <code className="px-1.5 py-0.5 rounded bg-indigo-900/60 text-indigo-300 font-mono">
                COST_UNKNOWN
              </code>
              , sin ninguna fabricación de valores monetarios.
            </div>
          </div>

          <div className="space-y-4">
            {pricingCatalog.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-xl bg-[#141c2e] border border-[#202b42] hover:border-[#2d3d5f] transition-all space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{item.model_name}</span>
                      <Badge variant="neutral" size="sm">
                        {item.provider.toUpperCase()}
                      </Badge>
                      <Badge variant={item.billing_mode === 'token_based' ? 'info' : 'purple'} size="sm">
                        {item.billing_mode === 'token_based' ? 'Por token' : 'Por unidad'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">{item.model}</p>
                  </div>
                  <Badge variant={item.is_active ? 'success' : 'neutral'} size="sm">
                    {item.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#1c273e]">
                  {item.billing_mode === 'token_based' ? (
                    <>
                      <div className="p-2.5 rounded-lg bg-[#0d131f] border border-[#1a2337]">
                        <span className="text-[11px] text-slate-400">Entrada (Prompt)</span>
                        <div className="text-xs font-mono font-semibold text-emerald-400 mt-0.5">
                          ${(item.input_rate_per_unit || 0) * 1000} / 1K tokens
                          <div className="text-[10px] text-slate-500 font-normal">
                            (${((item.input_rate_per_unit || 0) * 1000000).toFixed(2)} / 1M)
                          </div>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[#0d131f] border border-[#1a2337]">
                        <span className="text-[11px] text-slate-400">Salida (Completion)</span>
                        <div className="text-xs font-mono font-semibold text-emerald-400 mt-0.5">
                          ${(item.output_rate_per_unit || 0) * 1000} / 1K tokens
                          <div className="text-[10px] text-slate-500 font-normal">
                            (${((item.output_rate_per_unit || 0) * 1000000).toFixed(2)} / 1M)
                          </div>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[#0d131f] border border-[#1a2337]">
                        <span className="text-[11px] text-slate-400">Moneda</span>
                        <div className="text-xs font-mono font-semibold text-slate-200 mt-0.5">
                          {item.currency}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-2.5 rounded-lg bg-[#0d131f] border border-[#1a2337] sm:col-span-2">
                        <span className="text-[11px] text-slate-400">Coste por generación visual</span>
                        <div className="text-xs font-mono font-semibold text-purple-400 mt-0.5">
                          ${(item.fixed_rate_per_generation || 0).toFixed(4)} USD / imagen
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[#0d131f] border border-[#1a2337]">
                        <span className="text-[11px] text-slate-400">Moneda</span>
                        <div className="text-xs font-mono font-semibold text-slate-200 mt-0.5">
                          {item.currency}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                  <span>Operaciones: {item.operations.join(', ')}</span>
                  <span>Vigencia: {item.effective_from}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[#202b42] flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
};
