/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'assert';
import {
  isValidStatusTransition,
  VALID_STATUS_TRANSITIONS,
  buildCampaignAIContextContract,
  CampaignModel,
  CreateCampaignPayload,
} from '../src/types/campaign';
import { memoryCampaignStore } from '../server/campaignStore';
import { hasRolePermission } from '../src/types/auth';

console.log('================================================================');
console.log('CREATIVE AI MARKETING PLATFORM — PHASE 6: CAMPAIGN WORKSPACE TESTS');
console.log('================================================================\n');

let passCount = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passCount++;
  } catch (err: unknown) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error('   ', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

// -------------------------------------------------------------
// Suite 1: Campaign Data Model & Schema Validation
// -------------------------------------------------------------
console.log('Suite 1: Campaign Data Model & AI Context Contract');

const sampleCampaign: CampaignModel = {
  id: 'camp-test-1',
  name: 'Lançamento Bio-Active 2026',
  client: 'EcoVibe Cosméticos',
  description: 'Nova linha orgânica',
  product_or_service: 'Bio-Active Skincare Serum',
  campaign_objective: 'Gerar 20.000 cadastros e consolidar presença sustentável',
  target_audience: 'Homens e mulheres de 25-45 anos',
  key_message: 'Pele saudável sem agredir o planeta',
  tone_of_voice: 'Acolhedor e sofisticado',
  language: 'pt-BR',
  channels: ['Instagram', 'LinkedIn', 'YouTube'],
  visual_direction: 'Luz natural matutina, tons botânicos e texturas suaves',
  creative_constraints: 'Sem crueldade animal e com selo IBD visível',
  status: 'active',
  created_by: 'user-designer-99',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

test('Campaign model contains all required Phase 6 briefing fields', () => {
  assert(sampleCampaign.id, 'id is required');
  assert(sampleCampaign.name, 'name is required');
  assert(sampleCampaign.client, 'client is required');
  assert(sampleCampaign.product_or_service, 'product_or_service is required');
  assert(sampleCampaign.campaign_objective, 'campaign_objective is required');
  assert(sampleCampaign.target_audience, 'target_audience is required');
  assert(sampleCampaign.key_message, 'key_message is required');
  assert(sampleCampaign.tone_of_voice, 'tone_of_voice is required');
  assert(sampleCampaign.language, 'language is required');
  assert(Array.isArray(sampleCampaign.channels), 'channels must be an array');
  assert(sampleCampaign.visual_direction, 'visual_direction is required');
  assert(sampleCampaign.creative_constraints, 'creative_constraints is required');
  assert(sampleCampaign.status === 'active', 'status is valid');
});

test('Clean structured AI Context Contract accurately extracts briefing data for future AI', () => {
  const contract = buildCampaignAIContextContract(sampleCampaign);
  assert.strictEqual(contract.campaignId, 'camp-test-1');
  assert.strictEqual(contract.client, 'EcoVibe Cosméticos');
  assert.strictEqual(contract.objective, sampleCampaign.campaign_objective);
  assert.strictEqual(contract.targetAudience, sampleCampaign.target_audience);
  assert.strictEqual(contract.toneOfVoice, sampleCampaign.tone_of_voice);
  assert.strictEqual(contract.language, 'pt-BR');
  assert.deepStrictEqual(contract.channels, ['Instagram', 'LinkedIn', 'YouTube']);
  assert.strictEqual(contract.visualDirection, sampleCampaign.visual_direction);
  assert.strictEqual(contract.creativeConstraints, sampleCampaign.creative_constraints);
});

// -------------------------------------------------------------
// Suite 2: Status Transition Lifecycle Matrix
// -------------------------------------------------------------
console.log('\nSuite 2: Status Transition Lifecycle Matrix');

test('Valid transitions: draft -> active, draft -> archived', () => {
  assert.strictEqual(isValidStatusTransition('draft', 'active'), true);
  assert.strictEqual(isValidStatusTransition('draft', 'archived'), true);
  assert.strictEqual(isValidStatusTransition('draft', 'draft'), true); // Idempotent
});

test('Valid transitions: active -> in_review, active -> completed, active -> archived', () => {
  assert.strictEqual(isValidStatusTransition('active', 'in_review'), true);
  assert.strictEqual(isValidStatusTransition('active', 'completed'), true);
  assert.strictEqual(isValidStatusTransition('active', 'archived'), true);
});

test('Valid transitions: in_review -> active, in_review -> completed, in_review -> archived', () => {
  assert.strictEqual(isValidStatusTransition('in_review', 'active'), true);
  assert.strictEqual(isValidStatusTransition('in_review', 'completed'), true);
  assert.strictEqual(isValidStatusTransition('in_review', 'archived'), true);
});

test('Invalid transition: completed -> in_review is rejected', () => {
  assert.strictEqual(isValidStatusTransition('completed', 'in_review'), false);
});

test('Invalid transition: draft -> in_review directly is rejected without activation', () => {
  assert.strictEqual(isValidStatusTransition('draft', 'in_review'), false);
});

// -------------------------------------------------------------
// Suite 3: Campaign Store Operations & Membership Isolation
// -------------------------------------------------------------
console.log('\nSuite 3: Campaign Store Operations & Membership Isolation');

const newPayload: CreateCampaignPayload = {
  name: 'Nexus Cloud Enterprise',
  client: 'Nexus Systems',
  campaign_objective: 'Expandir base de contratos B2B em 40%',
  product_or_service: 'Nexus AI Cloud',
  target_audience: 'CTOs e Engenheiros Líderes',
  key_message: 'Deploy contínuo com governança auditável',
  tone_of_voice: 'Técnico e Seguro',
  language: 'pt-BR',
  channels: ['LinkedIn', 'Google Ads'],
};

let createdCampId = '';

test('Creating a campaign automatically enrolls creator as team member', () => {
  const created = memoryCampaignStore.createCampaign(
    newPayload,
    'user-designer-auto',
    'Designer',
    'designer@creativeai.com',
    'Creative Designer'
  );
  createdCampId = created.id;
  assert(created.id, 'Campaign ID should be generated');
  assert.strictEqual(created.name, 'Nexus Cloud Enterprise');
  assert.strictEqual(created.status, 'draft');
  assert.strictEqual(created.created_by, 'user-designer-auto');

  // Verify membership was recorded
  const isMember = memoryCampaignStore.isMember(created.id, 'user-designer-auto');
  assert.strictEqual(isMember, true, 'Creator must be enrolled as member');
  const members = memoryCampaignStore.getMembers(created.id);
  assert.strictEqual(members.length, 1);
  assert.strictEqual(members[0].user_id, 'user-designer-auto');
  assert.strictEqual(members[0].role, 'Designer');
});

test('Adding team members with distinct roles (Copywriter, Approver)', () => {
  const copywriterMember = memoryCampaignStore.addMember(
    createdCampId,
    'user-copy-1',
    'Copywriter',
    'copy@creativeai.com',
    'Copywriter 1'
  );
  assert.strictEqual(copywriterMember.role, 'Copywriter');

  const approverMember = memoryCampaignStore.addMember(
    createdCampId,
    'user-approver-1',
    'Approver',
    'approver@creativeai.com',
    'Approver 1'
  );
  assert.strictEqual(approverMember.role, 'Approver');

  const members = memoryCampaignStore.getMembers(createdCampId);
  assert.strictEqual(members.length, 3, 'Campaign should now have 3 members');
});

test('Updating campaign briefing fields updates timestamp and data cleanly', () => {
  const updated = memoryCampaignStore.updateCampaign(createdCampId, {
    key_message: 'Deploy sem downtime com zero complexidade',
    status: 'active',
  });
  assert(updated, 'Updated campaign should be returned');
  assert.strictEqual(updated.key_message, 'Deploy sem downtime com zero complexidade');
  assert.strictEqual(updated.status, 'active');
  assert(new Date(updated.updated_at).getTime() >= new Date(updated.created_at).getTime());
});

test('Removing a team member removes access from roster', () => {
  const removed = memoryCampaignStore.removeMember(createdCampId, 'user-copy-1');
  assert.strictEqual(removed, true, 'Member should be removed');
  assert.strictEqual(memoryCampaignStore.isMember(createdCampId, 'user-copy-1'), false);
  const remaining = memoryCampaignStore.getMembers(createdCampId);
  assert.strictEqual(remaining.length, 2);
});

// -------------------------------------------------------------
// Suite 4: Role-to-Campaign Permissions Validation
// -------------------------------------------------------------
console.log('\nSuite 4: Role-to-Campaign Permissions Validation');

test('Designer can create and edit campaigns', () => {
  assert.strictEqual(hasRolePermission('Designer', 'campaign.create'), true);
  assert.strictEqual(hasRolePermission('Designer', 'campaign.edit'), true);
  assert.strictEqual(hasRolePermission('Designer', 'campaign.view'), true);
});

test('Copywriter can view campaigns but CANNOT create or edit campaign briefing', () => {
  assert.strictEqual(hasRolePermission('Copywriter', 'campaign.view'), true);
  assert.strictEqual(hasRolePermission('Copywriter', 'campaign.create'), false);
  assert.strictEqual(hasRolePermission('Copywriter', 'campaign.edit'), false);
});

test('Approver can view campaigns but CANNOT create or edit campaign briefing', () => {
  assert.strictEqual(hasRolePermission('Approver', 'campaign.view'), true);
  assert.strictEqual(hasRolePermission('Approver', 'campaign.create'), false);
  assert.strictEqual(hasRolePermission('Approver', 'campaign.edit'), false);
});

test('Administrator has global campaign view, governance oversight, and role management', () => {
  assert.strictEqual(hasRolePermission('Administrator', 'campaign.view'), true);
  assert.strictEqual(hasRolePermission('Administrator', 'governance.view'), true);
  assert.strictEqual(hasRolePermission('Administrator', 'roles.manage'), true);
  // Administrator has governance/audit focus rather than creative editing
  assert.strictEqual(hasRolePermission('Administrator', 'campaign.create'), false);
});

console.log('\n================================================================');
console.log(`PHASE 6 TEST RESULTS: ${passCount} PASSED, 0 FAILED`);
console.log('================================================================\n');
