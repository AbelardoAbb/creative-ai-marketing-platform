import React from 'react';
import { CheckCircle, Clock, AlertTriangle, FileText } from 'lucide-react';
import { ContentStatus } from '../../types/ui';

export interface ApprovalStatusBadgeProps {
  status: ContentStatus;
  size?: 'sm' | 'md';
}

export const ApprovalStatusBadge: React.FC<ApprovalStatusBadgeProps> = ({
  status,
  size = 'sm',
}) => {
  const config = {
    draft: {
      label: 'Borrador',
      icon: <FileText className="w-3 h-3" />,
      classes: 'bg-slate-100 text-slate-700 border-slate-200',
    },
    pending: {
      label: 'Pendiente de aprobación',
      icon: <Clock className="w-3 h-3" />,
      classes: 'bg-amber-50 text-amber-800 border-amber-200',
    },
    in_review: {
      label: 'En revisión editorial',
      icon: <Clock className="w-3 h-3" />,
      classes: 'bg-blue-50 text-blue-800 border-blue-200',
    },
    approved: {
      label: 'Aprobado',
      icon: <CheckCircle className="w-3 h-3" />,
      classes: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    },
    rejected: {
      label: 'Rechazado / En ajuste',
      icon: <AlertTriangle className="w-3 h-3" />,
      classes: 'bg-red-50 text-red-800 border-red-200',
    },
  }[status] || {
    label: status,
    icon: <FileText className="w-3 h-3" />,
    classes: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[11px] gap-1.5' : 'px-2.5 py-1 text-xs gap-2';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border whitespace-nowrap ${config.classes} ${sizeClass}`}
    >
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
};
