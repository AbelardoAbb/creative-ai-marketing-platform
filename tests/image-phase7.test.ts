/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'assert';
import {
  evaluateInputModeration,
} from '../server/moderation';
import {
  extractCleanCampaignImageContext,
  constructGenerationPrompt,
} from '../server/promptBuilder';
import {
  StabilityAIProvider,
  FallbackImageProvider,
  ImageGenerationService,
} from '../server/imageProvider';
import { imageAssetStore } from '../server/imageAssetStore';
import { CampaignModel } from '../src/types/campaign';
import { ImageAssetModel } from '../src/types/imageAsset';

console.log('================================================================');
console.log('CREATIVE AI MARKETING PLATFORM — PHASE 7: STABILITY AI & IMAGE TESTS');
console.log('================================================================\n');

let passCount = 0;
function test(name: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      res
        .then(() => {
          console.log(`  ✓ PASS: ${name}`);
          passCount++;
        })
        .catch((err) => {
          console.error(`  ✗ FAIL: ${name}`);
          console.error('   ', err instanceof Error ? err.message : err);
          process.exit(1);
        });
    } else {
      console.log(`  ✓ PASS: ${name}`);
      passCount++;
    }
  } catch (err: unknown) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error('   ', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

// Mock Campaign for testing contextualization
const mockCampaign: CampaignModel = {
  id: 'camp-test-phase7',
  name: 'Campanha Primavera Bio-Tech',
  client: 'Lumina Lab',
  description: 'Linha avançada de biotecnologia botânica',
  product_or_service: 'Anti-Aging Serum C-50',
  campaign_objective: 'Apresentar inovação em cosmecêuticos botânicos',
  target_audience: 'Mulheres e homens 30-55 anos',
  key_message: 'Juventude sustentável e alta eficácia dermatológica',
  tone_of_voice: 'Sofisticado, acolhedor e clínico',
  language: 'pt-BR',
  channels: ['Instagram', 'LinkedIn'],
  visual_direction: 'Luz natural matinal, gotas d água translúcidas, tons verdes e âmbar',
  creative_constraints: 'Sem estética artificial ou elementos plásticos',
  status: 'active',
  created_by: 'user-designer-1',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// -------------------------------------------------------------
// Suite 1: Input Moderation Layer (Deterministic Safety Filter)
// -------------------------------------------------------------
console.log('Suite 1: Input Moderation Layer (Deterministic Safety Filter)');

test('Allows safe creative advertising prompts (LOW_RISK)', () => {
  const result = evaluateInputModeration(
    'Mulher serena segurando frasco de sérum com folhas de eucalipto',
    'Luz de estúdio suave'
  );
  assert.strictEqual(result.risk, 'LOW_RISK');
  assert.strictEqual(result.flagged, false);
  assert.strictEqual(result.reason, undefined);
});

test('Blocks critical safety violations (HIGH_RISK)', () => {
  const result = evaluateInputModeration(
    'Cena de mutilat e bloodbath com armas terroristas',
    'Composição explícita'
  );
  assert.strictEqual(result.risk, 'HIGH_RISK');
  assert.strictEqual(result.flagged, true);
  assert(result.reason && result.reason.includes('Conteúdo bloqueado'));
  assert(result.matchedCategories && result.matchedCategories.includes('violence_gore'));
});

test('Flags sensitive terms for moderation review (MEDIUM_RISK)', () => {
  const result = evaluateInputModeration(
    'Imagem com dados confidenciais incluindo cpf e social security number vazado'
  );
  assert.strictEqual(result.risk, 'MEDIUM_RISK');
  assert.strictEqual(result.flagged, true);
  assert(result.matchedCategories && result.matchedCategories.includes('pii_and_credentials'));
});

// -------------------------------------------------------------
// Suite 2: Contextual Prompt Synthesizer
// -------------------------------------------------------------
console.log('\nSuite 2: Contextual Prompt Synthesizer & Guidance Construction');

test('Extracts sanitized campaign image context without secrets', () => {
  const context = extractCleanCampaignImageContext(
    mockCampaign,
    'Photorealistic',
    '1:1',
    'Foco no brilho da textura do vidro'
  );
  assert.strictEqual(context.campaignId, mockCampaign.id);
  assert.strictEqual(context.client, 'Lumina Lab');
  assert.strictEqual(context.productOrService, 'Anti-Aging Serum C-50');
  assert.strictEqual(context.imageStyle, 'Photorealistic');
  assert.strictEqual(context.aspectRatio, '1:1');
  assert.strictEqual(context.additionalInstructions, 'Foco no brilho da textura do vidro');
});

test('Synthesizes final prompt fusing user prompt, style, and campaign briefing', () => {
  const context = extractCleanCampaignImageContext(
    mockCampaign,
    'Photorealistic',
    '16:9'
  );
  const synthesized = constructGenerationPrompt(
    context,
    'Close no aplicador conta-gotas dourado sobre fundo botânico'
  );

  assert(synthesized.prompt.includes('Close no aplicador conta-gotas dourado'));
  assert(synthesized.prompt.includes('35mm lens')); // Photorealistic style enhancer
  assert(synthesized.prompt.includes('Anti-Aging Serum C-50')); // Campaign product
  assert(synthesized.prompt.includes('Luz natural matinal')); // Campaign visual direction
  assert(synthesized.negativePrompt.includes('Sem estética artificial')); // Campaign creative constraints
});

// -------------------------------------------------------------
// Suite 3: Image Generation Service & Fallback Provider Audit
// -------------------------------------------------------------
console.log('\nSuite 3: Image Generation Service & Provider Transparency');

test('FallbackImageProvider produces clean vector prototype and declares its identity', async () => {
  const fallback = new FallbackImageProvider();
  assert.strictEqual(fallback.name, 'fallback_provider');

  const res = await fallback.generate({
    prompt: 'Conceito visual para cosmético orgânico',
    aspectRatio: '1:1',
    style: 'Advertising',
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.provider, 'fallback_provider');
  assert(res.imageBuffer && res.imageBuffer.length > 0);
  assert.strictEqual(res.dimensions.width, 1024);
  assert.strictEqual(res.dimensions.height, 1024);
  assert.strictEqual(res.estimatedCost, '0.000 USD (Fallback)');
});

test('ImageGenerationService rejects false simulation when fallback is disabled', async () => {
  const service = new ImageGenerationService();
  if (!service.isStabilityConfigured()) {
    const res = await service.generateImage(
      {
        prompt: 'Mulher com sérum botânico',
        aspectRatio: '1:1',
        style: 'Advertising',
      },
      false // allowFallback = false
    );

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.isBlocked, true);
    assert(res.error && res.error.includes('BLOCKED'));
  }
});

// -------------------------------------------------------------
// Suite 4: Image Asset Store & Human Evaluation
// -------------------------------------------------------------
console.log('\nSuite 4: Image Asset Persistence & Human Evaluation');

test('Saves generated asset with technical metadata and retrieval', () => {
  const newAsset: ImageAssetModel = {
    id: 'asset-test-unit-001',
    campaign_id: mockCampaign.id,
    created_by: 'user-designer-1',
    provider: 'stability_ai',
    model: 'stable-image-core',
    prompt: 'Conceito de frasco âmbar com folhagens',
    style: 'Photorealistic',
    aspect_ratio: '1:1',
    status: 'READY_FOR_REVIEW',
    moderation_status: 'LOW_RISK',
    storage_path: 'campaigns/camp-test-phase7/asset-test-unit-001.png',
    dimensions: { width: 1024, height: 1024 },
    estimated_cost: '0.030 USD',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  imageAssetStore.saveAsset(newAsset);
  const retrieved = imageAssetStore.getAsset('asset-test-unit-001');
  assert.strictEqual(retrieved?.id, 'asset-test-unit-001');
  assert.strictEqual(retrieved?.campaign_id, mockCampaign.id);
  assert.strictEqual(retrieved?.status, 'READY_FOR_REVIEW');
});

test('Applies human evaluation rating (1-5 stars) and feedback note', () => {
  const evaluated = imageAssetStore.evaluateAsset('asset-test-unit-001', {
    rating: 5,
    feedback: 'Estética visual e fidelidade botânica excepcionais!',
  });

  assert.strictEqual(evaluated?.rating, 5);
  assert.strictEqual(evaluated?.feedback, 'Estética visual e fidelidade botânica excepcionais!');
  assert.strictEqual(evaluated?.status, 'READY_FOR_REVIEW');
});

console.log('\n================================================================');
console.log(`ALL PHASE 7 TESTS EXECUTED.`);
console.log('================================================================\n');
