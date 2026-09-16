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
            `Moderación de Seguridad IA: Solicitud bloqueada (${data.moderation?.riskLevel || 'HIGH_RISK'}). ${data.message || ''}`
          );
        } else if (data.statusCode === 'REQUIRES_HUMAN_REVIEW') {
          setErrorMessage(
            `Moderación de Seguridad IA: Contenido retenido para revisión humana (${data.moderation?.riskLevel || 'MEDIUM_RISK'}). ${data.message || ''}`
          );
        } else if (data.statusCode === 'BLOCKED') {
          setErrorMessage(
            'El servicio Claude está en estado BLOCKED: ANTHROPIC_API_KEY no configurada en el servidor. No se permiten simulaciones ni contenidos artificiales falsos.'
          );
        } else if (data.statusCode === 'RATE_LIMITED') {
          setErrorMessage('Límite de solicitudes de Claude alcanzado. Reintente en unos momentos.');
        } else if (data.statusCode === 'TIMEOUT') {
          setErrorMessage('Tiempo límite excedido en la comunicación con la API de Anthropic.');
        } else {
          setErrorMessage(data.message || 'Error al procesar contenido con Claude.');
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
      setErrorMessage(err instanceof Error ? err.message : 'Fallo de red al comunicarse con el servidor.');
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
          notes: `Aceptado de la generación Claude (${aiResult?.operation || 'asistida'})`,
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
          notes: 'Edición manual del redactor',
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
        setWorkflowFeedback({ type: 'error', message: data.message || 'Error al enviar a revisión.' });
        return;
      }

      const updated: ContentModel = data.content;
      setActiveContent(updated);
      setContents((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setWorkflowFeedback({ type: 'success', message: '¡Contenido enviado con éxito a la cola de revisión!' });
    } catch (err: unknown) {
      setWorkflowFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Fallo de comunicación con el servidor.',
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
        setWorkflowFeedback({ type: 'error', message: data.message || 'Error al iniciar revisión.' });
        return;
      }

      const updated: ContentModel = data.content;
      setActiveContent(updated);
      setContents((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setWorkflowFeedback({ type: 'success', message: 'Revisión formal iniciada.' });
    } catch (err: unknown) {
      setWorkflowFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Fallo de comunicación.',
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
        setWorkflowFeedback({ type: 'error', message: data.message || 'Error al aprobar contenido.' });
        return;
      }

      const updated: ContentModel = data.content;
      setActiveContent(updated);
      setContents((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setIsApprovalModalOpen(false);
      setWorkflowFeedback({
        type: 'success',
        message: `¡Contenido "${updated.title}" aprobado formalmente!`,
      });
    } catch (err: unknown) {
      setWorkflowFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Fallo de comunicación.',
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
        setWorkflowFeedback({ type: 'error', message: data.message || 'Error al rechazar contenido.' });
        return;
      }

      const updated: ContentModel = data.content;
      setActiveContent(updated);
      setContents((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setIsRejectionModalOpen(false);
      setWorkflowFeedback({
        type: 'success',
        message: 'Contenido rechazado con solicitud de revisión enviada al autor.',
      });
    } catch (err: unknown) {
      setWorkflowFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Fallo de comunicación.',
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
          notes: notes || 'Revisión tras comentarios del aprobador',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setWorkflowFeedback({ type: 'error', message: data.message || 'Error al crear nueva versión revisada.' });
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
        message: `Nueva versión #${updated.current_version} generada a partir de la revisión. Historial anterior preservado intacto.`,
      });
    } catch (err: unknown) {
      setWorkflowFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Fallo de comunicación.',
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
        return <Badge variant="success" size="sm">APROBADO</Badge>;
      case 'REJECTED':
        return <Badge variant="danger" size="sm">RECHAZADO</Badge>;
      case 'UNDER_REVIEW':
        return <Badge variant="warning" size="sm">EN REVISIÓN</Badge>;
      case 'READY_FOR_REVIEW':
        return <Badge variant="info" size="sm">LISTO PARA REVISIÓN</Badge>;
      case 'HUMAN_EDITED':
        return <Badge variant="purple" size="sm">EDITADO MANUALMENTE</Badge>;
      case 'AI_GENERATED':
        return <Badge variant="neutral" size="sm">GENERADO POR IA</Badge>;
      case 'DRAFT':
      default:
        return <Badge variant="neutral" size="sm">BORRADOR</Badge>;
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
                  Editor de Contenido y Claude IA
                  {activeContent && getStatusBadge(activeContent.status)}
                </h2>
                <p className="text-xs text-slate-400">
                  Creación y transformación de copy orientada al briefing estructurado
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
              Nuevo texto
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
                Claude 3.5 Sonnet: {claudeStatus?.status === 'READY' ? 'ACTIVO' : 'BLOQUEADO (Sin Clave)'}
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
                  Versiones ({activeContent.versions?.length || activeContent.current_version})
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
                  Auditoría
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
                <span className="text-xs font-semibold text-slate-300">Flujo de Aprobación:</span>
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
                    Moderación: {activeContent.moderation_status}
                  </span>
                )}
                <span className="text-[11px] text-slate-400 font-mono">
                  Versión #{activeContent.current_version}
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-[11px] text-slate-400">
                  Creado por: <strong className="text-slate-200">{activeContent.created_by_name}</strong> ({activeContent.created_by_role})
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Gobernanza human-in-the-loop: la IA nunca aprueba automáticamente. El autor no puede aprobar su propia pieza.
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
                {isCommentsPanelOpen ? 'Ocultar comentarios' : 'Comentarios'}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsTimelineModalOpen(true)}
                leftIcon={<History className="w-3.5 h-3.5" />}
              >
                Historial de revisión
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
                  Enviar a revisión
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
                  Iniciar revisión
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
                    Rechazar
                  </Button>

                  <div className="relative group">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setIsApprovalModalOpen(true)}
                      disabled={user?.id === activeContent.created_by || isWorkflowLoading}
                      leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    >
                      Aprobar
                    </Button>
                    {user?.id === activeContent.created_by && (
                      <div className="absolute right-0 bottom-full mb-1.5 hidden group-hover:block z-30 w-64 p-2 rounded-md bg-[#161f30] border border-amber-500/30 text-[11px] text-amber-300 shadow-xl">
                        <AlertTriangle className="w-3.5 h-3.5 inline mr-1 text-amber-400" />
                        <strong>Violación de Gobernanza:</strong> Usted es el autor de esta pieza y no puede aprobar su propio contenido.
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
                <strong>Regla de Segregación de Funciones:</strong> Usted es el autor registrado de esta pieza. Para garantizar la conformidad, la aprobación final requiere la evaluación de otro miembro con perfil de Aprobador.
              </span>
            </div>
          )}

          {/* Rejection Alert & Quick Revision Action */}
          {activeContent.status === 'REJECTED' && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-semibold text-rose-300">
                  <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>Contenido rechazado por {activeContent.reviewed_by_name || 'Aprobador'} ({activeContent.reviewed_at ? new Date(activeContent.reviewed_at).toLocaleString('es-ES') : ''})</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRevisionModalOpen(true)}
                  leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                >
                  Crear revisión (Nueva versión)
                </Button>
              </div>
              {activeContent.rejection_reason && (
                <div className="p-2.5 rounded-lg bg-[#0d1320] border border-[#1b263b] text-slate-200 font-sans">
                  <strong className="text-rose-300 block mb-0.5">Justificación del Aprobador:</strong>
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
                  <span className="font-semibold text-emerald-200">Pieza Aprobada Formalmente</span> por {activeContent.reviewed_by_name || 'Revisor'} el {activeContent.reviewed_at ? new Date(activeContent.reviewed_at).toLocaleString('es-ES') : 'fecha reciente'}.
                  <p className="text-[11px] text-emerald-400/80 mt-0.5">Esta versión está liberada y homologada para su publicación en el canal {activeContent.channel}.</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsRevisionModalOpen(true)}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Nueva revisión
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
              Anthropic Claude está en estado BLOCKED (Sin clave de API configurada)
            </p>
            <p className="text-slate-300">
              La variable <code className="bg-[#131b2b] px-1 py-0.5 rounded text-amber-200">ANTHROPIC_API_KEY</code> no fue detectada en el servidor. En estricta conformidad con las normas de la plataforma, el sistema no realiza simulaciones falsas ni genera textos artificiales simulados. Para utilizar el motor de IA Claude, añada su clave en la configuración.
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
                  Texto original / Borrador del redactor
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">
                  {sourceText.length} caracteres · {sourceText.trim() ? sourceText.trim().split(/\s+/).length : 0} palabras
                </span>
                {activeContent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSaveManualEdit}
                    disabled={!sourceText.trim() || isProcessing}
                  >
                    Guardar borrador
                  </Button>
                )}
              </div>
            </div>

            {/* Title & Channel Config */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Título de la pieza
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Manifiesto de Lanzamiento"
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
                Cuerpo del contenido
              </label>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Introduzca el texto original de la pieza aquí o utilice la generación directa con Claude a partir del briefing estructurado..."
                rows={12}
                className="w-full bg-[#131b2b] border border-[#26344d] rounded-md p-3 text-xs sm:text-sm text-slate-200 font-sans leading-relaxed focus:outline-none focus:border-indigo-500 resize-y"
              />
            </div>

            {/* Campaign Context Reminder (Accordion/Pills) */}
            <div className="p-3 rounded-lg bg-[#141d2e] border border-[#202b42] text-xs space-y-1.5">
              <div className="text-slate-400 font-medium flex items-center justify-between">
                <span>Contexto automático del briefing:</span>
                <span className="text-[11px] text-indigo-400">{campaign.name}</span>
              </div>
              <div className="text-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div>
                  <strong className="text-slate-400">Público:</strong> {campaign.target_audience || 'General'}
                </div>
                <div>
                  <strong className="text-slate-400">Tono:</strong> {campaign.tone_of_voice || 'Profesional'}
                </div>
                <div>
                  <strong className="text-slate-400">Mensaje:</strong> {campaign.key_message || 'N/A'}
                </div>
                <div>
                  <strong className="text-slate-400">Idioma:</strong> {campaign.language || 'es-ES'}
                </div>
              </div>
            </div>

            {/* Contextual Overrides & Specific Instructions */}
            <div className="space-y-2 pt-2 border-t border-[#202b42]">
              <label className="block text-xs font-medium text-slate-400">
                Instrucciones específicas / Prompt del redactor
              </label>
              <textarea
                value={userInstructions}
                onChange={(e) => setUserInstructions(e.target.value)}
                placeholder="Ej: Enfatice la garantía científica de 30 días y añada una llamada a la acción persuasiva para Instagram Stories..."
                rows={2}
                className="w-full bg-[#161f30] border border-[#26344d] rounded-md px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Operations Bar */}
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-semibold text-slate-300">
                Acciones de contenido Claude:
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isProcessing}
                  onClick={() => handleProcessOperation('generate')}
                  leftIcon={activeOperation === 'generate' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                >
                  Generar contenido
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={isProcessing || !sourceText.trim()}
                  onClick={() => handleProcessOperation('rewrite')}
                  leftIcon={activeOperation === 'rewrite' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                >
                  Reescribir
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
                  Corregir
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={isProcessing || !sourceText.trim()}
                  onClick={() => handleProcessOperation('variations')}
                  leftIcon={<Sliders className="w-3.5 h-3.5" />}
                >
                  Variaciones
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
                  Salida asistida por IA (Claude 3.5 Sonnet)
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
                  Procesando inferencia con Anthropic Claude 3.5 Sonnet...
                </p>
                <p className="text-[11px] text-slate-500 text-center max-w-sm">
                  Integrando contexto del briefing de la campaña con instrucciones y reglas de tono de voz.
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
                  placeholder="El texto generado por Claude aparecerá aquí..."
                />

                {/* Variations Cards if available */}
                {aiResult?.variations && aiResult.variations.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-400">
                      Variaciones alternativas generadas:
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
                            Variación #{idx + 1}
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
                      Aceptar como nueva versión
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(aiOutput)}
                      leftIcon={copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    >
                      {copied ? '¡Copiado!' : 'Copiar'}
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
                  Ninguna inferencia generada por el momento
                </p>
                <p className="text-[11px] text-slate-500 max-w-sm">
                  Elija una acción a la izquierda (Generar, Resumir, Expandir, Reescribir o Variaciones) para accionar Claude mediante la API oficial de Anthropic.
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
                    Evaluación Humana y Gobernanza Editorial
                  </span>
                </div>
                {activeContent && getStatusBadge(activeContent.status)}
              </div>

              {/* Rating Stars */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Evaluación de la calidad del texto (1 a 5 estrellas)
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
                    {humanRating > 0 ? `${humanRating} / 5 estrellas` : 'No evaluado'}
                  </span>
                </div>
              </div>

              {/* Feedback Note */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Dictamen del redactor / Observaciones de calidad
                </label>
                <textarea
                  value={humanFeedback}
                  onChange={(e) => setHumanFeedback(e.target.value)}
                  placeholder="Ej: Tono de voz alineado con la sofisticación orgánica requerida por el cliente..."
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
                  {evaluationSaved ? 'Evaluación guardada' : 'Guardar evaluación'}
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
                    ? 'En revisión editorial'
                    : 'Enviar a revisión'}
                </Button>
              </div>

              <p className="text-[11px] text-slate-500 italic">
                Regla de Gobernanza: El contenido no puede ser aprobado directamente por el redactor. Enviar a revisión remite la pieza para el análisis imparcial del rol Aprobador.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* MODAL: Version History (Never destroys history) */}
      <Modal
        isOpen={isVersionHistoryOpen}
        onClose={() => setIsVersionHistoryOpen(false)}
        title={`Historial de versiones — ${activeContent?.title || 'Contenido'}`}
        size="lg"
      >
        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          <p className="text-xs text-slate-400">
            Pista de auditoría append-only. Ninguna versión anterior se sobrescribe o destruye.
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
                      Versión #{ver.version_number}
                    </span>
                    {ver.version_number === activeContent.current_version && (
                      <Badge variant="purple" size="sm">ACTUAL</Badge>
                    )}
                    {ver.provider && (
                      <Badge variant="neutral" size="sm">
                        {ver.provider} {ver.operation ? `(${ver.operation})` : ''}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">
                      {new Date(ver.created_at).toLocaleString('es-ES')}
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
        title="Registros de auditoría de generaciones IA"
        size="lg"
      >
        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          <p className="text-xs text-slate-400">
            Registro detallado de todas las llamadas de inferencia a Claude y costes correspondientes.
          </p>

          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              Ninguna llamada registrada hasta el momento en esta campaña.
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
                      {new Date(log.timestamp).toLocaleString('es-ES')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-400">
                    <div>
                      <strong>Proveedor:</strong> {log.provider}
                    </div>
                    <div>
                      <strong>Modelo:</strong> {log.model}
                    </div>
                    <div>
                      <strong>Duración:</strong> {log.duration_ms ? `${log.duration_ms}ms` : 'N/A'}
                    </div>
                    <div>
                      <strong>Coste estimado:</strong> {log.estimated_cost || 'N/A'}
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
        title="Crear nuevo documento de contenido"
        size="md"
      >
        <form onSubmit={handleCreateNewContent} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Título del documento *
            </label>
            <input
              type="text"
              required
              value={newContentTitle}
              onChange={(e) => setNewContentTitle(e.target.value)}
              placeholder="Ej: Anuncio Instagram Black Friday"
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
              Crear documento
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
          title={`Crear revisión (Nueva versión) — ${activeContent.title}`}
          size="md"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs">
              <strong>Preservación de historial:</strong> Esta acción crea la versión #{activeContent.current_version + 1} basándose en el texto actual del editor, manteniendo la versión rechazada #{activeContent.current_version} intacta en el historial de auditoría.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Notas de la revisión (¿Qué se ha ajustado?)
              </label>
              <textarea
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
                rows={3}
                placeholder="Ej: Ajustado tono de voz, eliminados términos sensibles e insertada llamada a la acción según lo solicitado por el aprobador..."
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
                Generar versión #{activeContent.current_version + 1}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
