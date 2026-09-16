import React from 'react';
import { PenTool, GitCompare, FileText, ArrowRight } from 'lucide-react';
import { PresentationTextContent } from '../../types/ui';
import { Card } from '../ui/Card';
import { ApprovalStatusBadge } from './ApprovalStatusBadge';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export interface TextContentCardProps {
  content: PresentationTextContent;
  onOpenEditor?: (contentId: string) => void;
}

export const TextContentCard: React.FC<TextContentCardProps> = ({ content, onOpenEditor }) => {
  return (
    <Card variant="interactive" padding="md" className="flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-blue-600">
              <PenTool className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500 tracking-wider uppercase block">
                {content.campaignName}
              </span>
              <h4 className="text-sm font-semibold text-slate-900 line-clamp-1">
                {content.title}
              </h4>
            </div>
          </div>
          <ApprovalStatusBadge status={content.status} size="sm" />
        </div>

        <div className="flex items-center gap-2 mt-2 mb-3">
          <Badge variant="blue" size="sm">
            {content.channel}
          </Badge>
          <span className="text-[11px] font-mono text-slate-600 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
            {content.version}
          </span>
        </div>

        <p className="text-xs text-slate-700 italic line-clamp-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200 leading-relaxed">
          {content.excerpt}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1.5 text-slate-500">
          <FileText className="w-3.5 h-3.5 text-slate-400" />
          Por {content.creatorName}
        </span>
        <Button
          size="sm"
          variant="outline"
          rightIcon={<ArrowRight className="w-3 h-3" />}
          onClick={() => onOpenEditor?.(content.id)}
        >
          Editor comparativo
        </Button>
      </div>
    </Card>
  );
};
