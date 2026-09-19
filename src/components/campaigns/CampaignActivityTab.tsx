/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Activity, Clock, CheckCircle, UserCheck, Shield, Sparkles } from 'lucide-react';
import { CampaignModel } from '../../types/campaign';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

export interface CampaignActivityTabProps {
  campaign: CampaignModel;
}

export const CampaignActivityTab: React.FC<CampaignActivityTabProps> = ({ campaign }) => {
  // Synthesize immutable audit log trail based on campaign history
  const activities = [
    {
      id: 'act-1',
      type: 'creation',
      title: 'Campanha Criada',
      description: `Briefing inicial registado com estado '${campaign.status}'.`,
      timestamp: campaign.created_at,
      icon: Sparkles,
      iconColor: 'text-blue-600 bg-blue-50 border-blue-200',
    },
    {
      id: 'act-2',
      type: 'team',
      title: 'Equipa Inicial Associada',
      description: 'Criador e funções iniciais associados com isolamento RLS.',
      timestamp: campaign.created_at,
      icon: UserCheck,
      iconColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    },
    {
      id: 'act-3',
      type: 'update',
      title: 'Última Atualização de Metadados',
      description: 'Diretrizes criativas e restrições sincronizadas na base de dados.',
      timestamp: campaign.updated_at,
      icon: Clock,
      iconColor: 'text-amber-600 bg-amber-50 border-amber-200',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">Linha de Tempo e Governação</h3>
            <Badge variant="neutral" size="sm">
              Auditável
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Registo de alterações de estado, atribuições de equipa e atualizações de briefing.
          </p>
        </div>
      </div>

      <div className="max-w-2xl space-y-4">
        {activities.map((act, index) => {
          const Icon = act.icon;
          return (
            <div key={act.id} className="relative flex gap-4">
              {/* Vertical connector line */}
              {index < activities.length - 1 && (
                <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-slate-200" />
              )}

              <div
                className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 z-10 ${act.iconColor}`}
              >
                <Icon className="w-4 h-4" />
              </div>

              <div className="flex-1 pb-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-medium text-slate-900">{act.title}</h4>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {new Date(act.timestamp).toLocaleString('pt-PT')}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">{act.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
