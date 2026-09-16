/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserRole } from '../src/types/auth';
import {
  ModerationEventModel,
  ModerationStatus,
  ModerationDecision,
} from '../src/types/moderation';

export class ModerationStore {
  private events: Map<string, ModerationEventModel> = new Map();

  constructor() {
    this.seedInitialEvents();
  }

  private seedInitialEvents() {
    // Seed an initial event for campaign demonstration
    const seedEvent: ModerationEventModel = {
      id: 'mod-seed-001',
      campaign_id: 'camp-spring-2026-001',
      user_id: 'user-copywriter-1',
      user_name: 'Camila Textos',
      user_role: 'Copywriter',
      resource_type: 'content',
      resource_id: 'content-seed-bio-01',
      version_number: 1,
      stage: 'INPUT',
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      operation: 'generate',
      risk_level: 'LOW_RISK',
      decision: 'ALLOW',
      categories: [],
      reason: 'Texto aprovado na verificação inicial de segurança determinística.',
      evaluated_snippet: 'Apresentamos o Anti-Aging Serum C-50. Uma fusão revolucionária...',
      status: 'LOW_RISK',
      created_at: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
    };

    this.events.set(seedEvent.id, seedEvent);
  }

  /**
   * Appends an immutable moderation event.
   */
  public createEvent(data: {
    campaign_id: string;
    user_id: string;
    user_name?: string;
    user_role?: UserRole;
    resource_type: 'content' | 'image_asset' | 'prompt';
    resource_id?: string;
    version_number?: number;
    stage: 'INPUT' | 'OUTPUT' | 'HUMAN_OVERRIDE';
    provider: string;
    model: string;
    operation?: string;
    risk_level: 'LOW_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK';
    decision: ModerationDecision;
    categories: any[];
    reason?: string;
    evaluated_snippet?: string;
  }): ModerationEventModel {
    const id = `mod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    let initialStatus: ModerationStatus = 'LOW_RISK';
    if (data.decision === 'BLOCK' || data.risk_level === 'HIGH_RISK') {
      initialStatus = 'BLOCKED';
    } else if (data.decision === 'REQUIRES_HUMAN_REVIEW' || data.risk_level === 'MEDIUM_RISK') {
      initialStatus = 'REQUIRES_HUMAN_REVIEW';
    }

    const event: ModerationEventModel = {
      id,
      campaign_id: data.campaign_id,
      user_id: data.user_id,
      user_name: data.user_name,
      user_role: data.user_role,
      resource_type: data.resource_type,
      resource_id: data.resource_id,
      version_number: data.version_number,
      stage: data.stage,
      provider: data.provider,
      model: data.model,
      operation: data.operation,
      risk_level: data.risk_level,
      decision: data.decision,
      categories: data.categories,
      reason: data.reason,
      evaluated_snippet: data.evaluated_snippet,
      status: initialStatus,
      created_at: new Date().toISOString(),
    };

    this.events.set(id, event);
    return event;
  }

  /**
   * Retrieves single moderation event.
   */
  public getEvent(id: string): ModerationEventModel | null {
    return this.events.get(id) || null;
  }

  /**
   * Lists moderation events scoped to a campaign.
   */
  public listEvents(campaignId?: string): ModerationEventModel[] {
    const all = Array.from(this.events.values());
    const filtered = campaignId ? all.filter((e) => e.campaign_id === campaignId) : all;
    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  /**
   * Lists moderation events requiring human review.
   */
  public listPendingReviews(campaignId?: string): ModerationEventModel[] {
    return this.listEvents(campaignId).filter(
      (e) => e.decision === 'REQUIRES_HUMAN_REVIEW' && e.status === 'REQUIRES_HUMAN_REVIEW'
    );
  }

  /**
   * Resolves a pending human moderation review.
   * STRICT GOVERNANCE RULES:
   * 1. Only 'Approver' or 'Administrator' can resolve.
   * 2. Creator cannot self-override high-risk moderation.
   * 3. Decision must be 'ALLOW' or 'BLOCK'.
   * 4. Meaningful justification notes are required.
   */
  public resolveReview(params: {
    eventId: string;
    resolver: { id: string; name: string; role: UserRole };
    decision: 'ALLOW' | 'BLOCK';
    notes: string;
  }): ModerationEventModel {
    const { eventId, resolver, decision, notes } = params;

    const event = this.events.get(eventId);
    if (!event) {
      throw new Error(`Evento de moderação '${eventId}' não foi encontrado.`);
    }

    // Role check
    if (resolver.role !== 'Approver' && resolver.role !== 'Administrator') {
      throw new Error(
        `Apenas usuários com papel 'Approver' ou 'Administrator' podem resolver itens de moderação. Seu papel é '${resolver.role}'.`
      );
    }

    if (!notes || notes.trim().length < 5) {
      throw new Error('Justificativa da resolução de moderação deve conter pelo menos 5 caracteres.');
    }

    const updatedStatus: ModerationStatus = decision === 'ALLOW' ? 'LOW_RISK' : 'BLOCKED';

    const updatedEvent: ModerationEventModel = {
      ...event,
      status: updatedStatus,
      resolution_decision: decision,
      resolved_by: resolver.id,
      resolved_by_name: resolver.name,
      resolved_by_role: resolver.role,
      resolved_at: new Date().toISOString(),
      resolution_notes: notes.trim(),
    };

    this.events.set(eventId, updatedEvent);
    return updatedEvent;
  }
}

export const moderationStore = new ModerationStore();
