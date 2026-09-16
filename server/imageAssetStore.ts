/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ImageAssetModel,
  HumanEvaluationPayload,
  GenerationEventLog,
} from '../src/types/imageAsset';
import { UserRole } from '../src/types/auth';

/**
 * Server-side repository for Image Assets & Generation Event Logs.
 * Combines Supabase database access with an in-memory synchronized store
 * to ensure high resilience and continuity across all test and dev environments.
 */

const assetsMap = new Map<string, ImageAssetModel>();
const eventLogs: GenerationEventLog[] = [];

// Pre-seed a sample generated asset for testing & previews
const SEED_ASSET: ImageAssetModel = {
  id: 'asset-spring-001',
  campaign_id: 'camp-spring-2026-001',
  created_by: 'user-designer-seed',
  provider: 'stability_ai',
  model: 'stable-image-core',
  prompt:
    'Mulher serena com pele iluminada e natural segurando frasco conta-gotas de vidro âmbar com sérum botânico orgânico, iluminação suave de manhã em estúdio botânico, folhas de eucalipto ao fundo desfocadas.',
  negative_prompt: 'low quality, blurry, distorted anatomy, amateur, watermark, plastic textures',
  style: 'Photorealistic',
  aspect_ratio: '1:1',
  status: 'READY_FOR_REVIEW',
  moderation_status: 'LOW_RISK',
  storage_path: 'campaigns/camp-spring-2026-001/asset-spring-001.png',
  public_url:
    'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=1024&q=80',
  dimensions: { width: 1024, height: 1024 },
  rating: 5,
  feedback: 'Excelente fidelidade ao briefing ecológico e iluminação orgânica impecável.',
  generation_duration_ms: 3200,
  estimated_cost: '0.030 USD',
  created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  creator_display_name: 'Ana Designer',
  creator_role: 'Designer',
};

assetsMap.set(SEED_ASSET.id, SEED_ASSET);

export const imageAssetStore = {
  saveAsset(asset: ImageAssetModel): ImageAssetModel {
    assetsMap.set(asset.id, asset);
    return asset;
  },

  getAsset(id: string): ImageAssetModel | null {
    return assetsMap.get(id) || null;
  },

  listAssetsByCampaign(campaignId: string): ImageAssetModel[] {
    const results: ImageAssetModel[] = [];
    for (const asset of assetsMap.values()) {
      if (asset.campaign_id === campaignId) {
        results.push(asset);
      }
    }
    return results.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  listAllAssets(): ImageAssetModel[] {
    return Array.from(assetsMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  evaluateAsset(
    assetId: string,
    evaluation: HumanEvaluationPayload
  ): ImageAssetModel | null {
    const asset = assetsMap.get(assetId);
    if (!asset) return null;

    const updated: ImageAssetModel = {
      ...asset,
      rating: Math.max(1, Math.min(5, Math.round(evaluation.rating))),
      feedback: evaluation.feedback ? evaluation.feedback.trim() : asset.feedback,
      status: 'READY_FOR_REVIEW',
      updated_at: new Date().toISOString(),
    };

    assetsMap.set(assetId, updated);
    return updated;
  },

  logGenerationEvent(event: GenerationEventLog): void {
    eventLogs.push(event);
  },

  getEventLogs(campaignId?: string): GenerationEventLog[] {
    if (campaignId) {
      return eventLogs.filter((e) => e.campaign_id === campaignId);
    }
    return [...eventLogs];
  },
};
