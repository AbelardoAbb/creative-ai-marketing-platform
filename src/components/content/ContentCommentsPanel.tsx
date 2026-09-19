/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, User, Clock, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { ContentCommentModel } from '../../types/content';

interface ContentCommentsPanelProps {
  contentId: string;
  versionNumber: number;
  campaignId: string;
  currentUserRole?: string;
  getAuthHeaders: () => Record<string, string>;
}

export const ContentCommentsPanel: React.FC<ContentCommentsPanelProps> = ({
  contentId,
  versionNumber,
  campaignId,
  currentUserRole,
  getAuthHeaders,
}) => {
  const [comments, setComments] = useState<ContentCommentModel[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = async () => {
    if (!contentId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/contents/${contentId}/comments`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [contentId]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newCommentText.trim();
    if (!text || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/contents/${contentId}/comments`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          text,
          version_number: versionNumber,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Erro ao registar comentário.');
        return;
      }

      setNewCommentText('');
      if (data.comment) {
        setComments((prev) => [...prev, data.comment]);
      } else {
        await fetchComments();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha de rede.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[#202b42]">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-sky-400" />
          <h4 className="text-sm font-semibold text-slate-200">
            Comentários e Colaboração ({comments.length})
          </h4>
        </div>
        <span className="text-xs text-slate-500">Versão ativa #{versionNumber}</span>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Comment Form */}
      <form onSubmit={handlePostComment} className="space-y-2">
        <textarea
          value={newCommentText}
          onChange={(e) => setNewCommentText(e.target.value)}
          rows={2}
          placeholder="Deixe um comentário técnico, sugestão de ajuste ou observação para a equipa..."
          className="w-full bg-[#161f30] border border-[#26344d] rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
        />
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-slate-500">
            Identidade do autor atribuída estritamente pelo servidor
          </span>
          <Button
            variant="outline"
            size="sm"
            type="submit"
            disabled={!newCommentText.trim() || submitting}
            isLoading={submitting}
            leftIcon={<Send className="w-3.5 h-3.5" />}
          >
            Comentar
          </Button>
        </div>
      </form>

      {/* Comment List */}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {loading ? (
          <p className="text-center text-xs text-slate-500 py-6">A carregar comentários...</p>
        ) : comments.length === 0 ? (
          <div className="p-6 rounded-lg bg-[#111827] border border-[#202b42] text-center text-xs text-slate-500">
            Nenhum comentário registado ainda. Utilize esta área para alinhar decisões editoriais.
          </div>
        ) : (
          comments.map((cmt) => (
            <div
              key={cmt.id}
              className="p-3 rounded-xl bg-[#111827] border border-[#202b42] space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center text-[10px] font-bold">
                    {cmt.author_name.substring(0, 1).toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold text-slate-200">
                    {cmt.author_name}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1c2538] text-slate-400 font-medium">
                    {cmt.author_role}
                  </span>
                  <span className="text-[10px] px-1 rounded bg-[#182236] text-slate-500">
                    v{cmt.version_number}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  {new Date(cmt.created_at).toLocaleTimeString('pt-PT', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="text-xs text-slate-300 whitespace-pre-wrap pl-7">{cmt.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
