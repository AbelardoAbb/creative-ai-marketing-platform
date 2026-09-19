import React from 'react';
import { FolderKanban, Users, Layers, ArrowUpRight } from 'lucide-react';
import { PresentationCampaign } from '../../types/ui';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

export interface CampaignCardProps {
  campaign: PresentationCampaign;
  onSelect?: (campaignId: string) => void;
}

export const CampaignCard: React.FC<CampaignCardProps> = ({ campaign, onSelect }) => {
  const statusBadge = {
    active: <Badge variant="success" hasDot>Ativa</Badge>,
    in_review: <Badge variant="warning" hasDot>Em revisão</Badge>,
    completed: <Badge variant="info" hasDot>Concluída</Badge>,
    draft: <Badge variant="neutral" hasDot>Rascunho</Badge>,
  }[campaign.status];

  return (
    <Card
      variant="interactive"
      padding="md"
      className="group flex flex-col justify-between"
      onClick={() => onSelect?.(campaign.id)}
    >
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-blue-600 group-hover:text-blue-700">
              <FolderKanban className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500 tracking-wider uppercase block">
                {campaign.client}
              </span>
              <h4 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                {campaign.name}
              </h4>
            </div>
          </div>
          <div className="shrink-0">{statusBadge}</div>
        </div>

        <p className="text-xs text-slate-600 line-clamp-2 mt-2 leading-relaxed">
          {campaign.objective}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            {campaign.piecesCount} peças
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            {campaign.membersCount} membros
          </span>
        </div>
        <span className="text-[11px] text-slate-500 flex items-center gap-1 group-hover:text-blue-600 transition-colors font-medium">
          Detalhes <ArrowUpRight className="w-3 h-3" />
        </span>
      </div>
    </Card>
  );
};
