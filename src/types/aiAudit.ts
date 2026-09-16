/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AIOperationStatus,
  AIModerationAuditStatus,
  CalculationStatus,
  TokenUsageStatus,
  CostSummaryMetrics,
  ROIFrameworkMetrics,
} from './cost';

export interface AIAuditEvent {
  id: string;
  user_id: string;
  user_name?: string;
  user_role?: string;
  campaign_id: string;
  campaign_name?: string;
  content_id?: string | null;
  asset_id?: string | null;
  provider: string; // 'anthropic' | 'stability_ai' | 'fallback_provider' | string
  model: string;
  operation: string; // 'generate' | 'summarize' | 'expand' | 'correct' | 'rewrite' | 'variations' | 'adapt_channel' | 'image_generate' | etc.
  status: AIOperationStatus;
  moderation_status: AIModerationAuditStatus;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  token_status: TokenUsageStatus;
  estimated_cost: number | null;
  currency: 'USD' | null;
  cost_status: CalculationStatus;
  error_code?: string | null;
  error_message?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface AIAuditFilterParams {
  userId?: string;
  campaignId?: string;
  provider?: string;
  model?: string;
  operation?: string;
  status?: AIOperationStatus;
  moderationStatus?: AIModerationAuditStatus;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface AIOperationalMetrics {
  totalOperations: number;
  successfulOperations: number;
  blockedOperations: number;
  failedOperations: number;
  moderationBlockedOperations: number;
  unknownOperations: number;
  averageDurationMs: number | null;
  operationsByProvider: Record<string, number>;
  operationsByModel: Record<string, number>;
  operationsByCampaign: Array<{
    campaignId: string;
    campaignName: string;
    count: number;
  }>;
  operationsByUser: Array<{
    userId: string;
    userName: string;
    count: number;
  }>;
}

export interface WorkflowDurationItem {
  contentId: string;
  title: string;
  campaignName: string;
  creationToApprovalMs: number | null;
  cycleDurationFormatted: string;
  revisionCount: number;
  status: string;
}

export interface ProductivityMetrics {
  contentVersionsCreated: number;
  aiAssistedVersions: number;
  humanEditedVersions: number;
  approvedContentCount: number;
  rejectedContentCount: number;
  revisionCount: number;
  imagesGenerated: number;
  contentGenerated: number;
  averageReviewCycleDurationMs: number | null;
  averageReviewCycleFormatted: string;
  workflowDurations: WorkflowDurationItem[];
}

export interface CompleteGovernanceMetricsResponse {
  operational: AIOperationalMetrics;
  costs: CostSummaryMetrics;
  productivity: ProductivityMetrics;
  roi: ROIFrameworkMetrics;
  auditEventsCount: number;
  recentAuditEvents: AIAuditEvent[];
}
