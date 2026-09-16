/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ModerationStatus, ModerationRiskLevel } from './moderation';

export type ContentOperation =
  | 'generate'
  | 'summarize'
  | 'expand'
  | 'correct'
  | 'rewrite'
  | 'variations'
  | 'adapt_channel';

export type ContentChannel =
  | 'Social Media'
  | 'Advertisement'
  | 'Email'
  | 'Website'
  | 'General';

export type ContentStatus =
  | 'DRAFT'
  | 'AI_GENERATED'
  | 'HUMAN_EDITED'
  | 'READY_FOR_REVIEW'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED';

export type ReviewAction =
  | 'SUBMITTED_FOR_REVIEW'
  | 'REVIEW_STARTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'RESUBMITTED'
  | 'COMMENT_ADDED';

export interface ContentReviewEventModel {
  id: string;
  campaign_id: string;
  content_id: string;
  version_number: number;
  action: ReviewAction;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  previous_status: ContentStatus;
  new_status: ContentStatus;
  notes?: string;
  timestamp: string;
}

export interface ContentCommentModel {
  id: string;
  campaign_id: string;
  content_id: string;
  version_number: number;
  author_id: string;
  author_name: string;
  author_role: string;
  text: string;
  created_at: string;
}

export interface ContentApprovalRecordModel {
  id: string;
  campaign_id: string;
  content_id: string;
  version_number: number;
  decision: 'APPROVED' | 'REJECTED';
  reviewer_id: string;
  reviewer_name: string;
  reviewer_role: string;
  reason?: string;
  created_at: string;
}

export const VALID_CONTENT_STATUS_TRANSITIONS: Record<ContentStatus, readonly ContentStatus[]> = {
  DRAFT: ['READY_FOR_REVIEW', 'AI_GENERATED', 'HUMAN_EDITED'],
  AI_GENERATED: ['READY_FOR_REVIEW', 'HUMAN_EDITED', 'DRAFT'],
  HUMAN_EDITED: ['READY_FOR_REVIEW', 'AI_GENERATED', 'DRAFT'],
  READY_FOR_REVIEW: ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'DRAFT'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'READY_FOR_REVIEW'],
  APPROVED: [], // Terminal for this specific version. If revised, a new version is created.
  REJECTED: ['HUMAN_EDITED', 'READY_FOR_REVIEW', 'DRAFT'], // Revised by creator into a new version.
};

export function isValidContentStatusTransition(from: ContentStatus, to: ContentStatus): boolean {
  const allowed = VALID_CONTENT_STATUS_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export type TextAIProvider = 'anthropic';

export interface StructuredCampaignTextContext {
  campaignId: string;
  client: string;
  productOrService?: string;
  objective?: string;
  targetAudience?: string;
  keyMessage?: string;
  toneOfVoice?: string;
  language?: string;
  channels?: string[];
  creativeConstraints?: string;
}

export interface ContentGenerationRequestPayload {
  campaignId: string;
  contentId?: string; // Optional: target content if transforming existing document
  operation: ContentOperation;
  channel?: ContentChannel;
  targetAudience?: string;
  tone?: string;
  language?: string;
  instructions?: string;
  sourceContent?: string;
}

export interface ContentVersionModel {
  id: string;
  content_id: string;
  version_number: number;
  source_version?: number;
  author_id: string;
  author_name: string;
  author_role: string;
  provider?: TextAIProvider;
  model?: string;
  operation?: ContentOperation;
  content: string;
  notes?: string;
  created_at: string;
}

export interface ContentModel {
  id: string;
  campaign_id: string;
  title: string;
  channel: ContentChannel;
  status: ContentStatus;
  moderation_status?: ModerationStatus;
  moderation_risk?: ModerationRiskLevel;
  moderation_notes?: string;
  current_version: number;
  content: string;
  created_by: string;
  created_by_name?: string;
  created_by_role?: string;
  created_at: string;
  updated_at: string;
  versions?: ContentVersionModel[];
  rating?: number;
  evaluation_feedback?: string;
  rejection_reason?: string;
  reviewed_by?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  submitted_at?: string;
  comments?: ContentCommentModel[];
  review_events?: ContentReviewEventModel[];
}

export interface AIGenerationLogModel {
  id: string;
  campaign_id: string;
  content_id?: string;
  user_id: string;
  provider: TextAIProvider;
  model: string;
  operation: ContentOperation;
  status: 'COMPLETED' | 'BLOCKED' | 'RATE_LIMITED' | 'TIMEOUT' | 'VALIDATION_ERROR' | 'CONTROLLED_ERROR';
  duration_ms?: number;
  tokens_input?: number | 'TOKEN_USAGE_UNKNOWN';
  tokens_output?: number | 'TOKEN_USAGE_UNKNOWN';
  estimated_cost?: string; // e.g. "COST_UNKNOWN"
  error_message?: string;
  timestamp: string;
}

export interface ClaudeGenerationResult {
  success: boolean;
  provider: TextAIProvider;
  model: string;
  operation: ContentOperation;
  generatedContent?: string;
  variations?: string[];
  durationMs?: number;
  tokensInput: number | 'TOKEN_USAGE_UNKNOWN';
  tokensOutput: number | 'TOKEN_USAGE_UNKNOWN';
  estimatedCost: string;
  status: 'COMPLETED' | 'BLOCKED' | 'RATE_LIMITED' | 'TIMEOUT' | 'VALIDATION_ERROR' | 'CONTROLLED_ERROR';
  errorMessage?: string;
  statusCode?: number;
}
