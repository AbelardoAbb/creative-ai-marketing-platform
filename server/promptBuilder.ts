/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CleanCampaignImageContext,
  SupportedImageStyle,
  SupportedAspectRatio,
} from '../src/types/imageAsset';
import { CampaignModel } from '../src/types/campaign';

/**
 * Maps high-level creative styles to prompt guidance descriptors.
 * In Stability AI SD3.5 / Core, passing stylistic enhancers within the prompt
 * yields superior artistic coherence across photographic and illustrative modes.
 */
const STYLE_DESCRIPTORS: Record<SupportedImageStyle, string> = {
  Photorealistic:
    'professional studio photography, shot on 35mm lens, f/1.8, authentic lighting, hyper-realistic, 8k resolution, crisp details',
  Editorial:
    'high-fashion editorial look, magazine cover composition, refined lighting, vogue aesthetic, elegant art direction',
  Advertising:
    'commercial advertising campaign visual, billboard quality, clean brand aesthetic, premium product lighting, polished and vibrant',
  Anime:
    'contemporary anime visual, vibrant colors, clean cel-shaded linework, dynamic digital illustration, Makoto Shinkai aesthetic',
  'Oil Painting':
    'classical oil on canvas painting, expressive brushwork, rich impasto textures, chiaroscuro lighting, gallery masterpiece',
  Cinematic:
    'anamorphic cinematic still, dramatic film lighting, shallow depth of field, atmospheric, panavision color grading',
  Minimalist:
    'minimalist visual design, generous negative space, sophisticated muted color palette, clean geometric lines, understated luxury',
};

/**
 * Extracts a clean, sanitized image generation context from the campaign model.
 */
export function extractCleanCampaignImageContext(
  campaign: CampaignModel,
  style?: SupportedImageStyle,
  aspectRatio?: SupportedAspectRatio,
  additionalInstructions?: string
): CleanCampaignImageContext {
  return {
    campaignId: campaign.id,
    client: campaign.client || 'Geral',
    productOrService: campaign.product_or_service || undefined,
    objective: campaign.campaign_objective || undefined,
    targetAudience: campaign.target_audience || undefined,
    keyMessage: campaign.key_message || undefined,
    toneOfVoice: campaign.tone_of_voice || undefined,
    visualDirection: campaign.visual_direction || undefined,
    creativeConstraints: campaign.creative_constraints || undefined,
    imageStyle: style || 'Advertising',
    aspectRatio: aspectRatio || '1:1',
    additionalInstructions: additionalInstructions?.trim() || undefined,
  };
}

/**
 * Constructs the final server-side prompt combining campaign context and user prompt.
 * Keeps secrets out of prompts and provides coherent creative guidance.
 */
export function constructGenerationPrompt(
  context: CleanCampaignImageContext,
  userPrompt: string
): { prompt: string; negativePrompt: string } {
  const parts: string[] = [];

  // 1. Primary subject from user
  parts.push(userPrompt.trim());

  // 2. Style descriptor
  const styleKey = context.imageStyle || 'Advertising';
  const styleGuide = STYLE_DESCRIPTORS[styleKey];
  if (styleGuide) {
    parts.push(styleGuide);
  }

  // 3. Campaign contextual elements (product/service, visual direction)
  if (context.productOrService) {
    parts.push(`Focusing on the product/service: "${context.productOrService}"`);
  }

  if (context.visualDirection) {
    parts.push(`Art Direction: ${context.visualDirection}`);
  }

  if (context.toneOfVoice) {
    parts.push(`Mood and atmosphere: ${context.toneOfVoice}`);
  }

  if (context.additionalInstructions) {
    parts.push(`Creative guidelines: ${context.additionalInstructions}`);
  }

  const finalPrompt = parts.filter(Boolean).join('. ');

  // 4. Build negative prompt: merge default quality exclusions with campaign creative constraints
  const negativeParts: string[] = [
    'low quality',
    'blurry',
    'distorted anatomy',
    'amateur',
    'bad composition',
    'watermark',
    'deformed',
    'jpeg artifacts',
  ];

  if (context.creativeConstraints) {
    negativeParts.push(context.creativeConstraints);
  }

  const finalNegativePrompt = negativeParts.join(', ');

  return {
    prompt: finalPrompt,
    negativePrompt: finalNegativePrompt,
  };
}
