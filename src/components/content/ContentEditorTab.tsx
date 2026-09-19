/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  PenTool,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  History,
  FileText,
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Maximize2,
  Minimize2,
  Sliders,
  Star,
  Layers,
  ArrowRight,
  ShieldCheck,
  Info,
  X,
  Plus,
  MessageSquare,
  XCircle,
  FileWarning,
  RotateCcw,
} from 'lucide-react';
import {
  ContentModel,
  ContentVersionModel,
  ContentOperation,
  ContentChannel,
  ContentStatus,
  ClaudeGenerationResult,
  AIGenerationLogModel,
} from '../../types/content';
import { CampaignModel } from '../../types/campaign';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { ContentApprovalModal } from './ContentApprovalModal';
import { ContentRejectionModal } from './ContentRejectionModal';
import { ContentReviewTimelineModal } from './ContentReviewTimelineModal';
import { ContentCommentsPanel } from './ContentCommentsPanel';

export interface ContentEditorTabProps {
  campaign: CampaignModel;
  initialContentId?: string | null;
}

const SUPPORTED_CHANNELS: ContentChannel[] = [
  'Social Media',
  'Advertisement',
  'Email',
  'Website',
  'General',
];

export const ContentEditorTab: React.FC<ContentEditorTabProps> = ({
  campaign,
  initialContentId,
}) => {
  const { user, session } = useAuth();

  // Selected or Active Content Document
  const [contents, setContents] = useState<ContentModel[]>([]);
  const [activeContent, setActiveContent] = useState<ContentModel | null>(null);
  const [loadingContents, setLoadingContents] = useState(true);

  // Editor Inputs
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState<ContentChannel>('Social Media');
  const [sourceText, setSourceText] = useState('');
  const [userInstructions, setUserInstructions] = useState('');
  const [toneOverride, setToneOverride] = useState('');
  const [targetAudienceOverride, setTargetAudienceOverride] = useState('');

  // AI Output & State
  const [aiOutput, setAiOutput] = useState<string>('');
  const [aiResult, setAiResult] = useState<ClaudeGenerationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeOperation, setActiveOperation] = useState<ContentOperation | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedVariationIndex, setSelectedVariationIndex] = useState<number | null>(null);

  // Provider Status Check
  const [claudeStatus, setClaudeStatus] = useState<{
    configured: boolean;
    status: 'READY' | 'BLOCKED';
    provider: string;
    model: string;
    message: string;
  } | null>(null);

  // Modals & Panels
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [isAuditLogsOpen, setIsAuditLogsOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AIGenerationLogModel[]>([]);
  const [isNewContentModalOpen, setIsNewContentModalOpen] = useState(false);
  const [newContentTitle, setNewContentTitle] = useState('');
  const [newContentChannel, setNewContentChannel] = useState<ContentChannel>('Social Media');

  // Human Evaluation
  const [humanRating, setHumanRating] = useState<number>(activeContent?.rating || 0);
  const [humanFeedback, setHumanFeedback] = useState<string>(activeContent?.evaluation_feedback || '');
  const [isSavingEvaluation, setIsSavingEvaluation] = useState(false);
  const [evaluationSaved, setEvaluationSaved] = useState(false);

  // Phase 9: Workflow & Collaboration State
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isWorkflowLoading, setIsWorkflowLoading] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
  const [isCommentsPanelOpen, setIsCommentsPanelOpen] = useState(false);
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [workflowFeedback, setWorkflowFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Helper for auth headers
  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-id': user?.id || 'anonymous',
      'x-user-role': user?.role || 'Copywriter',
      'x-user-email': user?.email || '',
      'x-user-name': user?.displayName || '',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  };

  // 1. Fetch Claude Status
  const fetchClaudeStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/claude/status', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setClaudeStatus(data);
      }
    } catch {
      // Network probe
    }
  }, []);

  // 2. Fetch Campaign Contents
  const fetchContents = useCallback(async () => {
    setLoadingContents(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/contents`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const list: ContentModel[] = data.contents || [];
        setContents(list);
        if (list.length > 0) {
          if (initialContentId) {
            const match = list.find((c) => c.id === initialContentId);
            if (match) {
              selectContent(match);
              return;
            }
          }
          if (!activeContent) {
            selectContent(list[0]);
          }
        }
      }
    } catch (err: unknown) {
      console.error('Failed to load contents:', err);
    } finally {
      setLoadingContents(false);
    }
  }, [campaign.id]);

  // 3. Fetch Audit Logs
  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/content-logs`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch (err: unknown) {
      console.error('Failed to fetch audit logs:', err);
    }
  };

  useEffect(() => {
    fetchClaudeStatus();
    fetchContents();
  }, [fetchClaudeStatus, fetchContents]);

  // Select a content document
  const selectContent = (content: ContentModel) => {
    setActiveContent(content);
    setTitle(content.title);
    setChannel(content.channel);
    setSourceText(content.content);
    setAiOutput('');
    setAiResult(null);
    setErrorMessage(null);
    setHumanRating(content.rating || 0);
    setHumanFeedback(content.evaluation_feedback || '');
  };

  // Handle Claude Operation
  const handleProcessOperation = async (operation: ContentOperation) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setActiveOperation(operation);
    setErrorMessage(null);
    setSelectedVariationIndex(null);

    try {
      const res = await fetch('/api/content/process', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          campaignId: campaign.id,
          contentId: activeContent?.id,
          operation,
          channel,
          sourceContent: sourceText,
          instructions: userInstructions,
          targetAudience: targetAudienceOverride || undefined,
          tone: toneOverride || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.statusCode === 'MODERATION_BLOCKED') {
          setErrorMessage(
            `Moderação de Segurança IA: Pedido bloqueado (${data.moderation?.riskLevel || 'HIGH_RISK'}). ${data.message || ''}`
          );
        } else if (data.statusCode === 'REQUIRES_HUMAN_REVIEW') {
          setErrorMessage(
            `Moderação de Segurança IA: Conteúdo retido para revisão humana (${data.moderation?.riskLevel || 'MEDIUM_RISK'}). ${data.message || ''}`
          );
        } else if (data.statusCode === 'BLOCKED') {
          setErrorMessage(
            'O serviço Claude está em estado BLOCKED: ANTHROPIC_API_KEY não configurada no servidor. Não são permitidas simulações nem conteúdos artificiais falsos.'
          );
        } else if (data.statusCode === 'RATE_LIMITED') {
          setErrorMessage('Limite de pedidos do Claude atingido. Tente novamente dentro de momentos.');
        } else if (data.statusCode === 'TIMEOUT') {
          setErrorMessage('Tempo limite excedido na comunicação com a API da Anthropic.');
        } else {
          setErrorMessage(data.message || 'Erro ao processar conteúdo com o Claude.');
        }
        if (data.result) {
          setAiResult(data.result);
        }
        return;
      }

      const result: ClaudeGenerationResult = data.result;
      setAiResult(result);
      setAiOutput(result.generatedContent || '');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Falha de rede ao comunicar com o servidor.');
    } finally {
      setIsProcessing(false);
      setActiveOperation(null);
    }
  };

  // Create New Content Document
  const handleCreateNewContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContentTitle.trim()) return;

    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/contents`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: newContentTitle.trim(),
          channel: newContentChannel,
          content: '',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const created: ContentModel = data.content;
        setContents((prev) => [created, ...prev]);
        selectContent(created);
        setIsNewContentModalOpen(false);
        setNewContentTitle('');
      }
    } catch (err) {
      console.error('Failed to create content:', err);
    }
  };

  // Accept AI Output as New Version
  const handleAcceptAsVersion = async () => {
    if (!activeContent || !aiOutput.trim()) return;

    try {
      const res = await fetch(`/api/contents/${activeContent.id}/versions`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          content: aiOutput,
          provider: 'anthropic',
          model: aiResult?.model || 'claude-3-5-sonnet-20241022',
          operation: aiResult?.operation || 'generate',
          notes: `Aceite a partir da geração Claude (${aiResult?.operation || 'assistida'})`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const updated: ContentModel = data.content;
        setActiveContent(updated);
        setSourceText(updated.content);
        setContents((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setAiOutput('');
        setAiResult(null);
      }
    } catch (err) {
      console.error('Failed to save new version:', err);
    }
  };

  // Save manual edits to original text as a human version
  const handleSaveManualEdit = async () => {
    if (!activeContent || !sourceText.trim()) return;

    try {
      const res = await fetch(`/api/contents/${activeContent.id}/versions`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          content: sourceText,
          notes: 'Edição manual do redator',
          status: 'HUMAN_EDITED',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const updated: ContentModel = data.content;
        setActiveContent(updated);
        setContents((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      }
    } catch (err) {
      console.error('Failed to save manual edit:', err);
    }
  };

  // Restore earlier version
  const handleRestoreVersion = async (targetVersion: number) => {
    if (!activeContent) return;

    try {
      const res = await fetch(`/api/contents/${activeContent.id}/restore`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ targetVersionNumber: targetVersion }),
      });

      if (res.ok) {
        const data = await res.json();
        const updated: ContentModel = data.content;
        setActiveContent(updated);
        setSourceText(updated.content);
        setContents((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setIsVersionHistoryOpen(false);
      }
    } catch (err) {
      console.error('Failed to restore version:', err);
    }
  };

  // Submit human evaluation
  const handleSaveEvaluation = async () => {
    if (!activeContent || humanRating < 1) return;
    setIsSavingEvaluation(true);

    try {
      const res = await fetch(`/api/contents/${activeContent.id}/evaluate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          rating: humanRating,
          feedback: humanFeedback,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const updated: ContentModel = data.content;
        setActiveContent(updated);
        setContents((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setEvaluationSaved(true);
        setTimeout(() => setEvaluationSaved(false), 3000);
      }
    } catch (err) {
      console.error('Failed to evaluate content:', err);
    } finally {
      setIsSavingEvaluation(false);
    }
  };

  // Submit content for Approver review
  const handleSubmitForReview = async () => {
    if (!activeContent) return;
    setIsSubmittingReview(true);
    setWorkflowFeedback(null);

    try {
      const res = await fetch(`/api/contents/${activeContent.id}/submit-review`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      const data = await res.json();
      if (!res.ok) {
        setWorkflowFeedback({ type: 'error', message: data.message || 'Erro ao enviar para revisão.' });
        return;
      }

      const updated: ContentModel = data.content;
      setActiveContent(updated);
      setContents((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setWorkflowFeedback({ type: 'success', message: 'Conteúdo enviado com sucesso para a fila de revisão!' });
    } catch (err: unknown) {
      setWorkflowFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Falha de comunicação com o servidor.',
      });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Start active review
  const handleStartReview = async () => {
    if (!activeContent) return;
    setIsWorkflowLoading(true);
    setWorkflowFeedback(null);

    try {
      const res = await fetch(`/api/contents/${activeContent.id}/start-review`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      const data = await res.json();
      if (!res.ok) {
        setWorkflowFeedback({ type: 'error', message: data.message || 'Erro ao iniciar revisão.' });
        return;
      }

      const updated: ContentModel = data.content;
      setActiveContent(updated);
      setContents((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setWorkflowFeedback({ type: 'success', message: 'Revisão formal iniciada.' });
    } catch (err: unknown) {
      setWorkflowFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Falha de comunicação.',
      });
    } finally {
      setIsWorkflowLoading(false);
    }
  };

  // Confirm formal approval
  const handleConfirmApprove = async (comment?: string) => {
    if (!activeContent) return;
    setIsWorkflowLoading(true);
    setWorkflowFeedback(null);

    try {
      const res = await fetch(`/api/contents/${activeContent.id}/approve`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ comment }),
      });

      const data = await res.json();
      if (!res.ok) {
        setWorkflowFeedback({ type: 'error', message: data.message || 'Erro ao aprovar conteúdo.' });
        return;
      }

      const updated: ContentModel = data.content;
      setActiveContent(updated);
      setContents((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setIsApprovalModalOpen(false);
      setWorkflowFeedback({
        type: 'success',
        message: `Conteúdo "${updated.title}" aprovado formalmente!`,
      });
    } catch (err: unknown) {
      setWorkflowFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Falha de comunicação.',
      });
    } finally {
      setIsWorkflowLoading(false);
    }
  };

  // Confirm formal rejection with required justification
  const handleConfirmReject = async (reason: string) => {
    if (!activeContent) return;
    setIsWorkflowLoading(true);
    setWorkflowFeedback(null);

    try {
      const res = await fetch(`/api/contents/${activeContent.id}/reject`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason }),
      });

      const data = await res.json();
      if (!res.ok) {
        setWorkflowFeedback({ type: 'error', message: data.message || 'Erro ao rejeitar conteúdo.' });
        return;
      }

      const updated: ContentModel = data.content;
      setActiveContent(updated);
      setContents((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setIsRejectionModalOpen(false);
      setWorkflowFeedback({
        type: 'success',
        message: 'Conteúdo rejeitado com pedido de revisão enviado ao autor.',
      });
    } catch (err: unknown) {
      setWorkflowFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Falha de comunicação.',
      });
    } finally {
      setIsWorkflowLoading(false);
    }
  };

  // Creator revision of rejected content (creates new version, preserves history)
  const handleReviseContent = async (notes?: string) => {
    if (!activeContent) return;
    setIsWorkflowLoading(true);
    setWorkflowFeedback(null);

    try {
      const res = await fetch(`/api/contents/${activeContent.id}/revise`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          content: sourceText,
          notes: notes || 'Revisão após comentários do aprovador',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setWorkflowFeedback({ type: 'error', message: data.message || 'Erro ao criar nova versão revista.' });
        return;
      }

      const updated: ContentModel = data.content;
      setActiveContent(updated);
      setSourceText(updated.content);
      setContents((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setIsRevisionModalOpen(false);
      setRevisionNotes('');
      setWorkflowFeedback({
        type: 'success',
        message: `Nova versão #${updated.current_version} gerada a partir da revisão. Histórico anterior preservado intacto.`,
      });
    } catch (err: unknown) {
      setWorkflowFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Falha de comunicação.',
      });
    } finally {
      setIsWorkflowLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const getStatusBadge = (status: ContentStatus) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="success" size="sm">APROVADO</Badge>;
      case 'REJECTED':
        return <Badge variant="danger" size="sm">REJEITADO</Badge>;
      case 'UNDER_REVIEW':
        return <Badge variant="warning" size="sm">EM REVISÃO</Badge>;
      case 'READY_FOR_REVIEW':
        return <Badge variant="info" size="sm">PRONTO PARA REVISÃO</Badge>;
      case 'HUMAN_EDITED':
        return <Badge variant="purple" size="sm">EDITADO MANUALMENTE</Badge>;
      case 'AI_GENERATED':
        return <Badge variant="neutral" size="sm">GERADO POR IA</Badge>;
      case 'DRAFT':
      default:
        return <Badge variant="neutral" size="sm">RASCUNHO</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Document Switcher & Claude Status */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <PenTool className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  Editor de Conteúdo e Claude IA
                  {activeContent && getStatusBadge(activeContent.status)}
                </h2>
                <p className="text-xs text-slate-400">
                  Criação e transformação de copy orientada ao briefing estruturado
                </p>
              </div>
            </div>

            {/* Document Selector */}
            {contents.length > 0 && (
              <div className="flex items-center gap-2 ml-0 sm:ml-4">
                <span className="text-xs text-slate-400">Documento:</span>
                <select
                  value={activeContent?.id || ''}
                  onChange={(e) => {
                    const found = contents.find((c) => c.id === e.target.value);
                    if (found) selectContent(found);
                  }}
                  className="bg-[#161f30] border border-[#26344d] rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {contents.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.channel}) — v{c.current_version}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsNewContentModalOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Novo texto
            </Button>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Claude Connection Badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono border ${
                claudeStatus?.status === 'READY'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              }`}
              title={claudeStatus?.message}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  claudeStatus?.status === 'READY' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span>
                Claude 3.5 Sonnet: {claudeStatus?.status === 'READY' ? 'ATIVO' : 'BLOQUEADO (Sem Chave)'}
              </span>
            </div>

            {activeContent && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsVersionHistoryOpen(true)}
                  leftIcon={<History className="w-4 h-4" />}
                >
                  Versões ({activeContent.versions?.length || activeContent.current_version})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    fetchAuditLogs();
                    setIsAuditLogsOpen(true);
                  }}
                  leftIcon={<ShieldCheck className="w-4 h-4" />}
                >
                  Auditoria
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* PHASE 9: Review & Governance Action Bar */}
      {activeContent && (
        <Card className="p-4 sm:p-5 space-y-4 border-indigo-500/20 bg-[#0d1320]">
          {/* Header & Status Stepper */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-[#1f2c44]">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-300">Fluxo de Aprovação:</span>
                {getStatusBadge(activeContent.status)}
                {activeContent.moderation_status && (
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded font-medium inline-flex items-center gap-1 ${
                      activeContent.moderation_status === 'BLOCKED'
                        ? 'bg-red-500/10 text-red-300 border border-red-500/30'
                        : activeContent.moderation_status === 'REQUIRES_HUMAN_REVIEW'
                        ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    Moderação: {activeContent.moderation_status}
                  </span>
                )}
                <span className="text-[11px] text-slate-400 font-mono">
                  Versão #{activeContent.current_version}
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-[11px] text-slate-400">
                  Criado por: <strong className="text-slate-200">{activeContent.created_by_name}</strong> ({activeContent.created_by_role})
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Governança human-in-the-loop: a IA nunca aprova automaticamente. O autor não pode aprovar a sua própria peça.
              </p>
            </div>

            {/* Workflow Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCommentsPanelOpen(!isCommentsPanelOpen)}
                leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
              >
                {isCommentsPanelOpen ? 'Ocultar comentários' : 'Comentários'}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsTimelineModalOpen(true)}
                leftIcon={<History className="w-3.5 h-3.5" />}
              >
                Histórico de revisão
              </Button>

              {/* Submit for Review: for DRAFT, AI_GENERATED, HUMAN_EDITED, REJECTED */}
              {['DRAFT', 'AI_GENERATED', 'HUMAN_EDITED', 'REJECTED'].includes(activeContent.status) && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSubmitForReview}
                  disabled={!sourceText.trim() || isSubmittingReview || isWorkflowLoading}
                  isLoading={isSubmittingReview}
                  leftIcon={<Send className="w-3.5 h-3.5" />}
                >
                  Enviar para revisão
                </Button>
              )}

              {/* Start Review: for READY_FOR_REVIEW and Approvers */}
              {activeContent.status === 'READY_FOR_REVIEW' && (user?.role === 'Approver' || user?.role === 'Administrator') && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleStartReview}
                  disabled={isWorkflowLoading}
                  isLoading={isWorkflowLoading}
                  leftIcon={<Clock className="w-3.5 h-3.5" />}
                >
                  Iniciar revisão
                </Button>
              )}

              {/* Decide (Approve / Reject): for READY_FOR_REVIEW or UNDER_REVIEW and Approvers */}
              {['READY_FOR_REVIEW', 'UNDER_REVIEW'].includes(activeContent.status) && (user?.role === 'Approver' || user?.role === 'Administrator') && (
                <>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setIsRejectionModalOpen(true)}
                    disabled={isWorkflowLoading}
                    leftIcon={<XCircle className="w-3.5 h-3.5" />}
                  >
                    Rejeitar
                  </Button>

                  <div className="relative group">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setIsApprovalModalOpen(true)}
                      disabled={user?.id === activeContent.created_by || isWorkflowLoading}
                      leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    >
                      Aprovar
                    </Button>
                    {user?.id === activeContent.created_by && (
                      <div className="absolute right-0 bottom-full mb-1.5 hidden group-hover:block z-30 w-64 p-2 rounded-md bg-[#161f30] border border-amber-500/30 text-[11px] text-amber-300 shadow-xl">
                        <AlertTriangle className="w-3.5 h-3.5 inline mr-1 text-amber-400" />
                        <strong>Violação de Governança:</strong> É o autor desta peça e não pode aprovar o seu próprio conteúdo.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Governance Warning for Creator */}
          {user?.id === activeContent.created_by && ['READY_FOR_REVIEW', 'UNDER_REVIEW'].includes(activeContent.status) && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                <strong>Regra de Segregação de Funções:</strong> É o autor registado desta peça. Para garantir a conformidade, a aprovação final requer a avaliação de outro membro com perfil de Aprovador.
              </span>
            </div>
          )}

          {/* Rejection Alert & Quick Revision Action */}
          {activeContent.status === 'REJECTED' && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-semibold text-rose-300">
                  <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>Conteúdo rejeitado por {activeContent.reviewed_by_name || 'Aprovador'} ({activeContent.reviewed_at ? new Date(activeContent.reviewed_at).toLocaleString('pt-PT') : ''})</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRevisionModalOpen(true)}
                  leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                >
                  Criar revisão (Nova versão)
                </Button>
              </div>
              {activeContent.rejection_reason && (
                <div className="p-2.5 rounded-lg bg-[#0d1320] border border-[#1b263b] text-slate-200 font-sans">
                  <strong className="text-rose-300 block mb-0.5">Justificação do Aprovador:</strong>
                  {activeContent.rejection_reason}
                </div>
              )}
            </div>
          )}

          {/* Approved Banner */}
          {activeContent.status === 'APPROVED' && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-emerald-200">Peça Aprovada Formalmente</span> por {activeContent.reviewed_by_name || 'Revisor'} em {activeContent.reviewed_at ? new Date(activeContent.reviewed_at).toLocaleString('pt-PT') : 'data recente'}.
                  <p className="text-[11px] text-emerald-400/80 mt-0.5">Esta versão está libertada e homologada para publicação no canal {activeContent.channel}.</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsRevisionModalOpen(true)}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Nova revisão
              </Button>
            </div>
          )}

          {/* Workflow Feedback Message */}
          {workflowFeedback && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center justify-between gap-2 ${
                workflowFeedback.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {workflowFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                )}
                <span>{workflowFeedback.message}</span>
              </div>
              <button
                onClick={() => setWorkflowFeedback(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Expandable Collaboration Comments Panel */}
          {isCommentsPanelOpen && (
            <div className="pt-3 border-t border-[#1f2c44]">
              <ContentCommentsPanel
                contentId={activeContent.id}
                versionNumber={activeContent.current_version}
                campaignId={campaign.id}
                currentUserRole={user?.role}
                getAuthHeaders={getAuthHeaders}
              />
            </div>
          )}
        </Card>
      )}

      {/* Claude BLOCKED Informational Banner (Honest, no fake generation) */}
      {claudeStatus?.status === 'BLOCKED' && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-300">
              Anthropic Claude está em estado BLOCKED (Sem chave de API configurada)
            </p>
            <p className="text-slate-300">
              A variável <code className="bg-[#131b2b] px-1 py-0.5 rounded text-amber-200">ANTHROPIC_API_KEY</code> não foi detetada no servidor. Em estrita conformidade com as normas da plataforma, o sistema não realiza simulações falsas nem gera textos artificiais simulados. Para utilizar o motor de IA Claude, adicione a sua chave nas definições.
            </p>
          </div>
        </div>
      )}

      {/* Error notification */}
      {errorMessage && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-slate-400 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Side-by-Side Two-Column AI Content Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN: Source / Author Draft */}
        <div className="space-y-4">
          <Card className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#202b42]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-semibold text-slate-200">
                  Texto original / Rascunho do redator
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">
                  {sourceText.length} carateres · {sourceText.trim() ? sourceText.trim().split(/\s+/).length : 0} palavras
                </span>
                {activeContent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSaveManualEdit}
                    disabled={!sourceText.trim() || isProcessing}
                  >
                    Guardar rascunho
                  </Button>
                )}
              </div>
            </div>

            {/* Title & Channel Config */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Título da peça
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Manifesto de Lançamento"
                  className="w-full bg-[#161f30] border border-[#26344d] rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Canal de destino
                </label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as ContentChannel)}
                  className="w-full bg-[#161f30] border border-[#26344d] rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {SUPPORTED_CHANNELS.map((ch) => (
                    <option key={ch} value={ch}>
                      {ch}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Main Textarea */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Corpo do conteúdo
              </label>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Introduza o texto original da peça aqui ou utilize a geração direta com o Claude a partir do briefing estruturado..."
                rows={12}
                className="w-full bg-[#131b2b] border border-[#26344d] rounded-md p-3 text-xs sm:text-sm text-slate-200 font-sans leading-relaxed focus:outline-none focus:border-indigo-500 resize-y"
              />
            </div>

            {/* Campaign Context Reminder (Accordion/Pills) */}
            <div className="p-3 rounded-lg bg-[#141d2e] border border-[#202b42] text-xs space-y-1.5">
              <div className="text-slate-400 font-medium flex items-center justify-between">
                <span>Contexto automático do briefing:</span>
                <span className="text-[11px] text-indigo-400">{campaign.name}</span>
              </div>
              <div className="text-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div>
                  <strong className="text-slate-400">Público:</strong> {campaign.target_audience || 'Geral'}
                </div>
                <div>
                  <strong className="text-slate-400">Tom:</strong> {campaign.tone_of_voice || 'Profissional'}
                </div>
                <div>
                  <strong className="text-slate-400">Mensagem:</strong> {campaign.key_message || 'N/A'}
                </div>
                <div>
                  <strong className="text-slate-400">Idioma:</strong> {campaign.language || 'pt-PT'}
                </div>
              </div>
            </div>

            {/* Contextual Overrides & Specific Instructions */}
            <div className="space-y-2 pt-2 border-t border-[#202b42]">
              <label className="block text-xs font-medium text-slate-400">
                Instruções específicas / Prompt do redator
              </label>
              <textarea
                value={userInstructions}
                onChange={(e) => setUserInstructions(e.target.value)}
                placeholder="Ex.: Enfatize a garantia científica de 30 dias e adicione uma chamada para ação persuasiva para as Histórias do Instagram..."
                rows={2}
                className="w-full bg-[#161f30] border border-[#26344d] rounded-md px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Operations Bar */}
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-semibold text-slate-300">
                Ações de conteúdo Claude:
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isProcessing}
                  onClick={() => handleProcessOperation('generate')}
                  leftIcon={activeOperation === 'generate' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                >
                  Gerar conteúdo
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={isProcessing || !sourceText.trim()}
                  onClick={() => handleProcessOperation('rewrite')}
                  leftIcon={activeOperation === 'rewrite' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                >
                  Reescrever
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={isProcessing || !sourceText.trim()}
                  onClick={() => handleProcessOperation('expand')}
                  leftIcon={<Maximize2 className="w-3.5 h-3.5" />}
                >
                  Expandir
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={isProcessing || !sourceText.trim()}
                  onClick={() => handleProcessOperation('summarize')}
                  leftIcon={<Minimize2 className="w-3.5 h-3.5" />}
                >
                  Resumir
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={isProcessing || !sourceText.trim()}
                  onClick={() => handleProcessOperation('correct')}
                  leftIcon={<Check className="w-3.5 h-3.5" />}
                >
                  Corrigir
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={isProcessing || !sourceText.trim()}
                  onClick={() => handleProcessOperation('variations')}
                  leftIcon={<Sliders className="w-3.5 h-3.5" />}
                >
                  Variações
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={isProcessing || !sourceText.trim()}
                  onClick={() => handleProcessOperation('adapt_channel')}
                  leftIcon={<ArrowRight className="w-3.5 h-3.5" />}
                >
                  Adaptar canal
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN: AI-Assisted Output & Review */}
        <div className="space-y-4">
          <Card className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#202b42]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-semibold text-slate-200">
                  Saída assistida por IA (Claude 3.5 Sonnet)
                </span>
              </div>
              {aiResult && (
                <Badge variant={aiResult.success ? 'purple' : 'danger'} size="sm">
                  {aiResult.operation.toUpperCase()}
                </Badge>
              )}
            </div>

            {/* Provider Metadata Banner */}
            {aiResult && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-md bg-[#131b2b] border border-[#202b42] text-[11px] text-slate-300">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{aiResult.durationMs ? `${aiResult.durationMs}ms` : 'N/A'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Layers className="w-3 h-3 text-slate-400" />
                  <span>Tokens: {String(aiResult.tokensInput)} / {String(aiResult.tokensOutput)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-slate-400" />
                  <span>{aiResult.estimatedCost}</span>
                </div>
                <div className="flex items-center gap-1 text-purple-400 truncate">
                  <span>{aiResult.model}</span>
                </div>
              </div>
            )}

            {/* Processing Loading State */}
            {isProcessing && (
              <div className="p-8 rounded-lg bg-[#131b2b] border border-[#202b42] flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                <p className="text-xs text-slate-300 font-medium">
                  A processar inferência com Anthropic Claude 3.5 Sonnet...
                </p>
                <p className="text-[11px] text-slate-500 text-center max-w-sm">
                  A integrar contexto do briefing da campanha com instruções e regras de tom de voz.
                </p>
              </div>
            )}

            {/* AI Generated Text Output */}
            {!isProcessing && aiOutput && (
              <div className="space-y-3">
                <textarea
                  value={aiOutput}
                  onChange={(e) => setAiOutput(e.target.value)}
                  rows={13}
                  className="w-full bg-[#131b2b] border border-[#26344d] rounded-md p-3 text-xs sm:text-sm text-slate-200 font-sans leading-relaxed focus:outline-none focus:border-purple-500 resize-y"
                  placeholder="O texto gerado pelo Claude aparecerá aqui..."
                />

                {/* Variations Cards if available */}
                {aiResult?.variations && aiResult.variations.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-400">
                      Variações alternativas geradas:
                    </span>
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                      {aiResult.variations.map((vText, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setSelectedVariationIndex(idx);
                            setAiOutput(vText);
                          }}
                          className={`p-2.5 rounded border text-xs cursor-pointer transition-colors ${
                            selectedVariationIndex === idx
                              ? 'bg-purple-950/40 border-purple-500/50 text-purple-200'
                              : 'bg-[#141d2e] border-[#202b42] text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <div className="font-semibold text-slate-400 mb-1">
                            Variação #{idx + 1}
                          </div>
                          <div className="line-clamp-2 text-slate-300">{vText}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Output Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#202b42]">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleAcceptAsVersion}
                      leftIcon={<CheckCircle2 className="w-4 h-4" />}
                    >
                      Aceitar como nova versão
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(aiOutput)}
                      leftIcon={copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    >
                      {copied ? 'Copiado!' : 'Copiar'}
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAiOutput('');
                      setAiResult(null);
                    }}
                  >
                    Descartar
                  </Button>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!isProcessing && !aiOutput && (
              <div className="p-12 rounded-lg bg-[#131b2b]/50 border border-dashed border-[#202b42] flex flex-col items-center justify-center text-center space-y-2">
                <Sparkles className="w-8 h-8 text-slate-600" />
                <p className="text-xs font-medium text-slate-300">
                  Nenhuma inferência gerada de momento
                </p>
                <p className="text-[11px] text-slate-500 max-w-sm">
                  Escolha uma ação à esquerda (Gerar, Resumir, Expandir, Reescrever ou Variações) para acionar o Claude através da API oficial da Anthropic.
                </p>
              </div>
            )}
          </Card>

          {/* 3. Human-in-the-Loop Evaluation & Governance Workflow */}
          {activeContent && (
            <Card className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#202b42]">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-semibold text-slate-200">
                    Avaliação Humana e Governança Editorial
                  </span>
                </div>
                {activeContent && getStatusBadge(activeContent.status)}
              </div>

              {/* Rating Stars */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Avaliação da qualidade do texto (1 a 5 estrelas)
                </label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setHumanRating(star)}
                      className="p-1 text-slate-600 hover:text-amber-400 transition-colors focus:outline-none"
                    >
                      <Star
                        className={`w-5 h-5 ${
                          star <= humanRating ? 'text-amber-400 fill-amber-400' : 'text-slate-600'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs text-slate-400 ml-2">
                    {humanRating > 0 ? `${humanRating} / 5 estrelas` : 'Não avaliado'}
                  </span>
                </div>
              </div>

              {/* Feedback Note */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Parecer do redator / Observações de qualidade
                </label>
                <textarea
                  value={humanFeedback}
                  onChange={(e) => setHumanFeedback(e.target.value)}
                  placeholder="Ex.: Tom de voz alinhado com a sofisticação orgânica exigida pelo cliente..."
                  rows={2}
                  className="w-full bg-[#161f30] border border-[#26344d] rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#202b42]">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveEvaluation}
                  disabled={isSavingEvaluation || humanRating < 1}
                  leftIcon={evaluationSaved ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : undefined}
                >
                  {evaluationSaved ? 'Avaliação guardada' : 'Guardar avaliação'}
                </Button>

                {/* Submit for Review Button (Enforces Human-in-the-Loop) */}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSubmitForReview}
                  disabled={isSubmittingReview || activeContent.status === 'READY_FOR_REVIEW'}
                  leftIcon={<Send className="w-3.5 h-3.5" />}
                >
                  {activeContent.status === 'READY_FOR_REVIEW'
                    ? 'Em revisão editorial'
                    : 'Enviar para revisão'}
                </Button>
              </div>

              <p className="text-[11px] text-slate-500 italic">
                Regra de Governança: O conteúdo não pode ser aprovado diretamente pelo redator. Enviar para revisão remete a peça para a análise imparcial da função Aprovador.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* MODAL: Version History (Never destroys history) */}
      <Modal
        isOpen={isVersionHistoryOpen}
        onClose={() => setIsVersionHistoryOpen(false)}
        title={`Histórico de versões — ${activeContent?.title || 'Conteúdo'}`}
        size="lg"
      >
        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          <p className="text-xs text-slate-400">
            Pista de auditoria append-only. Nenhuma versão anterior é substituída ou destruída.
          </p>

          <div className="space-y-3">
            {activeContent?.versions?.map((ver) => (
              <div
                key={ver.id}
                className={`p-3 rounded-lg border ${
                  ver.version_number === activeContent.current_version
                    ? 'bg-indigo-950/30 border-indigo-500/50'
                    : 'bg-[#141d2e] border-[#202b42]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-100 font-mono">
                      Versão #{ver.version_number}
                    </span>
                    {ver.version_number === activeContent.current_version && (
                      <Badge variant="purple" size="sm">ATUAL</Badge>
                    )}
                    {ver.provider && (
                      <Badge variant="neutral" size="sm">
                        {ver.provider} {ver.operation ? `(${ver.operation})` : ''}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">
                      {new Date(ver.created_at).toLocaleString('pt-PT')}
                    </span>
                    {ver.version_number !== activeContent.current_version && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRestoreVersion(ver.version_number)}
                      >
                        Restaurar
                      </Button>
                    )}
                  </div>
                </div>

                <div className="text-xs text-slate-300 font-sans line-clamp-3 bg-[#101726] p-2 rounded border border-[#1b2538] mb-2">
                  {ver.content}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Autor: {ver.author_name} ({ver.author_role})</span>
                  {ver.notes && <span className="italic">Nota: {ver.notes}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* MODAL: AI Generation Audit Logs */}
      <Modal
        isOpen={isAuditLogsOpen}
        onClose={() => setIsAuditLogsOpen(false)}
        title="Registos de auditoria de gerações IA"
        size="lg"
      >
        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          <p className="text-xs text-slate-400">
            Registo detalhado de todas as chamadas de inferência ao Claude e custos correspondentes.
          </p>

          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              Nenhuma chamada registada até ao momento nesta campanha.
            </p>
          ) : (
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-lg bg-[#141d2e] border border-[#202b42] text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200 uppercase font-mono">
                        {log.operation}
                      </span>
                      <Badge
                        variant={
                          log.status === 'COMPLETED'
                            ? 'success'
                            : log.status === 'BLOCKED'
                            ? 'warning'
                            : 'danger'
                        }
                        size="sm"
                      >
                        {log.status}
                      </Badge>
                    </div>
                    <span className="text-slate-400 text-[11px]">
                      {new Date(log.timestamp).toLocaleString('pt-PT')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-400">
                    <div>
                      <strong>Fornecedor:</strong> {log.provider}
                    </div>
                    <div>
                      <strong>Modelo:</strong> {log.model}
                    </div>
                    <div>
                      <strong>Duração:</strong> {log.duration_ms ? `${log.duration_ms}ms` : 'N/A'}
                    </div>
                    <div>
                      <strong>Custo estimado:</strong> {log.estimated_cost || 'N/A'}
                    </div>
                  </div>

                  {log.error_message && (
                    <div className="text-[11px] text-rose-300 bg-rose-950/20 p-1.5 rounded border border-rose-900/30">
                      {log.error_message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL: Create New Content Document */}
      <Modal
        isOpen={isNewContentModalOpen}
        onClose={() => setIsNewContentModalOpen(false)}
        title="Criar novo documento de conteúdo"
        size="md"
      >
        <form onSubmit={handleCreateNewContent} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Título do documento *
            </label>
            <input
              type="text"
              required
              value={newContentTitle}
              onChange={(e) => setNewContentTitle(e.target.value)}
              placeholder="Ex.: Anúncio Instagram Black Friday"
              className="w-full bg-[#161f30] border border-[#26344d] rounded-md px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Canal inicial
            </label>
            <select
              value={newContentChannel}
              onChange={(e) => setNewContentChannel(e.target.value as ContentChannel)}
              className="w-full bg-[#161f30] border border-[#26344d] rounded-md px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {SUPPORTED_CHANNELS.map((ch) => (
                <option key={ch} value={ch}>
                  {ch}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#202b42]">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsNewContentModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Criar documento
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Phase 9 Approval Decision */}
      {activeContent && isApprovalModalOpen && (
        <ContentApprovalModal
          isOpen={isApprovalModalOpen}
          onClose={() => setIsApprovalModalOpen(false)}
          contentTitle={activeContent.title}
          versionNumber={activeContent.current_version}
          onConfirmApprove={handleConfirmApprove}
          isProcessing={isWorkflowLoading}
        />
      )}

      {/* MODAL: Phase 9 Rejection with Mandatory Justification */}
      {activeContent && isRejectionModalOpen && (
        <ContentRejectionModal
          isOpen={isRejectionModalOpen}
          onClose={() => setIsRejectionModalOpen(false)}
          contentTitle={activeContent.title}
          versionNumber={activeContent.current_version}
          onConfirmReject={handleConfirmReject}
          isProcessing={isWorkflowLoading}
        />
      )}

      {/* MODAL: Phase 9 Chronological Review Events Timeline */}
      {activeContent && isTimelineModalOpen && (
        <ContentReviewTimelineModal
          isOpen={isTimelineModalOpen}
          onClose={() => setIsTimelineModalOpen(false)}
          contentId={activeContent.id}
          contentTitle={activeContent.title}
          getAuthHeaders={getAuthHeaders}
        />
      )}

      {/* MODAL: Phase 9 Revise Rejected Content (Creates New Version) */}
      {activeContent && isRevisionModalOpen && (
        <Modal
          isOpen={isRevisionModalOpen}
          onClose={() => setIsRevisionModalOpen(false)}
          title={`Criar revisão (Nova versão) — ${activeContent.title}`}
          size="md"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs">
              <strong>Preservação de histórico:</strong> Esta ação cria a versão #{activeContent.current_version + 1} com base no texto atual do editor, mantendo a versão rejeitada #{activeContent.current_version} intacta no histórico de auditoria.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Notas da revisão (O que foi ajustado?)
              </label>
              <textarea
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
                rows={3}
                placeholder="Ex.: Ajustado tom de voz, eliminados termos sensíveis e inserida chamada para ação conforme solicitado pelo aprovador..."
                className="w-full bg-[#161f30] border border-[#26344d] rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#202b42]">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsRevisionModalOpen(false)}
                disabled={isWorkflowLoading}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleReviseContent(revisionNotes)}
                isLoading={isWorkflowLoading}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Gerar versão #{activeContent.current_version + 1}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
