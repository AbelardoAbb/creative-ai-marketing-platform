/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'assert';
import { contentStore } from '../server/contentStore';
import {
  hasRolePermission,
  canUserApproveContent,
} from '../src/types/auth';
import {
  isValidContentStatusTransition,
  VALID_CONTENT_STATUS_TRANSITIONS,
} from '../src/types/content';

console.log('================================================================');
console.log('CREATIVE AI MARKETING PLATFORM — PHASE 9: WORKFLOW & GOVERNANCE TESTS');
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
  const campaignId = 'camp-phase9-test';

  // Seed test users
  const creatorUser = {
    id: 'user-copywriter-creator',
    name: 'Carlos Copywriter',
    role: 'Copywriter' as const,
  };

  const approverUser = {
    id: 'user-approver-lead',
    name: 'Beatriz Approver',
    role: 'Approver' as const,
  };

  const designerUser = {
    id: 'user-designer',
    name: 'Daniel Designer',
    role: 'Designer' as const,
  };

  const adminUser = {
    id: 'user-admin',
    name: 'Ana Administrator',
    role: 'Administrator' as const,
  };

  const viewerUser = {
    id: 'user-viewer',
    name: 'Vitor Viewer',
    role: 'Viewer' as const,
  };

  // --------------------------------------------------------------------------
  console.log('Suite 1: Role Permissions & Governance Rules');
  // --------------------------------------------------------------------------

  await runTest('Copywriter has content.create and content.edit, but NOT approval.decide', () => {
    assert.strictEqual(hasRolePermission('Copywriter', 'content.create'), true);
    assert.strictEqual(hasRolePermission('Copywriter', 'content.edit'), true);
    assert.strictEqual(hasRolePermission('Copywriter', 'approval.decide'), false);
    assert.strictEqual(hasRolePermission('Copywriter', 'approval.review'), false);
  });

  await runTest('Designer has asset.generate and content.view, but NOT approval.decide', () => {
    assert.strictEqual(hasRolePermission('Designer', 'asset.generate'), true);
    assert.strictEqual(hasRolePermission('Designer', 'content.view'), true);
    assert.strictEqual(hasRolePermission('Designer', 'approval.decide'), false);
    assert.strictEqual(hasRolePermission('Designer', 'approval.review'), false);
  });

  await runTest('Approver has approval.decide and approval.review', () => {
    assert.strictEqual(hasRolePermission('Approver', 'approval.decide'), true);
    assert.strictEqual(hasRolePermission('Approver', 'approval.review'), true);
  });

  await runTest('Administrator does NOT automatically receive approval.decide (Separation of Concerns)', () => {
    // Phase 9 Section 4: "Administrator does NOT automatically become Approver"
    assert.strictEqual(hasRolePermission('Administrator', 'approval.decide'), false);
  });

  await runTest('Designer has no approval decision permissions', () => {
    assert.strictEqual(hasRolePermission('Designer', 'approval.decide'), false);
    assert.strictEqual(hasRolePermission('Designer', 'approval.review'), false);
  });

  await runTest('Copywriter has no approval decision permissions', () => {
    assert.strictEqual(hasRolePermission('Copywriter', 'approval.decide'), false);
    assert.strictEqual(hasRolePermission('Copywriter', 'approval.review'), false);
  });

  // --------------------------------------------------------------------------
  console.log('\nSuite 2: State Machine Validation');
  // --------------------------------------------------------------------------

  await runTest('Valid transitions succeed', () => {
    assert.strictEqual(isValidContentStatusTransition('DRAFT', 'READY_FOR_REVIEW'), true);
    assert.strictEqual(isValidContentStatusTransition('AI_GENERATED', 'READY_FOR_REVIEW'), true);
    assert.strictEqual(isValidContentStatusTransition('HUMAN_EDITED', 'READY_FOR_REVIEW'), true);
    assert.strictEqual(isValidContentStatusTransition('READY_FOR_REVIEW', 'UNDER_REVIEW'), true);
    assert.strictEqual(isValidContentStatusTransition('READY_FOR_REVIEW', 'APPROVED'), true);
    assert.strictEqual(isValidContentStatusTransition('READY_FOR_REVIEW', 'REJECTED'), true);
    assert.strictEqual(isValidContentStatusTransition('UNDER_REVIEW', 'APPROVED'), true);
    assert.strictEqual(isValidContentStatusTransition('UNDER_REVIEW', 'REJECTED'), true);
    assert.strictEqual(isValidContentStatusTransition('REJECTED', 'HUMAN_EDITED'), true);
    assert.strictEqual(isValidContentStatusTransition('REJECTED', 'READY_FOR_REVIEW'), true);
  });

  await runTest('Invalid transitions are blocked', () => {
    // Cannot bypass review directly from DRAFT to APPROVED
    assert.strictEqual(isValidContentStatusTransition('DRAFT', 'APPROVED'), false);
    // Cannot move directly from AI_GENERATED to APPROVED without human review
    assert.strictEqual(isValidContentStatusTransition('AI_GENERATED', 'APPROVED'), false);
    // Cannot move from APPROVED back to UNDER_REVIEW
    assert.strictEqual(isValidContentStatusTransition('APPROVED', 'UNDER_REVIEW'), false);
    // Cannot move from APPROVED back to READY_FOR_REVIEW
    assert.strictEqual(isValidContentStatusTransition('APPROVED', 'READY_FOR_REVIEW'), false);
    // Cannot move from DRAFT to UNDER_REVIEW directly
    assert.strictEqual(isValidContentStatusTransition('DRAFT', 'UNDER_REVIEW'), false);
  });

  // --------------------------------------------------------------------------
  console.log('\nSuite 3: Content Submission & Workflow Lifecycle');
  // --------------------------------------------------------------------------

  const contentItem = contentStore.createContent({
    campaign_id: campaignId,
    title: 'Post Sustentabilidade e Beleza Limpa',
    channel: 'Social Media',
    content: 'Descubra a revolução do autocuidado sustentável. Menos embalagens plásticas, mais respeito.',
    created_by: creatorUser.id,
    created_by_name: creatorUser.name,
    created_by_role: creatorUser.role,
    status: 'DRAFT',
  });

  await runTest('Creator creates content in DRAFT status', () => {
    assert.ok(contentItem);
    assert.strictEqual(contentItem.status, 'DRAFT');
    assert.strictEqual(contentItem.current_version, 1);
  });

  await runTest('Cannot submit empty content for review', () => {
    const emptyItem = contentStore.createContent({
      campaign_id: campaignId,
      title: 'Post Vazio',
      channel: 'Email',
      content: '   ',
      created_by: creatorUser.id,
      created_by_name: creatorUser.name,
      created_by_role: creatorUser.role,
      status: 'DRAFT',
    });

    const submitRes = contentStore.submitForReview(emptyItem.id, creatorUser);
    assert.strictEqual(submitRes.success, false);
    assert.match(submitRes.error || '', /vazio/i);
  });

  await runTest('Authorized creator submits content for review (DRAFT -> READY_FOR_REVIEW)', () => {
    const submitRes = contentStore.submitForReview(contentItem.id, creatorUser);
    assert.strictEqual(submitRes.success, true);
    assert.strictEqual(submitRes.content?.status, 'READY_FOR_REVIEW');
    assert.ok(submitRes.content?.submitted_at);
    assert.strictEqual(submitRes.event?.action, 'SUBMITTED_FOR_REVIEW');
    assert.strictEqual(submitRes.event?.actor_id, creatorUser.id);
  });

  await runTest('Reviewer starts review (READY_FOR_REVIEW -> UNDER_REVIEW)', () => {
    const startRes = contentStore.startReview(contentItem.id, approverUser);
    assert.strictEqual(startRes.success, true);
    assert.strictEqual(startRes.content?.status, 'UNDER_REVIEW');
    assert.strictEqual(startRes.event?.action, 'REVIEW_STARTED');
    assert.strictEqual(startRes.event?.actor_id, approverUser.id);
  });

  // --------------------------------------------------------------------------
  console.log('\nSuite 4: Anti-Self-Approval & Approval Governance');
  // --------------------------------------------------------------------------

  await runTest('CRITICAL: Content creator CANNOT approve own content (canUserApproveContent)', () => {
    const canApprove = canUserApproveContent(
      creatorUser.id,
      'Approver', // even if creator were assigned an approver role
      contentItem.created_by
    );
    assert.strictEqual(canApprove.allowed, false);
    assert.match(canApprove.reason || '', /Violação de Governança.*criador/i);
  });

  await runTest('CRITICAL: Server-side approveContent blocks creator self-approval', () => {
    const attemptSelfApprove = contentStore.approveContent(
      contentItem.id,
      { id: creatorUser.id, name: creatorUser.name, role: 'Approver' },
      'Aprovando meu próprio texto'
    );
    assert.strictEqual(attemptSelfApprove.success, false);
    assert.match(attemptSelfApprove.error || '', /Violação de Governança.*criador/i);

    // Verify content is still UNDER_REVIEW, not approved!
    const current = contentStore.getContent(contentItem.id);
    assert.strictEqual(current?.status, 'UNDER_REVIEW');
  });

  await runTest('Different user with Approver role CAN approve content', () => {
    const canApprove = canUserApproveContent(
      approverUser.id,
      approverUser.role,
      contentItem.created_by
    );
    assert.strictEqual(canApprove.allowed, true);
  });

  // --------------------------------------------------------------------------
  console.log('\nSuite 5: Rejection, Meaningful Justification & Version Traceability');
  // --------------------------------------------------------------------------

  await runTest('Rejection with empty or whitespace-only reason is REJECTED', () => {
    const emptyReject = contentStore.rejectContent(contentItem.id, approverUser, '   ');
    assert.strictEqual(emptyReject.success, false);
    assert.match(emptyReject.error || '', /obrigat[oó]ria/i);

    // Status remains UNDER_REVIEW
    const current = contentStore.getContent(contentItem.id);
    assert.strictEqual(current?.status, 'UNDER_REVIEW');
  });

  await runTest('Authorized reviewer rejects content with meaningful justification', () => {
    const justification = 'Ajustar o tom para soar mais científico e mencionar certificação vegana explicitamente.';
    const rejectRes = contentStore.rejectContent(contentItem.id, approverUser, justification);

    assert.strictEqual(rejectRes.success, true);
    assert.strictEqual(rejectRes.content?.status, 'REJECTED');
    assert.strictEqual(rejectRes.content?.rejection_reason, justification);
    assert.strictEqual(rejectRes.content?.reviewed_by, approverUser.id);
    assert.strictEqual(rejectRes.record?.decision, 'REJECTED');
    assert.strictEqual(rejectRes.record?.reason, justification);
    assert.strictEqual(rejectRes.event?.action, 'REJECTED');
  });

  await runTest('Creator revises rejected content: creates Version #2 preserving Version #1', () => {
    const revisedText = 'Descubra a revolução do autocuidado sustentável com certificação vegana e respaldo dermatológico limpo.';
    const reviseRes = contentStore.reviseRejectedContent(
      contentItem.id,
      creatorUser,
      revisedText,
      'Versão ajustada com inclusão de certificação vegana solicitada pelo revisor'
    );

    assert.strictEqual(reviseRes.success, true);
    assert.strictEqual(reviseRes.content?.status, 'HUMAN_EDITED');
    assert.strictEqual(reviseRes.content?.current_version, 2);
    assert.strictEqual(reviseRes.content?.content, revisedText);

    // Verify version 1 is completely preserved and untouched
    const versions = contentStore.getContentVersions(contentItem.id);
    assert.strictEqual(versions.length, 2);
    assert.strictEqual(versions[0].version_number, 1);
    assert.strictEqual(versions[0].content, 'Descubra a revolução do autocuidado sustentável. Menos embalagens plásticas, mais respeito.');
    assert.strictEqual(versions[1].version_number, 2);
    assert.strictEqual(versions[1].content, revisedText);
  });

  await runTest('Resubmit revised content (HUMAN_EDITED -> READY_FOR_REVIEW)', () => {
    const resubmitRes = contentStore.submitForReview(contentItem.id, creatorUser);
    assert.strictEqual(resubmitRes.success, true);
    assert.strictEqual(resubmitRes.content?.status, 'READY_FOR_REVIEW');
    assert.strictEqual(resubmitRes.event?.action, 'RESUBMITTED');
  });

  await runTest('Independent Approver approves revised Version #2', () => {
    const approveRes = contentStore.approveContent(
      contentItem.id,
      approverUser,
      'Aprovado! Excelente inclusão da certificação vegana.'
    );

    assert.strictEqual(approveRes.success, true);
    assert.strictEqual(approveRes.content?.status, 'APPROVED');
    assert.strictEqual(approveRes.content?.current_version, 2);
    assert.strictEqual(approveRes.content?.reviewed_by, approverUser.id);
    assert.strictEqual(approveRes.record?.decision, 'APPROVED');
    assert.strictEqual(approveRes.record?.version_number, 2);
    assert.strictEqual(approveRes.event?.action, 'APPROVED');
  });

  // --------------------------------------------------------------------------
  console.log('\nSuite 6: Collaboration Comments & Audit Timeline');
  // --------------------------------------------------------------------------

  await runTest('Add collaboration comment with server-derived identity', () => {
    const commentRes = contentStore.addComment(contentItem.id, {
      campaign_id: campaignId,
      version_number: 2,
      author_id: designerUser.id,
      author_name: designerUser.name,
      author_role: designerUser.role,
      text: 'Visual pronto e alinhado com a paleta botânica.',
    });

    assert.strictEqual(commentRes.success, true);
    assert.ok(commentRes.comment);
    assert.strictEqual(commentRes.comment.author_id, designerUser.id);
    assert.strictEqual(commentRes.comment.text, 'Visual pronto e alinhado com a paleta botânica.');
  });

  await runTest('Empty comment text is rejected', () => {
    const emptyCommentRes = contentStore.addComment(contentItem.id, {
      campaign_id: campaignId,
      version_number: 2,
      author_id: designerUser.id,
      author_name: designerUser.name,
      author_role: designerUser.role,
      text: '   ',
    });

    assert.strictEqual(emptyCommentRes.success, false);
    assert.match(emptyCommentRes.error || '', /obrigat[oó]rio/i);
  });

  await runTest('Audit events capture complete chronological history', () => {
    const events = contentStore.getReviewEvents(contentItem.id);
    assert.ok(events.length >= 5);

    const actions = events.map((e) => e.action);
    assert.ok(actions.includes('SUBMITTED_FOR_REVIEW'));
    assert.ok(actions.includes('REVIEW_STARTED'));
    assert.ok(actions.includes('REJECTED'));
    assert.ok(actions.includes('RESUBMITTED'));
    assert.ok(actions.includes('APPROVED'));
    assert.ok(actions.includes('COMMENT_ADDED'));
  });

  await runTest('Review queue returns items filtered by status', () => {
    const queue = contentStore.getReviewQueue(campaignId);
    assert.ok(queue.length >= 1);

    const approvedOnly = contentStore.getReviewQueue(campaignId, 'APPROVED');
    assert.ok(approvedOnly.every((c) => c.status === 'APPROVED'));

    const rejectedOnly = contentStore.getReviewQueue(campaignId, 'REJECTED');
    assert.ok(rejectedOnly.every((c) => c.status === 'REJECTED'));
  });

  console.log('\n================================================================');
  console.log(`ALL ${passCount} PHASE 9 WORKFLOW & GOVERNANCE TESTS PASSED SUCCESSFULLY!`);
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
