/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ContentModel,
  ContentVersionModel,
  AIGenerationLogModel,
  ContentStatus,
  ContentChannel,
  ContentOperation,
  TextAIProvider,
  ContentCommentModel,
  ContentReviewEventModel,
  ContentApprovalRecordModel,
  isValidContentStatusTransition,
} from '../src/types/content';
import { ModerationStatus, ModerationRiskLevel } from '../src/types/moderation';

export class ContentStore {
  private contents: Map<string, ContentModel> = new Map();
  private versions: Map<string, ContentVersionModel[]> = new Map(); // content_id -> list of versions
  private comments: Map<string, ContentCommentModel[]> = new Map(); // content_id -> list of comments
  private reviewEvents: Map<string, ContentReviewEventModel[]> = new Map(); // content_id -> review timeline
  private approvalRecords: ContentApprovalRecordModel[] = [];
  private logs: AIGenerationLogModel[] = [];

  constructor() {
    this.seedInitialContents();
  }

  private seedInitialContents() {
    const defaultContentId = 'content-seed-bio-01';
    const initialVersion: ContentVersionModel = {
      id: 'ver-bio-01-1',
      content_id: defaultContentId,
      version_number: 1,
      author_id: 'user-copywriter-1',
      author_name: 'Camila Textos',
      author_role: 'Copywriter',
      content:
        'Apresentamos o Anti-Aging Serum C-50. Uma fusão revolucionária de botânica de precisão e biotecnologia dermatológica. Desenvolvido para restaurar a luminosidade e a jovialidade celular sem agredir sua pele.',
      notes: 'Rascunho inicial baseado no briefing de lançamento.',
      created_at: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
    };

    const initialContent: ContentModel = {
      id: defaultContentId,
      campaign_id: 'camp-spring-2026-001',
      title: 'Manifesto Principal & Bio-Tech Hook',
      channel: 'Social Media',
      status: 'READY_FOR_REVIEW',
      current_version: 1,
      content: initialVersion.content,
      created_by: 'user-copywriter-1',
      created_by_name: 'Camila Textos',
      created_by_role: 'Copywriter',
      created_at: initialVersion.created_at,
      updated_at: initialVersion.created_at,
      submitted_at: initialVersion.created_at,
      rating: 4,
      evaluation_feedback: 'Texto cativante e dentro das restrições éticas.',
    };

    this.contents.set(defaultContentId, initialContent);
    this.versions.set(defaultContentId, [initialVersion]);

    // Initial review event for seed content
    const initialEvent: ContentReviewEventModel = {
      id: `rev-evt-seed-1`,
      campaign_id: 'camp-spring-2026-001',
      content_id: defaultContentId,
      version_number: 1,
      action: 'SUBMITTED_FOR_REVIEW',
      actor_id: 'user-copywriter-1',
      actor_name: 'Camila Textos',
      actor_role: 'Copywriter',
      previous_status: 'HUMAN_EDITED',
      new_status: 'READY_FOR_REVIEW',
      notes: 'Envio inicial para validação de tom e conformidade regulatória.',
      timestamp: initialVersion.created_at,
    };
    this.reviewEvents.set(defaultContentId, [initialEvent]);
  }

  public listCampaignContents(campaignId: string): ContentModel[] {
    const list: ContentModel[] = [];
    for (const item of this.contents.values()) {
      if (item.campaign_id === campaignId) {
        const itemVersions = this.versions.get(item.id) || [];
        const itemComments = this.comments.get(item.id) || [];
        const itemEvents = this.reviewEvents.get(item.id) || [];
        list.push({
          ...item,
          versions: [...itemVersions],
          comments: [...itemComments],
          review_events: [...itemEvents],
        });
      }
    }
    return list.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }

  public listAllContents(): ContentModel[] {
    const list: ContentModel[] = [];
    for (const item of this.contents.values()) {
      const itemVersions = this.versions.get(item.id) || [];
      const itemComments = this.comments.get(item.id) || [];
      const itemEvents = this.reviewEvents.get(item.id) || [];
      list.push({
        ...item,
        versions: [...itemVersions],
        comments: [...itemComments],
        review_events: [...itemEvents],
      });
    }
    return list.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }

  public getContent(id: string): ContentModel | null {
    const item = this.contents.get(id);
    if (!item) return null;
    const itemVersions = this.versions.get(id) || [];
    const itemComments = this.comments.get(id) || [];
    const itemEvents = this.reviewEvents.get(id) || [];
    return {
      ...item,
      versions: [...itemVersions],
      comments: [...itemComments],
      review_events: [...itemEvents],
    };
  }

  public createContent(data: {
    campaign_id: string;
    title: string;
    channel: ContentChannel;
    content: string;
    created_by: string;
    created_by_name?: string;
    created_by_role?: string;
    status?: ContentStatus;
    moderation_status?: ModerationStatus;
    moderation_risk?: ModerationRiskLevel;
    moderation_notes?: string;
    provider?: TextAIProvider;
    model?: string;
    operation?: ContentOperation;
  }): ContentModel {
    const id = `content-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const initialVersion: ContentVersionModel = {
      id: `ver-${id}-1`,
      content_id: id,
      version_number: 1,
      author_id: data.created_by,
      author_name: data.created_by_name || 'Usuário',
      author_role: data.created_by_role || 'Copywriter',
      provider: data.provider,
      model: data.model,
      operation: data.operation,
      content: data.content,
      notes: data.provider ? `Gerado via ${data.provider}` : 'Criação inicial humana',
      created_at: now,
    };

    const newContent: ContentModel = {
      id,
      campaign_id: data.campaign_id,
      title: data.title || 'Conteúdo Sem Título',
      channel: data.channel,
      status: data.status || (data.provider ? 'AI_GENERATED' : 'DRAFT'),
      moderation_status: data.moderation_status || 'LOW_RISK',
      moderation_risk: data.moderation_risk || 'LOW_RISK',
      moderation_notes: data.moderation_notes,
      current_version: 1,
      content: data.content,
      created_by: data.created_by,
      created_by_name: data.created_by_name,
      created_by_role: data.created_by_role,
      created_at: now,
      updated_at: now,
    };

    this.contents.set(id, newContent);
    this.versions.set(id, [initialVersion]);

    return { ...newContent, versions: [initialVersion] };
  }

  public saveNewVersion(
    contentId: string,
    data: {
      author_id: string;
      author_name: string;
      author_role: string;
      content: string;
      provider?: TextAIProvider;
      model?: string;
      operation?: ContentOperation;
      notes?: string;
      status?: ContentStatus;
      moderation_status?: ModerationStatus;
      moderation_risk?: ModerationRiskLevel;
      moderation_notes?: string;
    }
  ): { content: ContentModel; version: ContentVersionModel } | null {
    const existing = this.contents.get(contentId);
    if (!existing) return null;

    const existingVersions = this.versions.get(contentId) || [];
    const nextVersionNum = existingVersions.length + 1;
    const now = new Date().toISOString();

    const newVersion: ContentVersionModel = {
      id: `ver-${contentId}-${nextVersionNum}`,
      content_id: contentId,
      version_number: nextVersionNum,
      source_version: existing.current_version,
      author_id: data.author_id,
      author_name: data.author_name,
      author_role: data.author_role,
      provider: data.provider,
      model: data.model,
      operation: data.operation,
      content: data.content,
      notes: data.notes || (data.provider ? `Versão gerada por ${data.provider} (${data.operation})` : 'Edição manual do autor'),
      created_at: now,
    };

    existingVersions.push(newVersion);
    this.versions.set(contentId, existingVersions);

    existing.content = data.content;
    existing.current_version = nextVersionNum;
    existing.updated_at = now;
    if (data.status) {
      existing.status = data.status;
    } else if (data.provider) {
      existing.status = 'AI_GENERATED';
    } else {
      existing.status = 'HUMAN_EDITED';
    }

    if (data.moderation_status) {
      existing.moderation_status = data.moderation_status;
    }
    if (data.moderation_risk) {
      existing.moderation_risk = data.moderation_risk;
    }
    if (data.moderation_notes !== undefined) {
      existing.moderation_notes = data.moderation_notes;
    }

    this.contents.set(contentId, existing);
    return {
      content: { ...existing, versions: [...existingVersions] },
      version: newVersion,
    };
  }

  public updateContentModeration(
    contentId: string,
    status: ModerationStatus,
    risk: ModerationRiskLevel,
    notes?: string
  ): ContentModel | null {
    const existing = this.contents.get(contentId);
    if (!existing) return null;

    existing.moderation_status = status;
    existing.moderation_risk = risk;
    if (notes !== undefined) {
      existing.moderation_notes = notes;
    }
    existing.updated_at = new Date().toISOString();

    this.contents.set(contentId, existing);
    return this.getContent(contentId);
  }

  public restoreVersion(contentId: string, targetVersionNumber: number, restoredBy: { id: string; name: string; role: string }): ContentModel | null {
    const existing = this.contents.get(contentId);
    if (!existing) return null;

    const existingVersions = this.versions.get(contentId) || [];
    const targetVer = existingVersions.find((v) => v.version_number === targetVersionNumber);
    if (!targetVer) return null;

    // Never destroy previous history: restoring creates a new version referencing the target
    const nextVersionNum = existingVersions.length + 1;
    const now = new Date().toISOString();

    const restoreVersionRecord: ContentVersionModel = {
      id: `ver-${contentId}-${nextVersionNum}`,
      content_id: contentId,
      version_number: nextVersionNum,
      source_version: targetVersionNumber,
      author_id: restoredBy.id,
      author_name: restoredBy.name,
      author_role: restoredBy.role,
      content: targetVer.content,
      notes: `Restaurada a partir da Versão #${targetVersionNumber}`,
      created_at: now,
    };

    existingVersions.push(restoreVersionRecord);
    this.versions.set(contentId, existingVersions);

    existing.content = targetVer.content;
    existing.current_version = nextVersionNum;
    existing.updated_at = now;
    existing.status = 'HUMAN_EDITED';

    this.contents.set(contentId, existing);
    return { ...existing, versions: [...existingVersions] };
  }

  public evaluateContent(contentId: string, rating: number, feedback?: string): ContentModel | null {
    const existing = this.contents.get(contentId);
    if (!existing) return null;

    existing.rating = rating;
    if (feedback !== undefined) {
      existing.evaluation_feedback = feedback;
    }
    existing.updated_at = new Date().toISOString();
    this.contents.set(contentId, existing);

    const vList = this.versions.get(contentId) || [];
    return { ...existing, versions: [...vList] };
  }

  public logAIGeneration(entry: Omit<AIGenerationLogModel, 'id' | 'timestamp'>): AIGenerationLogModel {
    const log: AIGenerationLogModel = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.logs.push(log);
    return log;
  }

  public getAILogs(campaignId?: string): AIGenerationLogModel[] {
    if (campaignId) {
      return this.logs.filter((l) => l.campaign_id === campaignId);
    }
    return [...this.logs];
  }

  // -------------------------------------------------------------
  // PHASE 9 WORKFLOW & COLLABORATION METHODS
  // -------------------------------------------------------------

  /**
   * Submit content for review.
   * Validates:
   * - Content exists
   * - Content has actual text
   * - Transition from current status to READY_FOR_REVIEW is valid
   * - Appends append-only review event (SUBMITTED_FOR_REVIEW or RESUBMITTED)
   */
  public submitForReview(
    contentId: string,
    actor: { id: string; name: string; role: string }
  ): { success: boolean; content?: ContentModel; event?: ContentReviewEventModel; error?: string } {
    const existing = this.contents.get(contentId);
    if (!existing) {
      return { success: false, error: 'Conteúdo não encontrado.' };
    }

    if (!existing.content || !existing.content.trim()) {
      return {
        success: false,
        error: 'Não é possível submeter para revisão um conteúdo vazio.',
      };
    }

    if (!isValidContentStatusTransition(existing.status, 'READY_FOR_REVIEW')) {
      return {
        success: false,
        error: `Transição inválida: Não é permitido mudar de '${existing.status}' para 'READY_FOR_REVIEW'.`,
      };
    }

    const previousStatus = existing.status;
    const isResubmission = previousStatus === 'REJECTED' || previousStatus === 'HUMAN_EDITED';
    const now = new Date().toISOString();

    existing.status = 'READY_FOR_REVIEW';
    existing.submitted_at = now;
    existing.updated_at = now;
    this.contents.set(contentId, existing);

    const event: ContentReviewEventModel = {
      id: `rev-evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      campaign_id: existing.campaign_id,
      content_id: contentId,
      version_number: existing.current_version,
      action: isResubmission ? 'RESUBMITTED' : 'SUBMITTED_FOR_REVIEW',
      actor_id: actor.id,
      actor_name: actor.name,
      actor_role: actor.role,
      previous_status: previousStatus,
      new_status: 'READY_FOR_REVIEW',
      notes: isResubmission
        ? `Versão #${existing.current_version} reenviada para revisão após edições.`
        : `Versão #${existing.current_version} submetida formalmente para aprovação.`,
      timestamp: now,
    };

    const events = this.reviewEvents.get(contentId) || [];
    events.push(event);
    this.reviewEvents.set(contentId, events);

    return {
      success: true,
      content: this.getContent(contentId)!,
      event,
    };
  }

  /**
   * Start review of content (transitions READY_FOR_REVIEW -> UNDER_REVIEW)
   */
  public startReview(
    contentId: string,
    actor: { id: string; name: string; role: string }
  ): { success: boolean; content?: ContentModel; event?: ContentReviewEventModel; error?: string } {
    const existing = this.contents.get(contentId);
    if (!existing) {
      return { success: false, error: 'Conteúdo não encontrado.' };
    }

    if (!isValidContentStatusTransition(existing.status, 'UNDER_REVIEW')) {
      return {
        success: false,
        error: `Transição inválida: Não é permitido iniciar revisão a partir do status '${existing.status}'.`,
      };
    }

    const previousStatus = existing.status;
    const now = new Date().toISOString();

    existing.status = 'UNDER_REVIEW';
    existing.updated_at = now;
    this.contents.set(contentId, existing);

    const event: ContentReviewEventModel = {
      id: `rev-evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      campaign_id: existing.campaign_id,
      content_id: contentId,
      version_number: existing.current_version,
      action: 'REVIEW_STARTED',
      actor_id: actor.id,
      actor_name: actor.name,
      actor_role: actor.role,
      previous_status: previousStatus,
      new_status: 'UNDER_REVIEW',
      notes: `Revisão iniciada por ${actor.name} (${actor.role}).`,
      timestamp: now,
    };

    const events = this.reviewEvents.get(contentId) || [];
    events.push(event);
    this.reviewEvents.set(contentId, events);

    return {
      success: true,
      content: this.getContent(contentId)!,
      event,
    };
  }

  /**
   * Approve content.
   * CRITICAL GOVERNANCE RULE:
   * The creator of a content item MUST NEVER be allowed to approve that same content item!
   * Enforced server-side.
   * On success:
   * - Status transitions to APPROVED
   * - Does NOT modify the content body
   * - Records append-only approval record and review event
   */
  public approveContent(
    contentId: string,
    reviewer: { id: string; name: string; role: string },
    comment?: string
  ): {
    success: boolean;
    content?: ContentModel;
    record?: ContentApprovalRecordModel;
    event?: ContentReviewEventModel;
    error?: string;
  } {
    const existing = this.contents.get(contentId);
    if (!existing) {
      return { success: false, error: 'Conteúdo não encontrado.' };
    }

    // CRITICAL ANTI-SELF-APPROVAL RULE
    if (existing.created_by === reviewer.id) {
      return {
        success: false,
        error: 'Violação de Governança: O criador do conteúdo não pode aprovar a própria peça.',
      };
    }

    if (!isValidContentStatusTransition(existing.status, 'APPROVED')) {
      return {
        success: false,
        error: `Transição inválida: Não é permitido aprovar conteúdo com status '${existing.status}'.`,
      };
    }

    const previousStatus = existing.status;
    const now = new Date().toISOString();

    existing.status = 'APPROVED';
    existing.reviewed_by = reviewer.id;
    existing.reviewed_by_name = reviewer.name;
    existing.reviewed_at = now;
    existing.updated_at = now;
    // Clear any past rejection reason
    existing.rejection_reason = undefined;
    this.contents.set(contentId, existing);

    const record: ContentApprovalRecordModel = {
      id: `app-rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      campaign_id: existing.campaign_id,
      content_id: contentId,
      version_number: existing.current_version,
      decision: 'APPROVED',
      reviewer_id: reviewer.id,
      reviewer_name: reviewer.name,
      reviewer_role: reviewer.role,
      reason: comment || undefined,
      created_at: now,
    };
    this.approvalRecords.push(record);

    const event: ContentReviewEventModel = {
      id: `rev-evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      campaign_id: existing.campaign_id,
      content_id: contentId,
      version_number: existing.current_version,
      action: 'APPROVED',
      actor_id: reviewer.id,
      actor_name: reviewer.name,
      actor_role: reviewer.role,
      previous_status: previousStatus,
      new_status: 'APPROVED',
      notes: comment ? `Aprovado: ${comment}` : `Conteúdo versão #${existing.current_version} aprovado formalmente.`,
      timestamp: now,
    };

    const events = this.reviewEvents.get(contentId) || [];
    events.push(event);
    this.reviewEvents.set(contentId, events);

    return {
      success: true,
      content: this.getContent(contentId)!,
      record,
      event,
    };
  }

  /**
   * Reject content.
   * Rejection MUST require a meaningful justification.
   * Does NOT allow empty or whitespace-only reasons.
   */
  public rejectContent(
    contentId: string,
    reviewer: { id: string; name: string; role: string },
    reason: string
  ): {
    success: boolean;
    content?: ContentModel;
    record?: ContentApprovalRecordModel;
    event?: ContentReviewEventModel;
    error?: string;
  } {
    const existing = this.contents.get(contentId);
    if (!existing) {
      return { success: false, error: 'Conteúdo não encontrado.' };
    }

    // Meaningful justification check
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return {
        success: false,
        error: 'Justificativa de rejeição é obrigatória e não pode ser vazia.',
      };
    }

    if (!isValidContentStatusTransition(existing.status, 'REJECTED')) {
      return {
        success: false,
        error: `Transição inválida: Não é permitido rejeitar conteúdo com status '${existing.status}'.`,
      };
    }

    const previousStatus = existing.status;
    const now = new Date().toISOString();
    const cleanReason = reason.trim();

    existing.status = 'REJECTED';
    existing.rejection_reason = cleanReason;
    existing.reviewed_by = reviewer.id;
    existing.reviewed_by_name = reviewer.name;
    existing.reviewed_at = now;
    existing.updated_at = now;
    this.contents.set(contentId, existing);

    const record: ContentApprovalRecordModel = {
      id: `app-rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      campaign_id: existing.campaign_id,
      content_id: contentId,
      version_number: existing.current_version,
      decision: 'REJECTED',
      reviewer_id: reviewer.id,
      reviewer_name: reviewer.name,
      reviewer_role: reviewer.role,
      reason: cleanReason,
      created_at: now,
    };
    this.approvalRecords.push(record);

    const event: ContentReviewEventModel = {
      id: `rev-evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      campaign_id: existing.campaign_id,
      content_id: contentId,
      version_number: existing.current_version,
      action: 'REJECTED',
      actor_id: reviewer.id,
      actor_name: reviewer.name,
      actor_role: reviewer.role,
      previous_status: previousStatus,
      new_status: 'REJECTED',
      notes: `Rejeitado com a justificativa: "${cleanReason}"`,
      timestamp: now,
    };

    const events = this.reviewEvents.get(contentId) || [];
    events.push(event);
    this.reviewEvents.set(contentId, events);

    return {
      success: true,
      content: this.getContent(contentId)!,
      record,
      event,
    };
  }

  /**
   * Revise rejected content:
   * When content is rejected, the creator may revise it.
   * The creator must NOT overwrite the rejected version.
   * Instead: Rejected Version -> New Version -> Human Edit -> READY_FOR_REVIEW.
   */
  public reviseRejectedContent(
    contentId: string,
    revisor: { id: string; name: string; role: string },
    newContentText: string,
    notes?: string
  ): {
    success: boolean;
    content?: ContentModel;
    version?: ContentVersionModel;
    error?: string;
  } {
    const existing = this.contents.get(contentId);
    if (!existing) {
      return { success: false, error: 'Conteúdo não encontrado.' };
    }

    if (existing.status !== 'REJECTED') {
      return {
        success: false,
        error: `Apenas conteúdos rejeitados podem iniciar o fluxo de revisão a partir de rejeição. Status atual: '${existing.status}'.`,
      };
    }

    // Save as brand new version, preserving rejected version completely
    const saveResult = this.saveNewVersion(contentId, {
      author_id: revisor.id,
      author_name: revisor.name,
      author_role: revisor.role,
      content: newContentText,
      notes: notes || `Revisão após rejeição (Versão anterior #${existing.current_version})`,
      status: 'HUMAN_EDITED',
    });

    if (!saveResult) {
      return { success: false, error: 'Falha ao criar nova versão de revisão.' };
    }

    return {
      success: true,
      content: this.getContent(contentId)!,
      version: saveResult.version,
    };
  }

  /**
   * Add collaboration comment.
   */
  public addComment(
    contentId: string,
    commentData: {
      campaign_id: string;
      version_number: number;
      author_id: string;
      author_name: string;
      author_role: string;
      text: string;
    }
  ): { success: boolean; comment?: ContentCommentModel; error?: string } {
    const existing = this.contents.get(contentId);
    if (!existing) {
      return { success: false, error: 'Conteúdo não encontrado.' };
    }

    if (!commentData.text || !commentData.text.trim()) {
      return { success: false, error: 'O texto do comentário é obrigatório.' };
    }

    const now = new Date().toISOString();
    const comment: ContentCommentModel = {
      id: `cmt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      campaign_id: existing.campaign_id,
      content_id: contentId,
      version_number: commentData.version_number || existing.current_version,
      author_id: commentData.author_id,
      author_name: commentData.author_name,
      author_role: commentData.author_role,
      text: commentData.text.trim(),
      created_at: now,
    };

    const comments = this.comments.get(contentId) || [];
    comments.push(comment);
    this.comments.set(contentId, comments);

    // Record review event for comment
    const event: ContentReviewEventModel = {
      id: `rev-evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      campaign_id: existing.campaign_id,
      content_id: contentId,
      version_number: comment.version_number,
      action: 'COMMENT_ADDED',
      actor_id: commentData.author_id,
      actor_name: commentData.author_name,
      actor_role: commentData.author_role,
      previous_status: existing.status,
      new_status: existing.status,
      notes: `Comentário adicionado: "${comment.text.substring(0, 60)}${comment.text.length > 60 ? '...' : ''}"`,
      timestamp: now,
    };

    const events = this.reviewEvents.get(contentId) || [];
    events.push(event);
    this.reviewEvents.set(contentId, events);

    return { success: true, comment };
  }

  public getComments(contentId: string): ContentCommentModel[] {
    return [...(this.comments.get(contentId) || [])];
  }

  public getContentVersions(contentId: string): ContentVersionModel[] {
    return [...(this.versions.get(contentId) || [])];
  }

  public getReviewEvents(contentId: string): ContentReviewEventModel[] {
    return [...(this.reviewEvents.get(contentId) || [])];
  }

  public getApprovalRecords(contentId?: string): ContentApprovalRecordModel[] {
    if (contentId) {
      return this.approvalRecords.filter((r) => r.content_id === contentId);
    }
    return [...this.approvalRecords];
  }

  public getReviewQueue(campaignId?: string, statusFilter?: ContentStatus): ContentModel[] {
    const list: ContentModel[] = [];
    for (const item of this.contents.values()) {
      if (campaignId && item.campaign_id !== campaignId) {
        continue;
      }
      if (statusFilter) {
        if (item.status === statusFilter) {
          list.push(this.getContent(item.id)!);
        }
      } else {
        // By default return review-relevant items or all
        list.push(this.getContent(item.id)!);
      }
    }
    return list.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }
}

export const contentStore = new ContentStore();
