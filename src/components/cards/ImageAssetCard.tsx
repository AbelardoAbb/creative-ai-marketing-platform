import React from 'react';
import { Sparkles, Eye, Download, Send } from 'lucide-react';
import { PresentationImageAsset } from '../../types/ui';
import { Card } from '../ui/Card';
import { ApprovalStatusBadge } from './ApprovalStatusBadge';
import { IconButton } from '../ui/IconButton';

export interface ImageAssetCardProps {
  asset: PresentationImageAsset;
  onPreview?: (asset: PresentationImageAsset) => void;
  onSubmitApproval?: (assetId: string) => void;
}

export const ImageAssetCard: React.FC<ImageAssetCardProps> = ({
  asset,
  onPreview,
  onSubmitApproval,
}) => {
  return (
    <Card variant="default" padding="none" className="overflow-hidden group flex flex-col">
      {/* Thumbnail area */}
      <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
        <img
          src={asset.thumbnailUrl}
          alt={asset.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
        {/* Overlay badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 pointer-events-none">
          <ApprovalStatusBadge status={asset.status} size="sm" />
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900/70 backdrop-blur-xs text-white font-mono">
            {asset.aspectRatio}
          </span>
        </div>

        {/* Hover action overlay */}
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-3">
          <IconButton
            aria-label="Visualizar imagem ampliada"
            icon={<Eye className="w-4 h-4" />}
            variant="secondary"
            onClick={() => onPreview?.(asset)}
          />
          <IconButton
            aria-label="Transferir recurso"
            icon={<Download className="w-4 h-4" />}
            variant="secondary"
            onClick={() => alert(`Transferência de recurso (${asset.title}) iniciada.`)}
          />
          {asset.status === 'draft' && onSubmitApproval && (
            <IconButton
              aria-label="Enviar para aprovação"
              icon={<Send className="w-4 h-4" />}
              variant="primary"
              onClick={() => onSubmitApproval(asset.id)}
            />
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="p-3.5 flex flex-col flex-1 justify-between bg-white">
        <div>
          <span className="text-[10px] font-medium text-blue-600 uppercase tracking-wider block truncate">
            {asset.campaignName}
          </span>
          <h4 className="text-xs sm:text-sm font-semibold text-slate-900 line-clamp-1 mt-0.5">
            {asset.title}
          </h4>
        </div>

        <div className="mt-2.5 pt-2.5 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1 text-slate-500 truncate max-w-[130px]" title={asset.style}>
            <Sparkles className="w-3 h-3 text-blue-600 shrink-0" />
            <span className="truncate">{asset.style}</span>
          </span>
          <span className="text-slate-400 shrink-0 font-mono text-[10px]">
            {asset.createdAt}
          </span>
        </div>
      </div>
    </Card>
  );
};
