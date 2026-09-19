/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  MessageSquare,
  ArrowRight,
  ShieldCheck,
  User,
  History,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { ContentReviewEventModel, ReviewAction, ContentStatus } from '../../types/content';

interface ContentReviewTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentId: string;
  contentTitle: string;
  getAuthHeaders: () => Record<string, string>;
}

export const ContentReviewTimelineModal: React.FC<ContentReviewTimelineModalProps> = ({
  isOpen,
  onClose,
  contentId,
  contentTitle,
  getAuthHeaders,
}) => {
  const [events, setEvents] = useState<ContentReviewEventModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !contentId) return;
    const fetchTimeline = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/contents/${contentId}/review-events`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events || []);
        }
      } catch (err) {
        console.error('Failed to load review events:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTimeline();
  }, [isOpen, contentId, getAuthHeaders]);

  const getActionBadge = (action: ReviewAction) => {
    switch (action) {
      case 'APPROVED':
        return <Badge variant="success" size="sm">APROVADO</Badge>;
      case 'REJECTED':
        return <Badge variant="danger" size="sm">REJEITADO</Badge>;
      case 'REVIEW_STARTED':
        return <Badge variant="warning" size="sm">EM REVISÃO</Badge>;
      case 'SUBMITTED_FOR_REVIEW':
        return <Badge variant="info" size="sm">SUBMETIDO</Badge>;
      case 'RESUBMITTED':
        return <Badge variant="purple" size="sm">REENVIADO</Badge>;
      case 'COMMENT_ADDED':
        return <Badge variant="neutral" size="sm">COMENTÁRIO</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{action}</Badge>;
    }
  };

  const getActionIcon = (action: ReviewAction) => {
    switch (action) {
      case 'APPROVED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'REJECTED':
        return <XCircle className="w-4 h-4 text-rose-400" />;
      case 'REVIEW_STARTED':
        return <Clock className="w-4 h-4 text-amber-400" />;
      case 'SUBMITTED_FOR_REVIEW':
      case 'RESUBMITTED':
        return <FileText className="w-4 h-4 text-indigo-400" />;
      case 'COMMENT_ADDED':
        return <MessageSquare className="w-4 h-4 text-sky-400" />;
      default:
        return <History className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Histórico de revisão e governança" size="lg">
      <div className="space-y-4">
        <div className="p-3.5 rounded-lg bg-[#161f30] border border-[#202b42] flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-200">{contentTitle}</h4>
            <p className="text-xs text-slate-400">Pista de auditoria cronológica e imutável</p>
          </div>
          <Badge variant="purple" size="sm">
            {events.length} {events.length === 1 ? 'evento registado' : 'eventos registados'}
          </Badge>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
            A carregar eventos de governança...
          </div>
        ) : events.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            Nenhum evento de revisão registado de momento.
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#202b42]">
            {events.map((evt, idx) => (
              <div key={evt.id || idx} className="relative group">
                <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#0d1320] border-2 border-[#26344d] flex items-center justify-center">
                  {getActionIcon(evt.action)}
                </div>
                <div className="p-3.5 rounded-xl bg-[#111827] border border-[#202b42] hover:border-[#2d3d5e] transition-colors space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getActionBadge(evt.action)}
                      <span className="text-xs font-semibold text-slate-200">
                        Versão #{evt.version_number}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(evt.timestamp).toLocaleString('pt-PT')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-slate-300 font-medium">{evt.actor_name}</span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#1c2538] text-slate-400">
                      {evt.actor_role}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-500 text-[11px]">
                      {evt.previous_status} → {evt.new_status}
                    </span>
                  </div>

                  {evt.notes && (
                    <div className="p-2.5 rounded-lg bg-[#0d1320] border border-[#1b263b] text-xs text-slate-300">
                      {evt.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
