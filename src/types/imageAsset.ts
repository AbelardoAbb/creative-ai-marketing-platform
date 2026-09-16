/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserRole } from './auth';

export type ImageGenerationProvider = 'stability_ai' | 'fallback_provider';

export type ImageAssetStatus =
  | 'GENERATED'
  | 'MODERATION_REVIEW'
  | 'MODERATION_BLOCKED'
  | 'READY_FOR_REVIEW';

export type ModerationRisk = 'LOW_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK';

export interface ModerationResult {
  risk: ModerationRisk;
  flagged: boolean;
  reason?: string;
  matchedCategories?: string[];
  evaluatedTextSnippet?: string;
}

export type SupportedImageStyle =
  | 'Photorealistic'
  | 'Editorial'
  | 'Advertising'
  | 'Anime'
  | 'Oil Painting'
  | 'Cinematic'
  | 'Minimalist';

export type SupportedAspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:2';

/**
 * Aspect Ratio to Dimension mapping for Stability AI SD3.5 / Core
 */
export const ASPECT_RATIO_DIMENSIONS: Record<
  SupportedAspectRatio,
  { width: number; height: number }
> = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1344, height: 768 },
  '9:16': { width: 768, height: 1344 },
  '4:3': { width: 1152, height: 864 },
  '3:2': { width: 1216, height: 832 },
};

export interface CleanCampaignImageContext {
  campaignId: string;
  client: string;
  productOrService?: string;
  objective?: string;
  targetAudience?: string;
  keyMessage?: string;
  toneOfVoice?: string;
  visualDirection?: string;
  creativeConstraints?: string;
  imageStyle?: SupportedImageStyle;
  aspectRatio?: SupportedAspectRatio;
  additionalInstructions?: string;
}

export interface ImageGenerationRequestPayload {
  campaignId: string;
  userPrompt: string;
  negativePrompt?: string;
  style?: SupportedImageStyle;
  aspectRatio?: SupportedAspectRatio;
  additionalInstructions?: string;
  parentAssetId?: string; // If regenerating from previous asset
}

export interface ImageAssetModel {
  id: string;
  campaign_id: string;
  created_by: string;
  provider: ImageGenerationProvider;
  model: string;
  prompt: string;
  negative_prompt?: string;
  style: SupportedImageStyle;
  aspect_ratio: SupportedAspectRatio;
  status: ImageAssetStatus;
  moderation_status: ModerationRisk;
  moderation_notes?: string;
  storage_path: string;
  public_url?: string;
  dimensions: { width: number; height: number };
  rating?: number; // 1-5 stars
  feedback?: string;
  generation_duration_ms?: number;
  estimated_cost: string; // e.g. "0.035 USD" or "COST_UNKNOWN"
  parent_asset_id?: string;
  created_at: string;
  updated_at: string;
  creator_display_name?: string;
  creator_role?: UserRole;
}

export interface HumanEvaluationPayload {
  rating: number; // 1-5
  feedback?: string;
}

export interface GenerationEventLog {
  id: string;
  asset_id?: string;
  campaign_id: string;
  user_id: string;
  provider: ImageGenerationProvider;
  model: string;
  generation_status: 'SUCCESS' | 'ERROR' | 'BLOCKED';
  moderation_status: ModerationRisk;
  generation_duration_ms?: number;
  estimated_cost: string;
  error_message?: string;
  timestamp: string;
}
