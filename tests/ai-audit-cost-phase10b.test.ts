/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'assert';
import { aiAuditStore } from '../server/aiAuditStore';
import { costEngine, DEFAULT_PRICING_CATALOG } from '../server/costEngine';
import { contentStore } from '../server/contentStore';
import { imageAssetStore } from '../server/imageAssetStore';
import { hasRolePermission } from '../src/types/auth';

console.log('================================================================');
console.log('CREATIVE AI MARKETING PLATFORM — PHASE 10B.1: AUDIT, COST & ROI VALIDATION');
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
  const testCampaignId = 'camp-val-phase10b-test';
  const testUserId = 'user-val-copywriter-1';

  // ----------------------------------------------------------------------
  // SUITE 1: AI AUDIT EVENT CREATION & TRACEABILITY
  // ----------------------------------------------------------------------
  console.log('Suite 1: AI Audit Event Creation & Traceability');

  let successEventId = '';
  let blockedEventId = '';
  let failedEventId = '';

  await runTest('Successful AI operation creates audit event with provider, model, user, campaign, and duration', () => {
    const event = aiAuditStore.recordEvent({
      campaign_id: testCampaignId,
      campaign_name: 'Campanha de Validação Phase 10B',
      user_id: testUserId,
      user_name: 'Validador Copywriter',
      user_role: 'Copywriter',
      content_id: 'content-val-001',
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      operation: 'generate',
      status: 'SUCCESS',
      moderation_status: 'LOW_RISK',
      started_at: new Date(Date.now() - 1250).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: 1250,
      input_tokens: 500,
      output_tokens: 250,
      total_tokens: 750,
      token_status: 'KNOWN',
    });

    assert(event.id && event.id.startsWith('aiaudit-'), 'Audit event ID should be generated');
    assert.strictEqual(event.provider, 'anthropic', 'Provider must be recorded as anthropic');
    assert.strictEqual(event.model, 'claude-3-5-sonnet-20241022', 'Model must be recorded');
    assert.strictEqual(event.user_id, testUserId, 'User ID must be recorded');
    assert.strictEqual(event.user_role, 'Copywriter', 'User role must be recorded');
    assert.strictEqual(event.campaign_id, testCampaignId, 'Campaign ID must be recorded');
    assert.strictEqual(event.operation, 'generate', 'Operation must be recorded');
    assert.strictEqual(event.status, 'SUCCESS', 'Status must be SUCCESS');
    assert.strictEqual(event.duration_ms, 1250, 'Duration must be recorded');
    assert.strictEqual(event.input_tokens, 500, 'Input tokens recorded');
    assert.strictEqual(event.output_tokens, 250, 'Output tokens recorded');
    assert.strictEqual(event.total_tokens, 750, 'Total tokens recorded');
    assert.strictEqual(event.token_status, 'KNOWN', 'Token status must be KNOWN');
    successEventId = event.id;
  });

  await runTest('Blocked AI operation creates audit event with BLOCKED status and reason', () => {
    const event = aiAuditStore.recordEvent({
      campaign_id: testCampaignId,
      campaign_name: 'Campanha de Validação Phase 10B',
      user_id: testUserId,
      user_name: 'Validador Copywriter',
      user_role: 'Copywriter',
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      operation: 'generate',
      status: 'BLOCKED',
      moderation_status: 'HIGH_RISK',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: 0,
      error_code: 'MODERATION_BLOCKED',
      error_message: 'Violação de política de segurança de conteúdo',
    });

    assert(event.id, 'Blocked event ID generated');
    assert.strictEqual(event.status, 'BLOCKED', 'Status must be BLOCKED, not FAILED');
    assert.strictEqual(event.moderation_status, 'HIGH_RISK', 'Moderation status recorded');
    assert.strictEqual(event.error_code, 'MODERATION_BLOCKED', 'Error code recorded');
    assert(event.error_message?.includes('segurança'), 'Error message recorded');
    blockedEventId = event.id;
  });

  await runTest('Failed AI operation creates audit event with FAILED status and error details', () => {
    const event = aiAuditStore.recordEvent({
      campaign_id: testCampaignId,
      campaign_name: 'Campanha de Validação Phase 10B',
      user_id: testUserId,
      user_name: 'Validador Copywriter',
      user_role: 'Copywriter',
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      operation: 'summarize',
      status: 'FAILED',
      started_at: new Date(Date.now() - 300).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: 300,
      error_code: 'PROVIDER_TIMEOUT',
      error_message: 'Anthropic API connection timed out',
    });

    assert(event.id, 'Failed event ID generated');
    assert.strictEqual(event.status, 'FAILED', 'Status must be FAILED');
    assert.strictEqual(event.error_code, 'PROVIDER_TIMEOUT', 'Error code recorded');
    assert.strictEqual(event.duration_ms, 300, 'Duration recorded for failed operation');
    failedEventId = event.id;
  });

  // ----------------------------------------------------------------------
  // SUITE 2: STATUS CATEGORIZATION & DISTINCTION
  // ----------------------------------------------------------------------
  console.log('\nSuite 2: Status Categorization & Distinction');

  await runTest('SUCCESS is semantically distinct from BLOCKED and FAILED', () => {
    const successEv = aiAuditStore.getEventById(successEventId);
    const blockedEv = aiAuditStore.getEventById(blockedEventId);
    const failedEv = aiAuditStore.getEventById(failedEventId);

    assert(successEv && blockedEv && failedEv, 'Events must exist in store');
    assert.notStrictEqual(successEv.status, blockedEv.status, 'SUCCESS !== BLOCKED');
    assert.notStrictEqual(successEv.status, failedEv.status, 'SUCCESS !== FAILED');
    assert.notStrictEqual(blockedEv.status, failedEv.status, 'BLOCKED !== FAILED');
  });

  await runTest('Operational metrics separate SUCCESS, BLOCKED, and FAILED counts correctly', () => {
    const metrics = aiAuditStore.getOperationalMetrics({ campaignId: testCampaignId });
    assert(metrics.successfulOperations >= 1, 'Should have at least 1 successful operation');
    assert(metrics.blockedOperations >= 1, 'Should have at least 1 blocked operation');
    assert(metrics.failedOperations >= 1, 'Should have at least 1 failed operation');
    // Blocked operations MUST NOT be counted as failed operations
    assert.strictEqual(
      metrics.totalOperations,
      metrics.successfulOperations + metrics.blockedOperations + metrics.failedOperations + metrics.unknownOperations,
      'Total operations must equal sum of distinct statuses'
    );
  });

  // ----------------------------------------------------------------------
  // SUITE 3: COST ENGINE & CALCULATION INTEGRITY
  // ----------------------------------------------------------------------
  console.log('\nSuite 3: Cost Engine & Calculation Integrity');

  await runTest('Known token usage produces expected cost according to pricing catalog', () => {
    // Claude 3.5 Sonnet: input $0.003 / 1000 tokens ($3.00/1M), output $0.015 / 1000 tokens ($15.00/1M)
    // 1000 input tokens = $0.003, 1000 output tokens = $0.015 -> Total = $0.018
    const result = costEngine.calculateCost({
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      operation: 'generate',
      usage: {
        inputTokens: 1000,
        outputTokens: 1000,
      },
    });

    assert.strictEqual(result.calculation_status, 'KNOWN', 'Status must be KNOWN');
    assert.strictEqual(result.estimated_cost, 0.018, '1000 in + 1000 out must equal exactly $0.018');
    assert.strictEqual(result.currency, 'USD', 'Currency must be USD');
  });

  await runTest('Unknown token usage remains COST_UNKNOWN and does NOT become zero', () => {
    const result = costEngine.calculateCost({
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      operation: 'generate',
      usage: {
        inputTokens: undefined,
        outputTokens: undefined,
      },
    });

    assert.strictEqual(result.calculation_status, 'COST_UNKNOWN', 'Status must be COST_UNKNOWN');
    assert.strictEqual(result.estimated_cost, null, 'Cost must be null, NOT 0');
    assert.notStrictEqual(result.estimated_cost, 0, 'Cost must NOT equal 0');
  });

  await runTest('Unknown provider pricing remains COST_UNKNOWN', () => {
    const result = costEngine.calculateCost({
      provider: 'unknown_future_ai',
      model: 'deep-future-model-99',
      operation: 'generate',
      usage: {
        inputTokens: 5000,
        outputTokens: 2500,
      },
    });

    assert.strictEqual(result.calculation_status, 'COST_UNKNOWN', 'Status must be COST_UNKNOWN');
    assert.strictEqual(result.estimated_cost, null, 'Unpriced provider must have null cost');
    assert(result.explanation && result.explanation.includes('não possui tabela de preços'), 'Explanation indicates missing pricing');
  });

  await runTest('Estimated token cost is explicitly marked ESTIMATED', () => {
    const result = costEngine.calculateCost({
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      operation: 'generate',
      usage: {
        inputTokens: 1000,
        outputTokens: 500,
        tokensEstimated: true,
      },
    });

    assert.strictEqual(result.calculation_status, 'ESTIMATED', 'Status must be explicitly ESTIMATED');
    assert(typeof result.estimated_cost === 'number', 'Cost value is computed');
    assert(result.estimated_cost! > 0, 'Cost is greater than 0');
  });

  await runTest('Blocked Claude operation does not receive fabricated cost', () => {
    // When an operation is blocked prior to or by Claude, no tokens were consumed
    const result = costEngine.calculateCost({
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      operation: 'generate',
      usage: {
        // Blocked operation has undefined/null tokens
        inputTokens: undefined,
        outputTokens: undefined,
      },
      metadata: {
        blocked: true,
      },
    });

    assert.strictEqual(result.calculation_status, 'COST_UNKNOWN', 'Cost status must be COST_UNKNOWN');
    assert.strictEqual(result.estimated_cost, null, 'Blocked operation cost must be null');
    assert.notStrictEqual(result.estimated_cost, 0, 'Must NOT be fabricated as 0.00 USD');
  });

  // ----------------------------------------------------------------------
  // SUITE 4: IMAGE GENERATION PRICING & FALLBACK/UNMETERED VERIFICATION
  // ----------------------------------------------------------------------
  console.log('\nSuite 4: Image Generation Pricing & Fallback/Unmetered Verification');

  await runTest('Stability generation cost is recorded only when justified with live key', () => {
    const result = costEngine.calculateCost({
      provider: 'stability_ai',
      model: 'stable-image-core',
      operation: 'image_generate',
      usage: {
        imagesCount: 1,
        isFallback: false,
        hasLiveCredential: true,
      },
    });

    assert.strictEqual(result.calculation_status, 'KNOWN', 'Live Stability generation must be KNOWN');
    assert.strictEqual(result.estimated_cost, 0.03, 'Stable Image Core cost is exactly $0.030');
    assert.strictEqual(result.currency, 'USD', 'Currency is USD');
  });

  await runTest('Fallback/unmetered generation does NOT become a fake paid Stability cost', () => {
    // Fallback SVG provider
    const resultFallback = costEngine.calculateCost({
      provider: 'fallback_provider',
      model: 'vector-svg-prototype-v1',
      operation: 'image_generate',
      usage: {
        imagesCount: 1,
        isFallback: true,
        hasLiveCredential: false,
      },
    });

    assert.strictEqual(resultFallback.calculation_status, 'COST_UNKNOWN', 'Fallback status must be COST_UNKNOWN');
    assert.strictEqual(resultFallback.estimated_cost, null, 'Fallback cost must be null');
    assert.notStrictEqual(resultFallback.estimated_cost, 0.03, 'Must NOT claim $0.030 paid cost for fallback');

    // Stability AI requested without live credential
    const resultUnconfigured = costEngine.calculateCost({
      provider: 'stability_ai',
      model: 'stable-image-core',
      operation: 'image_generate',
      usage: {
        imagesCount: 1,
        isFallback: true,
        hasLiveCredential: false,
      },
    });

    assert.strictEqual(resultUnconfigured.calculation_status, 'COST_UNKNOWN', 'Unconfigured Stability is COST_UNKNOWN');
    assert.strictEqual(resultUnconfigured.estimated_cost, null, 'Unconfigured Stability cost must be null');
  });

  // ----------------------------------------------------------------------
  // SUITE 5: ROI FRAMEWORK & NON-FABRICATION
  // ----------------------------------------------------------------------
  console.log('\nSuite 5: ROI Framework & Non-Fabrication');

  await runTest('Missing revenue/billing/conversion data produces ROI_DATA_NOT_AVAILABLE', () => {
    const roi = aiAuditStore.getROIMetrics();

    assert.strictEqual(roi.status, 'ROI_DATA_NOT_AVAILABLE', 'Status must be ROI_DATA_NOT_AVAILABLE');
    assert(roi.reason && roi.reason.length > 10, 'Must provide clear rationale for unavailability');
    assert(Array.isArray(roi.unavailableInputs), 'Must enumerate missing inputs');
    assert(roi.unavailableInputs.includes('campaign_revenue'), 'Identifies missing campaign_revenue');
    assert(roi.unavailableInputs.includes('client_billing_rate_hourly'), 'Identifies missing client billing rate');
    assert(roi.unavailableInputs.includes('traditional_agency_baseline_cost'), 'Identifies missing agency baseline');
    assert(roi.unavailableInputs.includes('actual_hours_saved_baseline'), 'Identifies missing hours saved baseline');
  });

  await runTest('No fabricated ROI percentage or fictitious monetary savings are displayed', () => {
    const roi = aiAuditStore.getROIMetrics();

    // Verify there are no fabricated numerical ROI properties like "roiPercentage: 450%" or "dollarsSaved: 12500"
    const roiKeys = Object.keys(roi);
    assert(!roiKeys.includes('roiPercentage'), 'Must NOT contain fake roiPercentage');
    assert(!roiKeys.includes('moneySavedUSD'), 'Must NOT contain fake moneySavedUSD');
    assert(!roiKeys.includes('estimatedROIPercent'), 'Must NOT contain fake estimatedROIPercent');
    assert(roi.disclaimer.includes('não fabrica projeções financeiras'), 'Disclaimer must explicitly state non-fabrication');
  });

  // ----------------------------------------------------------------------
  // SUITE 6: DATA INTEGRITY — UNKNOWN VALUES ARE NOT ZERO
  // ----------------------------------------------------------------------
  console.log('\nSuite 6: Data Integrity — UNKNOWN Values Are Distinct From Zero');

  await runTest('TOKEN_USAGE_UNKNOWN has null tokens, distinct from 0', () => {
    const ev = aiAuditStore.recordEvent({
      campaign_id: testCampaignId,
      user_id: testUserId,
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      operation: 'rewrite',
      status: 'BLOCKED',
      input_tokens: null,
      output_tokens: null,
      token_status: 'TOKEN_USAGE_UNKNOWN',
    });

    assert.strictEqual(ev.token_status, 'TOKEN_USAGE_UNKNOWN', 'token_status must be TOKEN_USAGE_UNKNOWN');
    assert.strictEqual(ev.input_tokens, null, 'input_tokens must be null');
    assert.strictEqual(ev.output_tokens, null, 'output_tokens must be null');
    assert.strictEqual(ev.total_tokens, null, 'total_tokens must be null');
    assert.notStrictEqual(ev.total_tokens, 0, 'total_tokens must NOT equal 0');
  });

  await runTest('COST_UNKNOWN has null estimated_cost, distinct from 0', () => {
    const ev = aiAuditStore.recordEvent({
      campaign_id: testCampaignId,
      user_id: testUserId,
      provider: 'fallback_provider',
      model: 'vector-svg-prototype-v1',
      operation: 'image_generate',
      status: 'SUCCESS',
      estimated_cost: null,
      cost_status: 'COST_UNKNOWN',
    });

    assert.strictEqual(ev.cost_status, 'COST_UNKNOWN', 'cost_status must be COST_UNKNOWN');
    assert.strictEqual(ev.estimated_cost, null, 'estimated_cost must be null');
    assert.notStrictEqual(ev.estimated_cost, 0, 'estimated_cost must NOT equal 0');
  });

  await runTest('ROI_DATA_NOT_AVAILABLE status is distinct from 0 or 0%', () => {
    const roi = aiAuditStore.getROIMetrics();
    assert.strictEqual(roi.status, 'ROI_DATA_NOT_AVAILABLE');
    assert.notStrictEqual(roi.status as any, 0, 'Status is not 0');
    assert.notStrictEqual(roi.status as any, '0%', 'Status is not 0%');
  });

  // ----------------------------------------------------------------------
  // SUITE 7: DASHBOARD METRICS & REAL DATA SOURCE VALIDATION
  // ----------------------------------------------------------------------
  console.log('\nSuite 7: Dashboard Metrics & Real Data Source Validation');

  await runTest('AI operation totals are based on persisted audit records', () => {
    const allEvents = aiAuditStore.listEvents();
    const operational = aiAuditStore.getOperationalMetrics();
    assert.strictEqual(operational.totalOperations, allEvents.length, 'Total operations equals persisted events count');
  });

  await runTest('Provider breakdowns use real audit data', () => {
    const operational = aiAuditStore.getOperationalMetrics();
    let sumProviderCounts = 0;
    for (const count of Object.values(operational.operationsByProvider)) {
      sumProviderCounts += count;
    }
    assert.strictEqual(sumProviderCounts, operational.totalOperations, 'Sum of provider counts matches total operations');
  });

  await runTest('Partial-cost warnings appear when unknown/unmetered operations exist', () => {
    const costSummary = aiAuditStore.getCostSummary();
    assert(costSummary.unknownCostOperationsCount > 0, 'There are unmetered or unknown cost operations in store');
    assert.strictEqual(costSummary.hasPartialCostWarning, true, 'hasPartialCostWarning must be true');
    assert(costSummary.partialCostNotice.includes('Custo Parcial'), 'Notice warns user of partial cost');
  });

  await runTest('Campaign metrics use real campaign content data', () => {
    const prodMetrics = aiAuditStore.getProductivityMetrics();
    assert(typeof prodMetrics.contentGenerated === 'number', 'contentGenerated is a real count');
    assert(typeof prodMetrics.contentVersionsCreated === 'number', 'contentVersionsCreated is a real count');
    assert(Array.isArray(prodMetrics.workflowDurations), 'workflowDurations is an array');
  });

  // ----------------------------------------------------------------------
  // SUITE 8: SECURITY & RBAC PERMISSION ENFORCEMENT
  // ----------------------------------------------------------------------
  console.log('\nSuite 8: Security & RBAC Permission Enforcement');

  await runTest('Non-administrator cannot access organization-wide monetary costs', () => {
    // Designer cannot view financial costs
    assert.strictEqual(hasRolePermission('Designer', 'costs.view'), false, 'Designer has NO costs.view permission');
    // Copywriter cannot view financial costs
    assert.strictEqual(hasRolePermission('Copywriter', 'costs.view'), false, 'Copywriter has NO costs.view permission');
    // Approver cannot view financial costs
    assert.strictEqual(hasRolePermission('Approver', 'costs.view'), false, 'Approver has NO costs.view permission');
    // Only Administrator has costs.view permission
    assert.strictEqual(hasRolePermission('Administrator', 'costs.view'), true, 'Administrator HAS costs.view permission');
  });

  await runTest('Non-administrator cannot access pricing catalog', () => {
    // Both /api/governance/costs-roi and /api/governance/pricing-config require 'costs.view'
    assert.strictEqual(hasRolePermission('Designer', 'costs.view'), false);
    assert.strictEqual(hasRolePermission('Copywriter', 'costs.view'), false);
    assert.strictEqual(hasRolePermission('Approver', 'costs.view'), false);
  });

  await runTest('Only users with audit.view (Administrator) can access centralized AI audit trail', () => {
    assert.strictEqual(hasRolePermission('Designer', 'audit.view'), false, 'Designer has NO audit.view');
    assert.strictEqual(hasRolePermission('Copywriter', 'audit.view'), false, 'Copywriter has NO audit.view');
    assert.strictEqual(hasRolePermission('Approver', 'audit.view'), false, 'Approver has NO audit.view');
    assert.strictEqual(hasRolePermission('Administrator', 'audit.view'), true, 'Administrator HAS audit.view');
  });

  // ----------------------------------------------------------------------
  // SUITE 9: IMMUTABILITY & AUDIT TRAIL INTEGRITY
  // ----------------------------------------------------------------------
  console.log('\nSuite 9: Immutability & Audit Trail Integrity');

  await runTest('Audit record objects are frozen (Object.isFrozen is true)', () => {
    const event = aiAuditStore.getEventById(successEventId);
    assert(event, 'Event must exist');
    assert(Object.isFrozen(event), 'Audit event must be frozen with Object.freeze');
  });

  await runTest('Attempting to mutate an audit event throws in strict mode', () => {
    const event = aiAuditStore.getEventById(successEventId) as any;
    assert(event, 'Event must exist');
    let threw = false;
    try {
      event.status = 'BLOCKED';
    } catch {
      threw = true;
    }
    assert(threw || event.status === 'SUCCESS', 'Mutating frozen event property must fail or be rejected');
    assert.strictEqual(event.status, 'SUCCESS', 'Status must remain immutable as SUCCESS');
  });

  await runTest('aiAuditStore has no update or delete methods in public API', () => {
    const storeMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(aiAuditStore));
    assert(!storeMethods.includes('updateEvent'), 'Store MUST NOT expose updateEvent');
    assert(!storeMethods.includes('deleteEvent'), 'Store MUST NOT expose deleteEvent');
    assert(!storeMethods.includes('modifyEvent'), 'Store MUST NOT expose modifyEvent');
    assert(!storeMethods.includes('clearEvents'), 'Store MUST NOT expose clearEvents');
  });

  // ----------------------------------------------------------------------
  // SUITE 10: CENTRALIZED PRICING CATALOG
  // ----------------------------------------------------------------------
  console.log('\nSuite 10: Centralized Pricing Catalog Verification');

  await runTest('Pricing catalog is centralized in costEngine, not scattered in business logic', () => {
    const catalog = costEngine.getPricingCatalog();
    assert(Array.isArray(catalog), 'Catalog is an array of PricingModelConfig');
    assert(catalog.length >= 3, 'Catalog has multiple model configurations');

    const claudeSonnet = catalog.find((p) => p.model === 'claude-3-5-sonnet-20241022');
    assert(claudeSonnet, 'Claude 3.5 Sonnet pricing present in catalog');
    assert.strictEqual(claudeSonnet.inputCostPer1kTokens, 0.003);
    assert.strictEqual(claudeSonnet.outputCostPer1kTokens, 0.015);
    assert.strictEqual(claudeSonnet.currency, 'USD');

    const stabilityCore = catalog.find((p) => p.model === 'stable-image-core');
    assert(stabilityCore, 'Stability AI pricing present in catalog');
    assert.strictEqual(stabilityCore.costPerUnit, 0.03);
    assert.strictEqual(stabilityCore.type, 'unit_based');

    // Verify metadata and periodic review requirements
    assert(claudeSonnet.notes, 'Model entry includes official source notes');
    assert(claudeSonnet.lastUpdated, 'Model entry includes lastUpdated date');
  });

  console.log('\n================================================================');
  console.log(`ALL SUITES PASSED: ${passCount} tests completed successfully.`);
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
