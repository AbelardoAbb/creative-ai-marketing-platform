/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Cpu, Lock, FileText, CheckCircle2 } from 'lucide-react';
import { AIAuditTrailView } from './AIAuditTrailView';
import { Tabs } from '../ui/Tabs';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

export const GovernanceView: React.FC = () => {
  const [activeTab, setActiveTab] = useState('audit-trail');

  const tabs = [
    {
      id: 'audit-trail',
      label: 'Pista de auditoría de IA',
      icon: <ShieldCheck className="w-4 h-4" />,
    },
    {
      id: 'moderation-policies',
      label: 'Políticas de moderación y seguridad',
      icon: <ShieldAlert className="w-4 h-4" />,
    },
    {
      id: 'integrity-principles',
      label: 'Directrices de integridad y cumplimiento',
      icon: <Lock className="w-4 h-4" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Navigation Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'audit-trail' && <AIAuditTrailView />}

      {activeTab === 'moderation-policies' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#0f1523] border border-[#202b42] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  Arquitectura de moderación de seguridad en dos capas
                </h3>
                <p className="text-xs text-slate-400">
                  Inspección preventiva en el Input (prompts) y verificación de conformidad en el Output (respuestas)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-[#141c2e] border border-emerald-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400">BAJO RIESGO</span>
                  <Badge variant="success" size="sm">AUTORIZACIÓN AUTOMÁTICA</Badge>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Contenido y prompts que cumplen estrictamente las directrices de conformidad ética y directrices de marca. Ejecutado inmediatamente.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#141c2e] border border-amber-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400">RIESGO MEDIO</span>
                  <Badge variant="warning" size="sm">REVISIÓN HUMANA</Badge>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Términos sensibles o afirmaciones publicitarias contundentes que requieren la inspección de un Aprobador antes del envío final.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#141c2e] border border-red-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-400">ALTO RIESGO</span>
                  <Badge variant="danger" size="sm">BLOQUEO INMEDIATO</Badge>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Discurso de odio, contenido explícito o infracciones graves. La solicitud se interrumpe en la pasarela con estado HTTP 422 y queda registrada en auditoría.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'integrity-principles' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#0f1523] border border-[#202b42] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  Principios de trazabilidad y no fabricación de datos (Fase 10B)
                </h3>
                <p className="text-xs text-slate-400">
                  Garantías de gobernanza auditables para entornos corporativos y regulados
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2 text-xs leading-relaxed text-slate-300">
              <div className="p-4 rounded-xl bg-[#141c2e] border border-[#202b42]">
                <h4 className="font-semibold text-white mb-1">1. Registro inmutable y transparencia de modelo</h4>
                <p className="text-slate-400">
                  Cada llamada de IA registra WHO, WHAT, WHEN, WHERE, WHICH PROVIDER, WHICH MODEL, WHICH OPERATION, DURATION, TOKENS y RESULT. La tabla de auditoría es append-only, sin permisos de UPDATE ni DELETE.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#141c2e] border border-[#202b42]">
                <h4 className="font-semibold text-white mb-1">2. Prohibición de métricas fabricadas</h4>
                <p className="text-slate-400">
                  Cuando una información no está disponible (ej: proveedores sin clave de API como Anthropic Claude actualmente, o proveedores de respaldo), el sistema registra explícitamente <code>TOKEN_USAGE_UNKNOWN</code> y <code>COST_UNKNOWN</code>. Nunca sustituimos valores ausentes por 0.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#141c2e] border border-[#202b42]">
                <h4 className="font-semibold text-white mb-1">3. Distinción entre duración de flujo y tiempo ahorrado</h4>
                <p className="text-slate-400">
                  La duración computacional de la IA se cronometra en milisegundos. Las estimaciones de productividad solo se computan con referencia clara a una línea base humana divulgada y auditable, sin afirmaciones infundadas de retorno financiero.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
