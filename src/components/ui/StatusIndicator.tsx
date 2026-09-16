import React from 'react';
import { ContentStatus } from '../../types/ui';

export interface StatusIndicatorProps {
  status: ContentStatus | 'active' | 'completed';
  size?: 'sm' | 'md';
  showText?: boolean;
  className?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  size = 'sm',
  showText = true,
  className = '',
}) => {
  const config = {
    draft: { label: 'Borrador', color: 'bg-slate-400', text: 'text-slate-600' },
    pending: { label: 'Pendiente', color: 'bg-amber-500', text: 'text-amber-700' },
    in_review: { label: 'En revisión', color: 'bg-blue-500', text: 'text-blue-700' },
    approved: { label: 'Aprobado', color: 'bg-emerald-600', text: 'text-emerald-700' },
    rejected: { label: 'Rechazado', color: 'bg-red-600', text: 'text-red-700' },
    active: { label: 'Activa', color: 'bg-emerald-600', text: 'text-emerald-700' },
    completed: { label: 'Completada', color: 'bg-blue-600', text: 'text-blue-700' },
  }[status] || { label: status, color: 'bg-slate-400', text: 'text-slate-600' };

  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return (
    <div className={`inline-flex items-center gap-1.5 select-none ${className}`}>
      <span className={`${dotSize} rounded-full ${config.color} shrink-0`} />
      {showText && <span className={`text-xs font-medium ${config.text}`}>{config.label}</span>}
    </div>
  );
};
