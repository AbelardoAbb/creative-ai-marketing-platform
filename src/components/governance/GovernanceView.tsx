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
      label: 'Trilha de auditoria de IA',
      icon: <ShieldCheck className="w-4 h-4" />,
    },
    {
      id: 'moderation-policies',
      label: 'Políticas de moderação e segurança',
      icon: <ShieldAlert className="w-4 h-4" />,
    },
    {
      id: 'integrity-principles',
      label: 'Diretrizes de integridade e conformidade',
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
                  Arquitetura de moderação de segurança em duas camadas
                </h3>
                <p className="text-xs text-slate-400">
                  Inspeção preventiva na Entrada (prompts) e verificação de conformidade na Saída (respostas)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-[#141c2e] border border-emerald-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400">BAIXO RISCO</span>
                  <Badge variant="success" size="sm">AUTORIZAÇÃO AUTOMÁTICA</Badge>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Conteúdo e prompts que cumprem rigorosamente as diretrizes de conformidade ética e de marca. Executado imediatamente.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#141c2e] border border-amber-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400">RISCO MÉDIO</span>
                  <Badge variant="warning" size="sm">REVISÃO HUMANA</Badge>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Termos sensíveis ou alegações publicitárias expressivas que requerem a inspeção de um Revisor antes do envio final.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#141c2e] border border-red-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-400">ALTO RISCO</span>
                  <Badge variant="danger" size="sm">BLOQUEIO IMEDIATO</Badge>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Discurso de ódio, conteúdo explícito ou infrações graves. A solicitação é interrompida no gateway com código HTTP 422 e fica registada em auditoria.
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
                  Princípios de rastreabilidade e não fabricação de dados (Fase 10B)
                </h3>
                <p className="text-xs text-slate-400">
                  Garantias de governação auditáveis para ambientes corporativos e regulamentados
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2 text-xs leading-relaxed text-slate-300">
              <div className="p-4 rounded-xl bg-[#141c2e] border border-[#202b42]">
                <h4 className="font-semibold text-white mb-1">1. Registo imutável e transparência de modelo</h4>
                <p className="text-slate-400">
                  Cada chamada de IA regista QUEM, O QUÊ, QUANDO, ONDE, QUAL FORNECEDOR, QUAL MODELO, QUAL OPERAÇÃO, DURAÇÃO, TOKENS e RESULTADO. A tabela de auditoria é append-only, sem permissões de UPDATE nem DELETE.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#141c2e] border border-[#202b42]">
                <h4 className="font-semibold text-white mb-1">2. Proibição de métricas fabricadas</h4>
                <p className="text-slate-400">
                  Quando uma informação não está disponível (ex: fornecedores sem chave de API como Anthropic Claude atualmente, ou fornecedores de contingência), o sistema regista explicitamente <code>TOKEN_USAGE_UNKNOWN</code> e <code>COST_UNKNOWN</code>. Nunca substituímos valores ausentes por 0.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#141c2e] border border-[#202b42]">
                <h4 className="font-semibold text-white mb-1">3. Distinção entre duração de fluxo e tempo poupado</h4>
                <p className="text-slate-400">
                  A duração computacional da IA é cronometrada em milissegundos. As estimativas de produtividade só são calculadas com referência clara a uma linha de base humana divulgada e auditável, sem alegações infundadas de retorno financeiro.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
