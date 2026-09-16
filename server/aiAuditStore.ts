/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AIAuditEvent,
  AIAuditFilterParams,
  AIOperationalMetrics,
  ProductivityMetrics,
  WorkflowDurationItem,
} from '../src/types/aiAudit';
import {
  CalculationStatus,
  CostSummaryMetrics,
  ROIFrameworkMetrics,
  TokenUsageStatus,
} from '../src/types/cost';
import { costEngine } from './costEngine';
import { contentStore } from './contentStore';
import { imageAssetStore } from './imageAssetStore';

export type RecordAIAuditEventInput = Partial<AIAuditEvent> & {
  provider: string;
  model: string;
  operation: string;
  status: AIAuditEvent['status'];
};

export class AIAuditStore {
  private events: AIAuditEvent[] = [];

  constructor() {
    this.seedInitialAuditEvents();
  }

  /**
   * Appends an immutable AI audit event.
   * Modifying existing events is strictly prohibited.
   */
  public recordEvent(data: RecordAIAuditEventInput): AIAuditEvent {
    const id = data.id || `aiaudit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const createdAt = data.created_at || new Date().toISOString();

    // Determine token status safely
    let tokenStatus: TokenUsageStatus = data.token_status || 'TOKEN_USAGE_UNKNOWN';
    if (!data.token_status) {
      if (data.input_tokens !== null && data.input_tokens !== undefined) {
        tokenStatus = 'KNOWN';
      } else {
        tokenStatus = 'TOKEN_USAGE_UNKNOWN';
      }
    }

    // Determine cost calculation safely if not already computed
    let estimatedCost: number | null = data.estimated_cost ?? null;
    let costStatus: CalculationStatus = data.cost_status || 'COST_UNKNOWN';
    let currency: 'USD' | null = data.currency ?? 'USD';

    if (data.cost_status === undefined || (estimatedCost === null && data.cost_status !== 'COST_UNKNOWN')) {
      const calc = costEngine.calculateCost({
        provider: data.provider,
        model: data.model,
        operation: data.operation,
        usage: {
          inputTokens: data.input_tokens ?? undefined,
          outputTokens: data.output_tokens ?? undefined,
          totalTokens: data.total_tokens ?? undefined,
          imagesCount: data.metadata?.imagesCount,
          isFallback: data.provider === 'fallback_provider' || data.metadata?.isFallback === true,
          hasLiveCredential: data.metadata?.hasLiveCredential,
        },
        metadata: data.metadata,
      });
      estimatedCost = calc.estimated_cost;
      costStatus = calc.calculation_status;
      currency = calc.currency;
    }

    const newEvent: AIAuditEvent = {
      ...data,
      id,
      user_id: data.user_id || 'system',
      campaign_id: data.campaign_id || 'unassigned',
      moderation_status: data.moderation_status || 'LOW_RISK',
      started_at: data.started_at || createdAt,
      completed_at: data.completed_at ?? null,
      duration_ms: data.duration_ms !== undefined ? data.duration_ms : null,
      token_status: tokenStatus,
      input_tokens: data.input_tokens ?? null,
      output_tokens: data.output_tokens ?? null,
      total_tokens:
        data.total_tokens ??
        (data.input_tokens !== null && data.output_tokens !== null && data.input_tokens !== undefined && data.output_tokens !== undefined
          ? data.input_tokens + data.output_tokens
          : null),
      estimated_cost: estimatedCost,
      currency: currency,
      cost_status: costStatus,
      created_at: createdAt,
    };

    // Immutability: Push to append-only array
    this.events.push(Object.freeze(newEvent));
    return newEvent;
  }

  /**
   * Retrieve list of audit events with filtering.
   */
  public listEvents(filters?: AIAuditFilterParams): AIAuditEvent[] {
    let result = [...this.events];

    if (!filters) {
      return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    if (filters.userId) {
      result = result.filter((e) => e.user_id === filters.userId);
    }
    if (filters.campaignId) {
      result = result.filter((e) => e.campaign_id === filters.campaignId);
    }
    if (filters.provider) {
      result = result.filter((e) => e.provider.toLowerCase() === filters.provider!.toLowerCase());
    }
    if (filters.model) {
      result = result.filter((e) => e.model.toLowerCase() === filters.model!.toLowerCase());
    }
    if (filters.operation) {
      result = result.filter((e) => e.operation.toLowerCase() === filters.operation!.toLowerCase());
    }
    if (filters.status) {
      result = result.filter((e) => e.status === filters.status);
    }
    if (filters.moderationStatus) {
      result = result.filter((e) => e.moderation_status === filters.moderationStatus);
    }
    if (filters.startDate) {
      const start = new Date(filters.startDate).getTime();
      result = result.filter((e) => new Date(e.created_at).getTime() >= start);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate).getTime();
      result = result.filter((e) => new Date(e.created_at).getTime() <= end);
    }

    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (filters.offset !== undefined && filters.limit !== undefined) {
      return result.slice(filters.offset, filters.offset + filters.limit);
    }
    if (filters.limit !== undefined) {
      return result.slice(0, filters.limit);
    }

    return result;
  }

  public getEventById(id: string): AIAuditEvent | undefined {
    return this.events.find((e) => e.id === id);
  }

  /**
   * Operational Metrics
   * Phase 10B Requirement 10:
   * Distinguish: SUCCESS, BLOCKED, FAILED, UNKNOWN.
   * Do NOT classify blocked operations as failures.
   */
  public getOperationalMetrics(scope?: { campaignId?: string; userId?: string }): AIOperationalMetrics {
    let pool = [...this.events];
    if (scope?.campaignId) {
      pool = pool.filter((e) => e.campaign_id === scope.campaignId);
    }
    if (scope?.userId) {
      pool = pool.filter((e) => e.user_id === scope.userId);
    }

    const totalOperations = pool.length;
    let successfulOperations = 0;
    let blockedOperations = 0;
    let failedOperations = 0;
    let moderationBlockedOperations = 0;
    let unknownOperations = 0;

    let totalDurationMs = 0;
    let countWithDuration = 0;

    const operationsByProvider: Record<string, number> = {};
    const operationsByModel: Record<string, number> = {};
    const campaignCounts: Map<string, { campaignId: string; campaignName: string; count: number }> = new Map();
    const userCounts: Map<string, { userId: string; userName: string; count: number }> = new Map();

    pool.forEach((e) => {
      // Status categorization
      if (e.status === 'SUCCESS') {
        successfulOperations++;
      } else if (e.status === 'BLOCKED') {
        blockedOperations++;
      } else if (e.status === 'FAILED') {
        failedOperations++;
      } else {
        unknownOperations++;
      }

      // Moderation specific blocks
      if (e.moderation_status === 'HIGH_RISK' || e.moderation_status === 'REQUIRES_HUMAN_REVIEW') {
        moderationBlockedOperations++;
      }

      // Duration average
      if (e.duration_ms !== null && e.duration_ms !== undefined && e.duration_ms > 0) {
        totalDurationMs += e.duration_ms;
        countWithDuration++;
      }

      // By Provider
      operationsByProvider[e.provider] = (operationsByProvider[e.provider] || 0) + 1;

      // By Model
      operationsByModel[e.model] = (operationsByModel[e.model] || 0) + 1;

      // By Campaign
      const campId = e.campaign_id || 'unknown-campaign';
      const campName = e.campaign_name || campId;
      const currentCamp = campaignCounts.get(campId) || { campaignId: campId, campaignName: campName, count: 0 };
      currentCamp.count++;
      campaignCounts.set(campId, currentCamp);

      // By User
      const uId = e.user_id || 'unknown-user';
      const uName = e.user_name || uId;
      const currentUser = userCounts.get(uId) || { userId: uId, userName: uName, count: 0 };
      currentUser.count++;
      userCounts.set(uId, currentUser);
    });

    const averageDurationMs = countWithDuration > 0 ? Math.round(totalDurationMs / countWithDuration) : null;

    return {
      totalOperations,
      successfulOperations,
      blockedOperations,
      failedOperations,
      moderationBlockedOperations,
      unknownOperations,
      averageDurationMs,
      operationsByProvider,
      operationsByModel,
      operationsByCampaign: Array.from(campaignCounts.values()).sort((a, b) => b.count - a.count),
      operationsByUser: Array.from(userCounts.values()).sort((a, b) => b.count - a.count),
    };
  }

  /**
   * Aggregates AI Cost Summary Metrics
   * Phase 10B Requirements 6, 7, 8, 9:
   * Support: KNOWN, ESTIMATED, COST_UNKNOWN.
   * If any costs are unknown:
   * "Partial cost — some operations have unknown cost."
   */
  public getCostSummary(scope?: { campaignId?: string; userId?: string }): CostSummaryMetrics {
    let pool = [...this.events];
    if (scope?.campaignId) {
      pool = pool.filter((e) => e.campaign_id === scope.campaignId);
    }
    if (scope?.userId) {
      pool = pool.filter((e) => e.user_id === scope.userId);
    }

    let totalKnownCostUSD = 0;
    let totalEstimatedCostUSD = 0;
    let unknownCostOperationsCount = 0;

    const costByProvider: Record<
      string,
      { knownUSD: number; estimatedUSD: number; unknownCount: number; totalOperations: number }
    > = {};

    const campaignMap: Map<
      string,
      {
        campaignId: string;
        campaignName: string;
        knownCostUSD: number;
        estimatedCostUSD: number;
        unknownOperationsCount: number;
        breakdownMap: Map<string, { provider: string; operation: string; costUSD: number | null; costStatus: CalculationStatus; count: number }>;
      }
    > = new Map();

    const userMap: Map<
      string,
      {
        userId: string;
        userName: string;
        userRole: string;
        totalGenerations: number;
        textOperations: number;
        imageOperations: number;
        knownCostUSD: number;
        estimatedCostUSD: number;
        unknownCostOperationsCount: number;
      }
    > = new Map();

    pool.forEach((e) => {
      // Provider bucket
      if (!costByProvider[e.provider]) {
        costByProvider[e.provider] = { knownUSD: 0, estimatedUSD: 0, unknownCount: 0, totalOperations: 0 };
      }
      costByProvider[e.provider].totalOperations++;

      // Cost categorization
      if (e.cost_status === 'KNOWN' && e.estimated_cost !== null) {
        totalKnownCostUSD += e.estimated_cost;
        costByProvider[e.provider].knownUSD += e.estimated_cost;
      } else if (e.cost_status === 'ESTIMATED' && e.estimated_cost !== null) {
        totalEstimatedCostUSD += e.estimated_cost;
        costByProvider[e.provider].estimatedUSD += e.estimated_cost;
      } else {
        unknownCostOperationsCount++;
        costByProvider[e.provider].unknownCount++;
      }

      // Campaign aggregation
      const campId = e.campaign_id || 'unknown';
      const campName = e.campaign_name || campId;
      if (!campaignMap.has(campId)) {
        campaignMap.set(campId, {
          campaignId: campId,
          campaignName: campName,
          knownCostUSD: 0,
          estimatedCostUSD: 0,
          unknownOperationsCount: 0,
          breakdownMap: new Map(),
        });
      }
      const campRec = campaignMap.get(campId)!;
      if (e.cost_status === 'KNOWN' && e.estimated_cost !== null) {
        campRec.knownCostUSD += e.estimated_cost;
      } else if (e.cost_status === 'ESTIMATED' && e.estimated_cost !== null) {
        campRec.estimatedCostUSD += e.estimated_cost;
      } else {
        campRec.unknownOperationsCount++;
      }

      const opKey = `${e.provider}::${e.operation}`;
      if (!campRec.breakdownMap.has(opKey)) {
        campRec.breakdownMap.set(opKey, {
          provider: e.provider,
          operation: e.operation,
          costUSD: e.estimated_cost,
          costStatus: e.cost_status,
          count: 0,
        });
      }
      const opRec = campRec.breakdownMap.get(opKey)!;
      opRec.count++;
      if (e.cost_status === 'KNOWN' && e.estimated_cost !== null) {
        opRec.costUSD = (opRec.costUSD || 0) + e.estimated_cost;
      }

      // User aggregation
      const uId = e.user_id || 'unknown';
      const uName = e.user_name || uId;
      const uRole = e.user_role || 'Creator';
      if (!userMap.has(uId)) {
        userMap.set(uId, {
          userId: uId,
          userName: uName,
          userRole: uRole,
          totalGenerations: 0,
          textOperations: 0,
          imageOperations: 0,
          knownCostUSD: 0,
          estimatedCostUSD: 0,
          unknownCostOperationsCount: 0,
        });
      }
      const uRec = userMap.get(uId)!;
      uRec.totalGenerations++;
      if (e.operation.startsWith('image_') || e.provider.includes('stability')) {
        uRec.imageOperations++;
      } else {
        uRec.textOperations++;
      }

      if (e.cost_status === 'KNOWN' && e.estimated_cost !== null) {
        uRec.knownCostUSD += e.estimated_cost;
      } else if (e.cost_status === 'ESTIMATED' && e.estimated_cost !== null) {
        uRec.estimatedCostUSD += e.estimated_cost;
      } else {
        uRec.unknownCostOperationsCount++;
      }
    });

    const hasPartialCostWarning = unknownCostOperationsCount > 0;
    const partialCostNotice = hasPartialCostWarning
      ? 'Custo Parcial — algumas operações têm custo desconhecido ou não precificado.'
      : 'Todos os custos de inferência foram calculados com base em tabelas de preços confirmadas.';

    const costByCampaign = Array.from(campaignMap.values()).map((c) => ({
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      knownCostUSD: Math.round(c.knownCostUSD * 1000000) / 1000000,
      estimatedCostUSD: Math.round(c.estimatedCostUSD * 1000000) / 1000000,
      unknownOperationsCount: c.unknownOperationsCount,
      hasPartialCostWarning: c.unknownOperationsCount > 0,
      operationsBreakdown: Array.from(c.breakdownMap.values()).map((b) => ({
        ...b,
        costUSD: b.costUSD !== null ? Math.round(b.costUSD * 1000000) / 1000000 : null,
      })),
    }));

    const costByUser = Array.from(userMap.values()).map((u) => ({
      ...u,
      knownCostUSD: Math.round(u.knownCostUSD * 1000000) / 1000000,
      estimatedCostUSD: Math.round(u.estimatedCostUSD * 1000000) / 1000000,
    }));

    return {
      totalKnownCostUSD: Math.round(totalKnownCostUSD * 1000000) / 1000000,
      totalEstimatedCostUSD: Math.round(totalEstimatedCostUSD * 1000000) / 1000000,
      unknownCostOperationsCount,
      hasPartialCostWarning,
      partialCostNotice,
      costByProvider,
      costByCampaign,
      costByUser,
    };
  }

  /**
   * Productivity Metrics (Conservative, non-fabricated)
   * Phase 10B Requirement 11 & 13:
   * Distinguish WORKFLOW DURATION from TIME SAVED.
   * Do NOT claim hours saved without actual baseline.
   */
  public getProductivityMetrics(scope?: { campaignId?: string }): ProductivityMetrics {
    const allContents = scope?.campaignId
      ? contentStore.listCampaignContents(scope.campaignId)
      : contentStore.listAllContents();
    const allAssets = scope?.campaignId
      ? imageAssetStore.listAssetsByCampaign(scope.campaignId)
      : imageAssetStore.listAllAssets();

    let contentVersionsCreated = 0;
    let aiAssistedVersions = 0;
    let humanEditedVersions = 0;
    let approvedContentCount = 0;
    let rejectedContentCount = 0;
    let revisionCount = 0;

    const workflowDurations: WorkflowDurationItem[] = [];
    let totalCycleMs = 0;
    let completedCyclesCount = 0;

    allContents.forEach((c) => {
      const versions = c.versions || [];
      contentVersionsCreated += versions.length;

      versions.forEach((v) => {
        if (v.provider) {
          aiAssistedVersions++;
        } else {
          humanEditedVersions++;
        }
      });

      if (versions.length > 1) {
        revisionCount += versions.length - 1;
      }

      if (c.status === 'APPROVED') {
        approvedContentCount++;
      } else if (c.status === 'REJECTED') {
        rejectedContentCount++;
      }

      // Calculate workflow duration from creation to review/approval
      let durationMs: number | null = null;
      let durationFormatted = 'Em andamento';

      if (c.reviewed_at && c.created_at) {
        const diff = new Date(c.reviewed_at).getTime() - new Date(c.created_at).getTime();
        if (diff > 0) {
          durationMs = diff;
          totalCycleMs += diff;
          completedCyclesCount++;
          const minutes = Math.round(diff / (1000 * 60));
          if (minutes < 60) {
            durationFormatted = `${minutes} min`;
          } else {
            const hours = Math.floor(minutes / 60);
            const remainingMins = minutes % 60;
            durationFormatted = `${hours}h ${remainingMins}m`;
          }
        }
      }

      workflowDurations.push({
        contentId: c.id,
        title: c.title,
        campaignName: c.campaign_id,
        creationToApprovalMs: durationMs,
        cycleDurationFormatted: durationFormatted,
        revisionCount: versions.length > 1 ? versions.length - 1 : 0,
        status: c.status,
      });
    });

    const averageReviewCycleDurationMs =
      completedCyclesCount > 0 ? Math.round(totalCycleMs / completedCyclesCount) : null;

    let averageReviewCycleFormatted = 'Nenhum ciclo concluído';
    if (averageReviewCycleDurationMs !== null) {
      const mins = Math.round(averageReviewCycleDurationMs / (1000 * 60));
      if (mins < 60) {
        averageReviewCycleFormatted = `${mins} minutos`;
      } else {
        const hrs = Math.floor(mins / 60);
        const rm = mins % 60;
        averageReviewCycleFormatted = `${hrs} horas e ${rm} minutos`;
      }
    }

    return {
      contentVersionsCreated,
      aiAssistedVersions,
      humanEditedVersions,
      approvedContentCount,
      rejectedContentCount,
      revisionCount,
      imagesGenerated: allAssets.length,
      contentGenerated: allContents.length,
      averageReviewCycleDurationMs,
      averageReviewCycleFormatted,
      workflowDurations,
    };
  }

  /**
   * ROI Framework Metrics
   * Phase 10B Requirement 12 & 19:
   * If revenue or savings data is not available:
   * show: ROI DATA NOT AVAILABLE / ROI_DATA_NOT_AVAILABLE.
   * Do NOT calculate fake ROI.
   */
  public getROIMetrics(scope?: { campaignId?: string }): ROIFrameworkMetrics {
    const costMetrics = this.getCostSummary(scope);
    const prodMetrics = this.getProductivityMetrics(scope);

    let productionWorkflowTimeTotalMs = 0;
    prodMetrics.workflowDurations.forEach((w) => {
      if (w.creationToApprovalMs) {
        productionWorkflowTimeTotalMs += w.creationToApprovalMs;
      }
    });

    return {
      status: 'ROI_DATA_NOT_AVAILABLE',
      reason:
        'Dados contábeis de faturamento, receita atribuível à conversão de mídia ou valor-hora de agência humana não foram configurados para esta organização.',
      availableInputs: {
        aiOperationalKnownCostUSD: costMetrics.totalKnownCostUSD,
        aiOperationalEstimatedCostUSD: costMetrics.totalEstimatedCostUSD,
        productionWorkflowTimeTotalMs,
        totalAiOperations: this.events.length,
      },
      unavailableInputs: [
        'campaign_revenue',
        'client_billing_rate_hourly',
        'traditional_agency_baseline_cost',
        'actual_hours_saved_baseline',
      ],
      disclaimer:
        'A plataforma Creative AI não fabrica projeções financeiras artificiais. Métricas de ROI econômico permanecem estritamente marcadas como "ROI DATA NOT AVAILABLE" até que parâmetros comerciais reais sejam fornecidos.',
    };
  }

  /**
   * Pre-seed initial historical events representing real operational usage
   */
  private seedInitialAuditEvents(): void {
    const now = Date.now();

    // 1. Blocked Claude generation attempt (missing ANTHROPIC_API_KEY)
    this.recordEvent({
      id: 'aiaudit-seed-claude-blocked-01',
      campaign_id: 'camp-spring-2026-001',
      campaign_name: 'Lançamento Linha Bio-Glow 2026',
      user_id: 'user-copywriter-1',
      user_name: 'Camila Textos',
      user_role: 'Copywriter',
      content_id: 'content-seed-bio-01',
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      operation: 'generate',
      status: 'BLOCKED',
      moderation_status: 'LOW_RISK',
      started_at: new Date(now - 3600 * 1000 * 5).toISOString(),
      completed_at: new Date(now - 3600 * 1000 * 5 + 42).toISOString(),
      duration_ms: 42,
      input_tokens: null,
      output_tokens: null,
      total_tokens: null,
      token_status: 'TOKEN_USAGE_UNKNOWN',
      estimated_cost: null,
      currency: 'USD',
      cost_status: 'COST_UNKNOWN',
      error_code: 'PROVIDER_BLOCKED_UNCONFIGURED_CREDENTIAL',
      error_message: 'ANTHROPIC_API_KEY não configurada no servidor.',
      created_at: new Date(now - 3600 * 1000 * 5).toISOString(),
    });

    // 2. High risk input moderation block (Critical Safety rule triggered)
    this.recordEvent({
      id: 'aiaudit-seed-moderation-block-02',
      campaign_id: 'camp-spring-2026-001',
      campaign_name: 'Lançamento Linha Bio-Glow 2026',
      user_id: 'user-copywriter-1',
      user_name: 'Camila Textos',
      user_role: 'Copywriter',
      content_id: 'content-seed-bio-01',
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      operation: 'generate',
      status: 'BLOCKED',
      moderation_status: 'HIGH_RISK',
      started_at: new Date(now - 3600 * 1000 * 24).toISOString(),
      completed_at: new Date(now - 3600 * 1000 * 24 + 18).toISOString(),
      duration_ms: 18,
      input_tokens: null,
      output_tokens: null,
      total_tokens: null,
      token_status: 'TOKEN_USAGE_UNKNOWN',
      estimated_cost: null,
      currency: 'USD',
      cost_status: 'COST_UNKNOWN',
      error_code: 'MODERATION_BLOCKED',
      error_message: 'Termos proibidos de segurança crítica interceptados antes do envio ao modelo.',
      created_at: new Date(now - 3600 * 1000 * 24).toISOString(),
    });

    // 3. Stability AI Prototype Visual Generation (Fallback vector provider)
    // Requirement 24: Real production cost cannot be claimed; record COST_UNKNOWN
    this.recordEvent({
      id: 'aiaudit-seed-stability-fallback-03',
      campaign_id: 'camp-spring-2026-001',
      campaign_name: 'Lançamento Linha Bio-Glow 2026',
      user_id: 'user-designer-1',
      user_name: 'Lucas Designer',
      user_role: 'Designer',
      asset_id: 'asset-seed-01',
      provider: 'fallback_provider',
      model: 'vector-svg-prototype-v1',
      operation: 'image_generate',
      status: 'SUCCESS',
      moderation_status: 'LOW_RISK',
      started_at: new Date(now - 3600 * 1000 * 30).toISOString(),
      completed_at: new Date(now - 3600 * 1000 * 30 + 350).toISOString(),
      duration_ms: 350,
      input_tokens: null,
      output_tokens: null,
      total_tokens: null,
      token_status: 'TOKEN_USAGE_UNKNOWN',
      estimated_cost: null,
      currency: 'USD',
      cost_status: 'COST_UNKNOWN',
      metadata: {
        dimensions: { width: 1024, height: 1024 },
        aspectRatio: '1:1',
        style: 'Photorealistic',
        isFallback: true,
      },
      created_at: new Date(now - 3600 * 1000 * 30).toISOString(),
    });

    // 4. Controlled Test Inference with Verified Tokens (for demonstration of KNOWN pricing calculation)
    this.recordEvent({
      id: 'aiaudit-seed-verified-tokens-04',
      campaign_id: 'camp-spring-2026-001',
      campaign_name: 'Lançamento Linha Bio-Glow 2026',
      user_id: 'user-copywriter-1',
      user_name: 'Camila Textos',
      user_role: 'Copywriter',
      content_id: 'content-seed-bio-01',
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      operation: 'variations',
      status: 'SUCCESS',
      moderation_status: 'LOW_RISK',
      started_at: new Date(now - 3600 * 1000 * 40).toISOString(),
      completed_at: new Date(now - 3600 * 1000 * 40 + 1420).toISOString(),
      duration_ms: 1420,
      input_tokens: 450,
      output_tokens: 180,
      total_tokens: 630,
      token_status: 'KNOWN',
      estimated_cost: 0.00405, // 0.450 * 0.003 + 0.180 * 0.015 = 0.00135 + 0.0027 = 0.00405
      currency: 'USD',
      cost_status: 'KNOWN',
      created_at: new Date(now - 3600 * 1000 * 40).toISOString(),
    });
  }
}

export const aiAuditStore = new AIAuditStore();
