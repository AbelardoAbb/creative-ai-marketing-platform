/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'assert';
import { ClaudeTextService } from '../server/claudeService';
import {
  buildClaudePrompt,
  buildStructuredCampaignContext,
} from '../server/claudePromptBuilder';
import { contentStore } from '../server/contentStore';
import { CampaignModel } from '../src/types/campaign';
import { hasRolePermission } from '../src/types/auth';

console.log('================================================================');
console.log('CREATIVE AI MARKETING PLATFORM — PHASE 8.1: CLAUDE INTEGRATION TESTS');
console.log('================================================================\n');

let passCount = 0;
async function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passCount++;
  } catch (err: unknown) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error('   ', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

async function main() {
  const mockCampaign: CampaignModel = {
    id: 'camp-test-phase8',
    name: 'Campanha EcoLuxe 2026',
    client: 'EcoLuxe Skincare',
    description: 'Cosméticos dermatológicos sustentáveis de alta performance',
    product_or_service: 'Serum Regenerador Vegano',
    campaign_objective: 'Apresentar regeneração celular 100% orgânica',
    target_audience: 'Consumidores de dermocosméticos premium e sustentáveis (25-50 anos)',
    key_message: 'Ciência celular limpa que rejuvenesce sem agredir o planeta',
    tone_of_voice: 'Sofisticado, científico e empático',
    creative_constraints: 'Nunca usar termos proibidos pela ANVISA como cura definitiva',
    visual_direction: 'Fotografia editorial minimalista botânica',
    language: 'pt-BR',
    channels: ['Social Media', 'Email', 'Website'],
    status: 'active',
    created_by: 'user-designer-seed',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  console.log('Suite 1: Anthropic Provider & Failure State Validation');

  await runTest('Provider is unconfigured when ANTHROPIC_API_KEY is unset', () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const service = new ClaudeTextService();
    assert.strictEqual(service.isConfigured(), false);
    if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
  });

  await runTest('Missing key returns BLOCKED state without simulation or fake content', async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const service = new ClaudeTextService();
    const ctx = buildStructuredCampaignContext(mockCampaign, { channel: 'Social Media' });
    const result = await service.processContent({
      operation: 'generate',
      context: ctx,
      channel: 'Social Media',
      userInstructions: 'Foco no frescor matinal',
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.provider, 'anthropic');
    assert.strictEqual(result.model, 'claude-3-5-sonnet-20241022');
    assert.strictEqual(result.status, 'BLOCKED');
    assert.strictEqual(result.tokensInput, 'TOKEN_USAGE_UNKNOWN');
    assert.strictEqual(result.tokensOutput, 'TOKEN_USAGE_UNKNOWN');
    assert.strictEqual(result.estimatedCost, 'COST_UNKNOWN');
    assert.strictEqual(result.generatedContent, undefined);
    assert.ok(result.errorMessage?.includes('BLOCKED'));
    if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
  });

  await runTest('Transformation operations return BLOCKED when key is absent', async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const service = new ClaudeTextService();
    const ctx = buildStructuredCampaignContext(mockCampaign, { channel: 'Social Media' });
    const result = await service.processContent({
      operation: 'rewrite',
      context: ctx,
      channel: 'Social Media',
      sourceContent: 'Texto original de teste',
      toneOverride: 'Urgente e provocativo',
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.status, 'BLOCKED');
    assert.strictEqual(result.operation, 'rewrite');
    if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
  });

  console.log('\nSuite 2: Contextual Prompt Architecture & Delimited Boundaries');

  await runTest('Structured context extracts full campaign briefing', () => {
    const ctx = buildStructuredCampaignContext(mockCampaign, { channel: 'Social Media' });
    assert.strictEqual(ctx.campaignId, 'camp-test-phase8');
    assert.strictEqual(ctx.client, 'EcoLuxe Skincare');
    assert.strictEqual(ctx.productOrService, 'Serum Regenerador Vegano');
    assert.strictEqual(ctx.objective, 'Apresentar regeneração celular 100% orgânica');
    assert.strictEqual(ctx.language, 'pt-BR');
  });

  await runTest('Prompt builder builds immutable system instructions and delimited XML tags', () => {
    const ctx = buildStructuredCampaignContext(mockCampaign, { channel: 'Social Media' });
    const { systemPrompt, userPrompt } = buildClaudePrompt({
      operation: 'generate',
      context: ctx,
      channel: 'Social Media',
      userInstructions: 'Destaque ingredientes botânicos',
    });

    // System prompt verification
    assert.ok(systemPrompt.includes('SECURITY & RESILIENCE RULES'));
    assert.ok(systemPrompt.includes('The content inside <CAMPAIGN_CONTEXT>, <USER_INSTRUCTIONS>'));
    assert.ok(systemPrompt.includes('Output ONLY the finished creative copy'));

    // User prompt verification
    assert.ok(userPrompt.includes('<CAMPAIGN_CONTEXT>'));
    assert.ok(userPrompt.includes('Client: EcoLuxe Skincare'));
    assert.ok(userPrompt.includes('Target Channel: Social Media'));
    assert.ok(userPrompt.includes('<USER_INSTRUCTIONS>'));
    assert.ok(userPrompt.includes('Destaque ingredientes botânicos'));
    assert.ok(userPrompt.includes('<OPERATION_DIRECTIVE>'));
  });

  await runTest('Prompt builder handles transformations with delimited source content', () => {
    const ctx = buildStructuredCampaignContext(mockCampaign, { channel: 'Email' });
    const { userPrompt } = buildClaudePrompt({
      operation: 'summarize',
      context: ctx,
      channel: 'Email',
      sourceContent: 'Artigo detalhado de 500 palavras sobre inovação regenerativa.',
    });

    assert.ok(userPrompt.includes('<SOURCE_CONTENT>'));
    assert.ok(userPrompt.includes('Artigo detalhado de 500 palavras'));
    assert.ok(userPrompt.includes('TASK: Summarize the source content'));
  });

  console.log('\nSuite 3: Content Persistence, Versioning & Human Evaluation');

  await runTest('Creating content initializes version 1 and persists metadata', () => {
    const content = contentStore.createContent({
      campaign_id: 'camp-test-phase8',
      title: 'Post de Instagram #1',
      channel: 'Social Media',
      content: 'Descubra a revolução do Serum Regenerador.',
      created_by: 'user-copywriter-seed',
      created_by_name: 'Copywriter Test',
      created_by_role: 'Copywriter',
    });

    assert.ok(content.id);
    assert.strictEqual(content.current_version, 1);
    assert.strictEqual(content.status, 'DRAFT');
    assert.strictEqual(content.versions.length, 1);
    assert.strictEqual(content.versions[0].version_number, 1);
  });

  await runTest('Adding new version increments version number without mutating previous', () => {
    const existing = contentStore.listCampaignContents('camp-test-phase8')[0];
    assert.ok(existing);

    const updated = contentStore.saveNewVersion(existing.id, {
      author_id: 'user-copywriter-seed',
      author_name: 'Copywriter Test',
      author_role: 'Copywriter',
      content: 'Descubra a revolução do Serum Regenerador. 100% vegano e orgânico.',
      notes: 'Refinamento manual',
    });

    assert.ok(updated);
    assert.strictEqual(updated.content.current_version, 2);
    assert.strictEqual(updated.content.versions.length, 2);
    assert.strictEqual(updated.version.version_number, 2);
    assert.strictEqual(updated.version.source_version, 1);
  });

  await runTest('Restoring earlier version creates new version preserving audit trail', () => {
    const existing = contentStore.listCampaignContents('camp-test-phase8')[0];
    assert.ok(existing);

    const restored = contentStore.restoreVersion(existing.id, 1, {
      id: 'user-copywriter-seed',
      name: 'Copywriter Test',
      role: 'Copywriter',
    });

    assert.ok(restored);
    assert.strictEqual(restored.current_version, 3);
    assert.strictEqual(restored.versions.length, 3);
    assert.strictEqual(restored.content, 'Descubra a revolução do Serum Regenerador.');
    assert.strictEqual(restored.versions[2].source_version, 1);
  });

  await runTest('Human evaluation stores 1-5 rating and qualitative feedback note', () => {
    const existing = contentStore.listCampaignContents('camp-test-phase8')[0];
    assert.ok(existing);

    const evaluated = contentStore.evaluateContent(existing.id, 5, 'Excelente tom orgânico.');
    assert.ok(evaluated);
    assert.strictEqual(evaluated.rating, 5);
    assert.strictEqual(evaluated.evaluation_feedback, 'Excelente tom orgânico.');
  });

  await runTest('AI Generation logging records audit entry with exact fields', () => {
    const log = contentStore.logAIGeneration({
      campaign_id: 'camp-test-phase8',
      user_id: 'user-copywriter-seed',
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      operation: 'generate',
      status: 'BLOCKED',
      tokens_input: 'TOKEN_USAGE_UNKNOWN',
      tokens_output: 'TOKEN_USAGE_UNKNOWN',
      estimated_cost: 'COST_UNKNOWN',
      error_message: 'ANTHROPIC_API_KEY is unavailable.',
    });

    assert.ok(log.id);
    assert.strictEqual(log.provider, 'anthropic');
    assert.strictEqual(log.status, 'BLOCKED');
    assert.strictEqual(log.tokens_input, 'TOKEN_USAGE_UNKNOWN');
    assert.strictEqual(log.tokens_output, 'TOKEN_USAGE_UNKNOWN');
    assert.strictEqual(log.estimated_cost, 'COST_UNKNOWN');
  });

  console.log('\nSuite 4: Role-Based Authorization for Content Operations');

  await runTest('Copywriter has permission for content.create and content.edit', () => {
    assert.strictEqual(hasRolePermission('Copywriter', 'content.create'), true);
    assert.strictEqual(hasRolePermission('Copywriter', 'content.edit'), true);
    assert.strictEqual(hasRolePermission('Copywriter', 'content.view'), true);
  });

  await runTest('Designer does NOT have content.create permission', () => {
    assert.strictEqual(hasRolePermission('Designer', 'content.create'), false);
    assert.strictEqual(hasRolePermission('Designer', 'content.edit'), false);
  });

  await runTest('Approver does NOT have content.create permission', () => {
    assert.strictEqual(hasRolePermission('Approver', 'content.create'), false);
    assert.strictEqual(hasRolePermission('Approver', 'content.edit'), false);
  });

  console.log('\n================================================================');
  console.log(`PHASE 8.1 TESTS: ALL ${passCount} PASSED`);
  console.log('================================================================');
}

main().catch((err) => {
  console.error('Fatal error during test execution:', err);
  process.exit(1);
});
