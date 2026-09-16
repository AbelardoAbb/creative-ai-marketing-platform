/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Filter,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  History,
} from 'lucide-react';
import { CampaignModel } from '../../types/campaign';
import { ContentModel, ContentStatus } from '../../types/content';
import { ModerationEventModel } from '../../types/moderation';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { ContentApprovalModal } from '../content/ContentApprovalModal';
import { ContentRejectionModal } from '../content/ContentRejectionModal';
import { ContentReviewTimelineModal } from '../content/ContentReviewTimelineModal';
import { ModerationResolutionModal } from '../content/ModerationResolutionModal';

interface CampaignReviewQueueTabProps {
  campaign: CampaignModel;
  onOpenContentInEditor: (contentId: string) => void;
}

export const CampaignReviewQueueTab: React.FC<CampaignReviewQueueTabProps> = ({
  campaign,
  onOpenContentInEditor,
}) => {
  const { user, session } = useAuth();
  const [activeSection, setActiveSection] = useState<'CONTENT' | 'MODERATION'>('CONTENT');
  const [queue, setQueue] = useState<ContentModel[]>([]);
  const [pendingModeration, setPendingModeration] = useState<ModerationEventModel[]>([]);
  const [resolvingModerationEvent, setResolvingModerationEvent] = useState<ModerationEventModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Decision Modals State
  const [approvingItem, setApprovingItem] = useState<ContentModel | null>(null);
  const [rejectingItem, setRejectingItem] = useState<ContentModel | null>(null);
  const [timelineItem, setTimelineItem] = useState<ContentModel | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-id': user?.id || 'anonymous',
      'x-user-role': user?.role || 'Approver',
      'x-user-email': user?.email || '',
      'x-user-name': user?.displayName || '',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  }, [user, session]);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/campaigns/${campaign.id}/review-queue`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setQueue(data.queue || []);
      }
    } catch (err) {
      console.error('Failed to load review queue:', err);
    } finally {
      setLoading(false);
    }
  }, [campaign.id, getAuthHeaders]);

  const fetchPendingModeration = useCallback(async () => {
    try {
      const url = `/api/campaigns/${campaign.id}/moderation/pending`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setPendingModeration(data.pending || []);
      }
    } catch (err) {
      console.error('Failed to load pending moderation events:', err);
    }
  }, [campaign.id, getAuthHeaders]);

  useEffect(() => {
    fetchQueue();
    fetchPendingModeration();
  }, [fetchQueue, fetchPendingModeration]);

  const handleConfirmResolveModeration = async (decision: 'ALLOW' | 'BLOCK', notes: string) => {
    if (!resolvingModerationEvent) return;
    setIsProcessing(true);
    try {
      const res = await fetch(
        `/api/campaigns/${campaign.id}/moderation/${resolvingModerationEvent.id}/resolve`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ decision, notes }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({
          type: 'error',
          message: data.message || 'Error al resolver el evento de moderación.',
        });
        return;
      }
      setActionFeedback({
        type: 'success',
        message: `Moderación resuelta con éxito (${decision}).`,
      });
      setResolvingModerationEvent(null);
      await Promise.all([fetchQueue(), fetchPendingModeration()]);
    } catch (err: unknown) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Fallo al comunicarse con el servidor.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const isApprover = user?.role === 'Approver';
  const isAdmin = user?.role === 'Administrator';

  // Metrics
  const readyCount = queue.filter((i) => i.status === 'READY_FOR_REVIEW').length;
  const underReviewCount = queue.filter((i) => i.status === 'UNDER_REVIEW').length;
  const approvedCount = queue.filter((i) => i.status === 'APPROVED').length;
  const rejectedCount = queue.filter((i) => i.status === 'REJECTED').length;

  const filteredItems = queue.filter((item) => {
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'PENDING') {
      return item.status === 'READY_FOR_REVIEW' || item.status === 'UNDER_REVIEW';
    }
    return item.status === filterStatus;
  });

  const handleStartReview = async (item: ContentModel) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/contents/${item.id}/start-review`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({ type: 'error', message: data.message || 'Error al iniciar la revisión.' });
        return;
      }
      setActionFeedback({ type: 'success', message: 'Revisión iniciada con éxito.' });
      await fetchQueue();
    } catch (err: unknown) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Fallo de comunicación con el servidor.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmApprove = async (comment?: string) => {
    if (!approvingItem) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/contents/${approvingItem.id}/approve`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ comment }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({
          type: 'error',
          message: data.message || 'Error al aprobar el contenido.',
        });
        return;
      }
      setActionFeedback({
        type: 'success',
        message: `¡Pieza "${approvingItem.title}" aprobada formalmente con éxito!`,
      });
      setApprovingItem(null);
      await fetchQueue();
    } catch (err: unknown) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Fallo de comunicación con el servidor.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmReject = async (reason: string) => {
    if (!rejectingItem) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/contents/${rejectingItem.id}/reject`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({
          type: 'error',
          message: data.message || 'Error al rechazar el contenido.',
        });
        return;
      }
      setActionFeedback({
        type: 'success',
        message: `Pieza "${rejectingItem.title}" rechazada con solicitud de revisión fundamentada.`,
      });
      setRejectingItem(null);
      await fetchQueue();
    } catch (err: unknown) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Fallo de comunicación con el servidor.',
      });
    } finally {
      setIsProcessing(false);
    }
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
        return <Badge variant="blue" size="sm">EDICIÓN MANUAL</Badge>;
      case 'AI_GENERATED':
        return <Badge variant="neutral" size="sm">IA GENERADO</Badge>;
      case 'DRAFT':
      default:
        return <Badge variant="neutral" size="sm">BORRADOR</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 0. Top Queue Category Switcher (Editorial vs. Responsible AI Moderation) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 border border-slate-200 rounded-xl">
          <button
            onClick={() => setActiveSection('CONTENT')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeSection === 'CONTENT'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Cola Editorial de Piezas</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeSection === 'CONTENT' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {queue.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSection('MODERATION')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeSection === 'MODERATION'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Moderación de Seguridad IA</span>
            {pendingModeration.length > 0 ? (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-200 text-amber-900 font-bold">
                {pendingModeration.length}
              </span>
            ) : (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeSection === 'MODERATION' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                0
              </span>
            )}
          </button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            fetchQueue();
            fetchPendingModeration();
          }}
          isLoading={loading}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Actualizar Datos
        </Button>
      </div>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between gap-3 ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-slate-500 hover:text-slate-700 font-medium"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* SECTION: RESPONSIBLE AI MODERATION QUEUE */}
      {activeSection === 'MODERATION' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-amber-900">
                Central de Moderación y Gobernanza Responsable
              </div>
              <p className="text-amber-800">
                Todas las solicitudes y generaciones pasan por filtros de seguridad de contenido. Los eventos clasificados como riesgo moderado o alto requieren análisis humano obligatorio por Revisores Autorizados o Administradores antes de que el contenido pueda continuar.
              </p>
            </div>
          </div>

          {pendingModeration.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 bg-white space-y-3">
              <ShieldCheck className="w-10 h-10 text-emerald-600 mx-auto" />
              <h4 className="text-sm font-semibold text-slate-900">
                Sin pendientes de moderación de seguridad
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Todas las interacciones recientes de IA pasaron las validaciones de términos sensibles o ya fueron evaluadas por revisores.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {pendingModeration.map((event) => {
                const canResolve = isApprover || isAdmin;

                return (
                  <Card key={event.id} className="p-5 space-y-4 border-amber-200 bg-white">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 font-semibold">
                            {event.stage === 'INPUT' ? 'ENTRADA (Prompt)' : 'SALIDA (Generación)'}
                          </span>
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              event.risk_level === 'HIGH_RISK'
                                ? 'bg-red-100 text-red-800 border border-red-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            Riesgo: {event.risk_level}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">
                            {event.provider} · {event.model}
                          </span>
                        </div>

                        <div className="text-xs text-slate-500">
                          Enviado por <strong className="text-slate-800">{event.user_name}</strong> ({event.user_role}) el {new Date(event.timestamp).toLocaleString('es-ES')}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {canResolve ? (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setResolvingModerationEvent(event)}
                            leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
                          >
                            Evaluar Moderación
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-500 italic">
                            Requiere rol de Revisor o Administrador
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Detected Categories & Reason */}
                    {event.categories && event.categories.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-slate-600">Categorías detectadas:</span>
                        {event.categories.map((cat) => (
                          <span
                            key={cat}
                            className="px-2 py-0.5 text-[10px] font-mono rounded bg-red-50 border border-red-200 text-red-700"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}

                    {event.reason && (
                      <div className="text-xs text-amber-900 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                        <strong>Motivo:</strong> {event.reason}
                      </div>
                    )}

                    {/* Evaluated Snippet */}
                    {event.evaluated_snippet && (
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 font-mono line-clamp-3">
                        {event.evaluated_snippet}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION: EDITORIAL CONTENT QUEUE */}
      {activeSection === 'CONTENT' && (
        <>
          {/* 1. Header & Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div
              onClick={() => setFilterStatus('READY_FOR_REVIEW')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                filterStatus === 'READY_FOR_REVIEW'
                  ? 'bg-blue-50 border-blue-300 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Listos p/ Revisión</span>
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{readyCount}</div>
              <p className="text-[11px] text-slate-500 mt-1">Esperando inicio de revisión</p>
            </div>

            <div
              onClick={() => setFilterStatus('UNDER_REVIEW')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                filterStatus === 'UNDER_REVIEW'
                  ? 'bg-amber-50 border-amber-300 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">En Revisión Activa</span>
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{underReviewCount}</div>
              <p className="text-[11px] text-slate-500 mt-1">En evaluación por revisores</p>
            </div>

            <div
              onClick={() => setFilterStatus('APPROVED')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                filterStatus === 'APPROVED'
                  ? 'bg-emerald-50 border-emerald-300 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Aprobados</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{approvedCount}</div>
              <p className="text-[11px] text-slate-500 mt-1">Habilitados para difusión</p>
            </div>

            <div
              onClick={() => setFilterStatus('REJECTED')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                filterStatus === 'REJECTED'
                  ? 'bg-red-50 border-red-300 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Rechazados</span>
                <XCircle className="w-4 h-4 text-red-600" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{rejectedCount}</div>
              <p className="text-[11px] text-slate-500 mt-1">Requieren revisión del autor</p>
            </div>
          </div>

          {/* 2. Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={filterStatus === 'ALL' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setFilterStatus('ALL')}
              >
                Todos ({queue.length})
              </Button>
              <Button
                variant={filterStatus === 'PENDING' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setFilterStatus('PENDING')}
              >
                Pendientes ({readyCount + underReviewCount})
              </Button>
              <Button
                variant={filterStatus === 'READY_FOR_REVIEW' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setFilterStatus('READY_FOR_REVIEW')}
              >
                Listos ({readyCount})
              </Button>
              <Button
                variant={filterStatus === 'UNDER_REVIEW' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setFilterStatus('UNDER_REVIEW')}
              >
                En Revisión ({underReviewCount})
              </Button>
              <Button
                variant={filterStatus === 'APPROVED' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setFilterStatus('APPROVED')}
              >
                Aprobados ({approvedCount})
              </Button>
              <Button
                variant={filterStatus === 'REJECTED' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setFilterStatus('REJECTED')}
              >
                Rechazados ({rejectedCount})
              </Button>
            </div>
          </div>

      {/* 3. Items Queue List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400 animate-pulse">
            Cargando cola de revisión de gobernanza...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 rounded-xl bg-white border border-slate-200 text-center space-y-2">
            <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto" />
            <h4 className="text-sm font-semibold text-slate-800">
              Ninguna pieza en esta categoría de revisión
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Las piezas creadas en el Editor de Contenido pueden enviarse formalmente para aprobación para figurar en esta cola.
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isAuthor = user?.id === item.created_by;
            const canReview = isApprover || (isAdmin && isApprover);
            const canStart = (item.status === 'READY_FOR_REVIEW') && canReview;
            const canDecide = (item.status === 'READY_FOR_REVIEW' || item.status === 'UNDER_REVIEW') && canReview;

            return (
              <Card key={item.id} className="p-5 space-y-4 hover:border-slate-300 transition-colors bg-white">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{item.title}</span>
                      {getStatusBadge(item.status)}
                      {item.moderation_status && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-medium inline-flex items-center gap-1 ${
                            item.moderation_status === 'BLOCKED'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : item.moderation_status === 'REQUIRES_HUMAN_REVIEW'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          Moderación: {item.moderation_status}
                        </span>
                      )}
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {item.channel}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                        Versión #{item.current_version}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>Autor: <strong className="text-slate-800">{item.created_by_name}</strong> ({item.created_by_role})</span>
                      <span className="text-slate-400">·</span>
                      <span>Actualizado el: {new Date(item.updated_at).toLocaleString('es-ES')}</span>
                      {item.submitted_at && (
                        <>
                          <span className="text-slate-400">·</span>
                          <span>Enviado el: {new Date(item.submitted_at).toLocaleString('es-ES')}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTimelineItem(item)}
                      leftIcon={<History className="w-3.5 h-3.5" />}
                    >
                      Historial
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenContentInEditor(item.id)}
                      leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
                    >
                      Abrir en el Editor
                    </Button>

                    {canStart && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleStartReview(item)}
                        isLoading={isProcessing}
                        leftIcon={<Clock className="w-3.5 h-3.5" />}
                      >
                        Iniciar Revisión
                      </Button>
                    )}

                    {canDecide && (
                      <>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setRejectingItem(item)}
                          disabled={isProcessing}
                          leftIcon={<XCircle className="w-3.5 h-3.5" />}
                        >
                          Rechazar
                        </Button>

                        <div className="relative group">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setApprovingItem(item)}
                            disabled={isAuthor || isProcessing}
                            leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                          >
                            Aprobar
                          </Button>
                          {isAuthor && (
                            <div className="absolute right-0 bottom-full mb-1.5 hidden group-hover:block z-20 w-64 p-2 rounded-md bg-slate-900 border border-amber-400/50 text-[11px] text-amber-200 shadow-xl">
                              <AlertTriangle className="w-3.5 h-3.5 inline mr-1 text-amber-400" />
                              <strong>Infracción de Gobernanza:</strong> El creador de la pieza no puede aprobar su propio contenido.
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Content Preview Snippet */}
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 font-mono line-clamp-2">
                  {item.content || 'Ningún contenido textual registrado.'}
                </div>

                {/* Rejection Warning Banner */}
                {item.status === 'REJECTED' && item.rejection_reason && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-red-900">
                      <XCircle className="w-4 h-4 text-red-600" />
                      Justificación del Rechazo (Revisado por {item.reviewed_by_name || 'Revisor'}):
                    </div>
                    <p className="pl-5 text-red-700">{item.rejection_reason}</p>
                  </div>
                )}

                {/* Approved Banner */}
                {item.status === 'APPROVED' && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>
                      Aprobado formalmente por <strong className="text-emerald-900">{item.reviewed_by_name || 'Revisor Autorizado'}</strong> el {item.reviewed_at ? new Date(item.reviewed_at).toLocaleString('es-ES') : 'Fecha no informada'}.
                    </span>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
      </>
      )}

      {/* Decision Modals */}
      {approvingItem && (
        <ContentApprovalModal
          isOpen={!!approvingItem}
          onClose={() => setApprovingItem(null)}
          contentTitle={approvingItem.title}
          versionNumber={approvingItem.current_version}
          onConfirmApprove={handleConfirmApprove}
          isProcessing={isProcessing}
        />
      )}

      {rejectingItem && (
        <ContentRejectionModal
          isOpen={!!rejectingItem}
          onClose={() => setRejectingItem(null)}
          contentTitle={rejectingItem.title}
          versionNumber={rejectingItem.current_version}
          onConfirmReject={handleConfirmReject}
          isProcessing={isProcessing}
        />
      )}

      {timelineItem && (
        <ContentReviewTimelineModal
          isOpen={!!timelineItem}
          onClose={() => setTimelineItem(null)}
          contentId={timelineItem.id}
          contentTitle={timelineItem.title}
          getAuthHeaders={getAuthHeaders}
        />
      )}

      {resolvingModerationEvent && (
        <ModerationResolutionModal
          isOpen={!!resolvingModerationEvent}
          onClose={() => setResolvingModerationEvent(null)}
          event={resolvingModerationEvent}
          onResolve={handleConfirmResolveModeration}
          isProcessing={isProcessing}
        />
      )}
    </div>
  );
};
