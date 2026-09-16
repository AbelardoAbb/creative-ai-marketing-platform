/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CampaignModel } from '../src/types/campaign';
import {
  StructuredCampaignTextContext,
  ContentOperation,
  ContentChannel,
} from '../src/types/content';

/**
 * Extracts relevant structured campaign context for Claude text generation.
 * Only sends information relevant to the requested operation without leaking raw database internals.
 */
export function buildStructuredCampaignContext(
  campaign: CampaignModel,
  operation: ContentOperation,
  requestedChannel?: ContentChannel
): StructuredCampaignTextContext {
  // If a specific channel is requested, ensure it is highlighted; otherwise use campaign channels
  const channels = requestedChannel
    ? [requestedChannel]
    : campaign.channels && campaign.channels.length > 0
    ? campaign.channels
    : undefined;

  return {
    campaignId: campaign.id,
    client: campaign.client || 'Geral',
    productOrService: campaign.product_or_service || undefined,
    objective: campaign.campaign_objective || undefined,
    targetAudience: campaign.target_audience || undefined,
    keyMessage: campaign.key_message || undefined,
    toneOfVoice: campaign.tone_of_voice || undefined,
    language: campaign.language || 'pt-BR',
    channels,
    creativeConstraints: campaign.creative_constraints || undefined,
  };
}
