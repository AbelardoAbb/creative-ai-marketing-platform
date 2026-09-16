import React from 'react';
import { PresentationActivityItem } from '../../types/ui';
import { Avatar } from '../ui/Avatar';
import { CheckCircle2, AlertCircle, Sparkles, MessageSquare, Send } from 'lucide-react';

export interface ActivityItemProps {
  activity: PresentationActivityItem;
}

export const ActivityItem: React.FC<ActivityItemProps> = ({ activity }) => {
  const iconConfig = {
    approval: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
    rejection: <AlertCircle className="w-3.5 h-3.5 text-red-600" />,
    ai_generation: <Sparkles className="w-3.5 h-3.5 text-blue-600" />,
    comment: <MessageSquare className="w-3.5 h-3.5 text-blue-500" />,
    creation: <Send className="w-3.5 h-3.5 text-amber-600" />,
  }[activity.type];

  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-b-0 group">
      <Avatar
        name={activity.userName}
        avatarUrl={activity.avatarUrl}
        role={activity.userRole}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-700 leading-normal">
          <span className="font-semibold text-slate-900">{activity.userName}</span>{' '}
          <span className="text-slate-500">{activity.action}</span>{' '}
          <span className="font-medium text-blue-700">"{activity.targetTitle}"</span>
        </p>
        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            {iconConfig}
            <span>{activity.campaignName}</span>
          </span>
          <span>•</span>
          <span>{activity.timestamp}</span>
        </div>
      </div>
    </div>
  );
};
