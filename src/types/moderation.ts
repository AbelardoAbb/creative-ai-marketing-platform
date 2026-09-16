/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserRole } from './auth';

export type ModerationRiskLevel = 'LOW_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK';

export type ModerationDecision = 'ALLOW' | 'REQUIRES_HUMAN_REVIEW' | 'BLOCK';

export type ModerationStatus =
  | 'PENDING'
  | 'LOW_RISK'
  | 'MEDIUM_RISK'
  | 'HIGH_RISK'
  | 'REQUIRES_HUMAN_REVIEW'
  | 'BLOCKED';

export type ModerationStage = 'INPUT' | 'OUTPUT' | 'HUMAN_OVERRIDE';

export type ModerationResourceType = 'content' | 'image_asset' | 'prompt';

export type ModerationCategory =
  | 'harmful_instructions'
  | 'violence_gore'
  | 'child_safety'
  | 'hate_speech'
  | 'weapons_explosives'
  | 'prohibited_materials'
  | 'explicit_nsfw'
  | 'prompt_injection'
  | 'pii_and_credentials'
  | 'deepfake_celebrity'
  | 'controversial_political'
  | 'illegal_fraud_interference';

/**
 * Structured evaluation result returned by the central ModerationEngine.
 * 
 * NOTE (MVP Documentation Notice):
 * This system implements an MVP deterministic rule-based safety mechanism.
 * It does NOT claim to provide comprehensive AI safety or complete semantic understanding.
 */
export interface ModerationEvaluationResult {
  decision: ModerationDecision;
  riskLevel: ModerationRiskLevel;
  isSafe: boolean;
  flagged: boolean;
  categories: ModerationCategory[];
  reason?: string;
  requiresHumanReview: boolean;
  evaluatedSnippet?: string;
  isDeterministicMvp: true;
}

/**
 * Append-only Moderation Event record for audit and governance.
 */
export interface ModerationEventModel {
  id: string;
  campaign_id: string;
  user_id: string;
  user_name?: string;
  user_role?: UserRole;
  resource_type: ModerationResourceType;
  resource_id?: string;
  version_number?: number;
  stage: ModerationStage;
  provider: string; // 'anthropic' | 'stability_ai' | 'system'
  model: string;
  operation?: string;
  risk_level: ModerationRiskLevel;
  decision: ModerationDecision;
  categories: ModerationCategory[];
  reason?: string;
  evaluated_snippet?: string;
  status: ModerationStatus;
  resolved_by?: string;
  resolved_by_name?: string;
  resolved_by_role?: UserRole;
  resolved_at?: string;
  resolution_notes?: string;
  resolution_decision?: 'ALLOW' | 'BLOCK';
  created_at: string;
}

/**
 * Input moderation request payload
 */
export interface ModerateInputParams {
  campaignId: string;
  userId: string;
  userName?: string;
  userRole?: UserRole;
  resourceType: ModerationResourceType;
  resourceId?: string;
  provider: string;
  model: string;
  operation?: string;
  textInputs: (string | undefined | null)[];
  userPrompt?: string;
  contextText?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Output moderation request payload
 */
export interface ModerateOutputParams {
  campaignId: string;
  userId: string;
  userName?: string;
  userRole?: UserRole;
  resourceType: ModerationResourceType;
  resourceId?: string;
  versionNumber?: number;
  provider: string;
  model: string;
  operation?: string;
  outputContent?: string;
  imageDimensions?: { width: number; height: number };
  metadata?: Record<string, unknown>;
}

/**
 * Human resolution payload
 */
export interface ResolveModerationPayload {
  decision: 'ALLOW' | 'BLOCK';
  notes: string;
}
