/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserRole } from './auth';

export type CampaignStatus = 'draft' | 'active' | 'in_review' | 'completed' | 'archived';

/**
 * Valid Status Transitions Matrix
 * Enforces business lifecycle rules server-side.
 */
export const VALID_STATUS_TRANSITIONS: Record<CampaignStatus, readonly CampaignStatus[]> = {
  draft: ['active', 'archived'],
  active: ['in_review', 'completed', 'archived'],
  in_review: ['active', 'completed', 'archived'],
  completed: ['archived', 'active'],
  archived: ['draft', 'active'], // Reactivation
} as const;

export function isValidStatusTransition(from: CampaignStatus, to: CampaignStatus): boolean {
  if (from === to) return true;
  const allowed = VALID_STATUS_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Campaign Information Model (Phase 6)
 */
export interface CampaignModel {
  id: string;
  name: string;
  client: string;
  description: string | null;
  product_or_service: string | null;
  campaign_objective: string | null;
  target_audience: string | null;
  key_message: string | null;
  tone_of_voice: string | null;
  language: string;
  channels: string[];
  visual_direction: string | null;
  creative_constraints: string | null;
  status: CampaignStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Campaign Member with user identity details
 */
export interface CampaignMemberModel {
  id: string;
  campaign_id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
  user_email?: string;
  user_display_name?: string;
}

/**
 * Clean Structured AI Context Contract
 * Prepared for future consumption by Claude and ImageGenerationService (Phase 7+).
 */
export interface CampaignAIContextContract {
  campaignId: string;
  name: string;
  client: string;
  productOrService: string;
  objective: string;
  targetAudience: string;
  keyMessage: string;
  toneOfVoice: string;
  language: string;
  channels: string[];
  visualDirection: string;
  creativeConstraints: string;
  status: CampaignStatus;
}

/**
 * Converts a CampaignModel into the structured AI Context Contract.
 */
export function buildCampaignAIContextContract(campaign: CampaignModel): CampaignAIContextContract {
  return {
    campaignId: campaign.id,
    name: campaign.name,
    client: campaign.client || 'Geral',
    productOrService: campaign.product_or_service || '',
    objective: campaign.campaign_objective || '',
    targetAudience: campaign.target_audience || '',
    keyMessage: campaign.key_message || '',
    toneOfVoice: campaign.tone_of_voice || 'Profissional e Persuasivo',
    language: campaign.language || 'pt-BR',
    channels: Array.isArray(campaign.channels) ? campaign.channels : [],
    visualDirection: campaign.visual_direction || '',
    creativeConstraints: campaign.creative_constraints || '',
    status: campaign.status,
  };
}

/**
 * Campaign Creation Payload
 */
export interface CreateCampaignPayload {
  name: string;
  client: string;
  description?: string;
  product_or_service?: string;
  campaign_objective: string;
  target_audience?: string;
  key_message?: string;
  tone_of_voice?: string;
  language?: string;
  channels?: string[];
  visual_direction?: string;
  creative_constraints?: string;
}

/**
 * Campaign Update Payload
 */
export interface UpdateCampaignPayload {
  name?: string;
  client?: string;
  description?: string;
  product_or_service?: string;
  campaign_objective?: string;
  target_audience?: string;
  key_message?: string;
  tone_of_voice?: string;
  language?: string;
  channels?: string[];
  visual_direction?: string;
  creative_constraints?: string;
  status?: CampaignStatus;
}
