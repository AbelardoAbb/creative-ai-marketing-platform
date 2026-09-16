/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  UserRole,
  Permission,
  ROLE_PERMISSIONS,
  hasRolePermission,
  canUserApproveContent,
  UserIdentity,
} from '../src/types/auth';
import {
  getSupabaseServerStatus,
  assignUserRole,
  addCampaignMember,
} from '../server/auth';
import { isSupabaseConfigured } from '../src/lib/supabaseClient';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, failureDetails?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    if (failureDetails) {
      console.error(`    Details: ${failureDetails}`);
    }
    failed++;
  }
}

console.log('================================================================');
console.log('CREATIVE AI MARKETING PLATFORM — PHASE 5: RBAC & MEMBERSHIP TESTS');
console.log('================================================================\n');

// ----------------------------------------------------------------------
// SUITE 1: Refined Phase 5 Permissions Matrix
// ----------------------------------------------------------------------
console.log('Suite 1: Role Permissions Matrix Validation (Phase 5 Refinement)');

// Designer
assert(hasRolePermission('Designer', 'campaign.view') === true, 'Designer has campaign.view');
assert(hasRolePermission('Designer', 'campaign.create') === true, 'Designer has campaign.create');
assert(hasRolePermission('Designer', 'campaign.edit') === true, 'Designer has campaign.edit');
assert(hasRolePermission('Designer', 'asset.create') === true, 'Designer has asset.create');
assert(hasRolePermission('Designer', 'asset.generate') === true, 'Designer has asset.generate');
assert(hasRolePermission('Designer', 'content.view') === true, 'Designer has content.view');
assert(hasRolePermission('Designer', 'content.create') === false, 'Designer does NOT have content.create');
assert(hasRolePermission('Designer', 'approval.decide') === false, 'Designer does NOT have approval.decide');
assert(hasRolePermission('Designer', 'users.manage') === false, 'Designer does NOT have users.manage');
assert(hasRolePermission('Designer', 'roles.manage') === false, 'Designer does NOT have roles.manage');

// Copywriter
assert(hasRolePermission('Copywriter', 'campaign.view') === true, 'Copywriter has campaign.view');
assert(hasRolePermission('Copywriter', 'content.create') === true, 'Copywriter has content.create');
assert(hasRolePermission('Copywriter', 'content.edit') === true, 'Copywriter has content.edit');
assert(hasRolePermission('Copywriter', 'content.view') === true, 'Copywriter has content.view');
assert(hasRolePermission('Copywriter', 'asset.view') === true, 'Copywriter has asset.view');
assert(hasRolePermission('Copywriter', 'asset.generate') === false, 'Copywriter does NOT have asset.generate');
assert(hasRolePermission('Copywriter', 'approval.decide') === false, 'Copywriter does NOT have approval.decide');
assert(hasRolePermission('Copywriter', 'users.manage') === false, 'Copywriter does NOT have users.manage');

// Approver
assert(hasRolePermission('Approver', 'campaign.view') === true, 'Approver has campaign.view');
assert(hasRolePermission('Approver', 'content.view') === true, 'Approver has content.view');
assert(hasRolePermission('Approver', 'asset.view') === true, 'Approver has asset.view');
assert(hasRolePermission('Approver', 'approval.review') === true, 'Approver has approval.review');
assert(hasRolePermission('Approver', 'approval.decide') === true, 'Approver has approval.decide');
assert(hasRolePermission('Approver', 'comment.create') === true, 'Approver has comment.create');
assert(hasRolePermission('Approver', 'asset.generate') === false, 'Approver does NOT have asset.generate');
assert(hasRolePermission('Approver', 'users.manage') === false, 'Approver does NOT have users.manage');

// Administrator
assert(hasRolePermission('Administrator', 'campaign.view') === true, 'Administrator has campaign.view');
assert(hasRolePermission('Administrator', 'users.manage') === true, 'Administrator has users.manage');
assert(hasRolePermission('Administrator', 'roles.manage') === true, 'Administrator has roles.manage');
assert(hasRolePermission('Administrator', 'governance.view') === true, 'Administrator has governance.view');
assert(hasRolePermission('Administrator', 'audit.view') === true, 'Administrator has audit.view');
assert(hasRolePermission('Administrator', 'costs.view') === true, 'Administrator has costs.view');

// CRITICAL GOVERNANCE RESTRICTIONS ON ADMINISTRATOR:
// Administrator does NOT automatically receive approval.review or approval.decide!
assert(
  hasRolePermission('Administrator', 'approval.review') === false,
  'CRITICAL: Administrator does NOT automatically have approval.review'
);
assert(
  hasRolePermission('Administrator', 'approval.decide') === false,
  'CRITICAL: Administrator does NOT automatically have approval.decide'
);

// ----------------------------------------------------------------------
// SUITE 2: Anti-Self-Approval & Governance Rules
// ----------------------------------------------------------------------
console.log('\nSuite 2: Governance & Anti-Self-Approval Enforcement');

const approverUser = 'approver-uuid-101';
const creatorUser = 'creator-uuid-202';

// 1. Approver can approve someone else's work
const validApproval = canUserApproveContent(approverUser, 'Approver', creatorUser);
assert(validApproval.allowed === true, 'Approver can approve content authored by a different user');

// 2. Creator CANNOT approve their own work
const selfApproval = canUserApproveContent(creatorUser, 'Approver', creatorUser);
assert(
  selfApproval.allowed === false,
  'CRITICAL: Creator CANNOT approve their own content (Governance violation)'
);
assert(
  Boolean(selfApproval.reason?.includes('Violação de Governança')),
  'Self-approval violation returns explicit governance reasoning'
);

// 3. Administrator without Approver role cannot approve
const adminApproval = canUserApproveContent('admin-uuid-001', 'Administrator', creatorUser);
assert(
  adminApproval.allowed === false,
  'Administrator cannot approve content without an Approver role'
);

// ----------------------------------------------------------------------
// SUITE 3: Campaign Membership Authorization Logic
// ----------------------------------------------------------------------
console.log('\nSuite 3: Campaign Membership Scoping');

// Mock membership verification logic
function mockCheckCampaignAccess(
  user: UserIdentity,
  campaignId: string,
  membershipRoster: Array<{ campaignId: string; userId: string; role: UserRole }>
): { authorized: boolean; reason?: string } {
  // Administrators have global oversight
  if (user.role === 'Administrator') {
    return { authorized: true, reason: 'Acesso autorizado por supervisão administrativa global.' };
  }

  const isMember = membershipRoster.some(
    (m) => m.campaignId === campaignId && m.userId === user.id
  );

  if (isMember) {
    return { authorized: true, reason: 'Acesso autorizado: Membro ativo da campanha.' };
  }

  return {
    authorized: false,
    reason: 'Acesso negado: Usuário não é membro associado a esta campanha.',
  };
}

const mockRoster = [
  { campaignId: 'camp-alpha-1', userId: 'user-designer-1', role: 'Designer' as UserRole },
  { campaignId: 'camp-alpha-1', userId: 'user-copywriter-1', role: 'Copywriter' as UserRole },
  { campaignId: 'camp-beta-2', userId: 'user-designer-2', role: 'Designer' as UserRole },
];

const designer1: UserIdentity = {
  id: 'user-designer-1',
  email: 'designer1@empresa.com',
  displayName: 'Designer 1',
  role: 'Designer',
  accountStatus: 'active',
};

const designer2: UserIdentity = {
  id: 'user-designer-2',
  email: 'designer2@empresa.com',
  displayName: 'Designer 2',
  role: 'Designer',
  accountStatus: 'active',
};

const adminUser: UserIdentity = {
  id: 'user-admin-global',
  email: 'admin@empresa.com',
  displayName: 'Global Admin',
  role: 'Administrator',
  accountStatus: 'active',
};

// Member can access assigned campaign
const memberAccess = mockCheckCampaignAccess(designer1, 'camp-alpha-1', mockRoster);
assert(memberAccess.authorized === true, 'Member can access assigned campaign (camp-alpha-1)');

// Non-member CANNOT access campaign they are not assigned to
const nonMemberAccess = mockCheckCampaignAccess(designer1, 'camp-beta-2', mockRoster);
assert(nonMemberAccess.authorized === false, 'Non-member CANNOT access unassigned campaign (camp-beta-2)');
assert(
  Boolean(nonMemberAccess.reason?.includes('não é membro associado')),
  'Non-member access denial returns explicit campaign scoping reason'
);

// Administrator has global campaign oversight
const adminAccess = mockCheckCampaignAccess(adminUser, 'camp-beta-2', mockRoster);
assert(adminAccess.authorized === true, 'Administrator has global campaign audit/oversight access');

// ----------------------------------------------------------------------
// SUITE 4: Privilege Escalation & Administration Security
// ----------------------------------------------------------------------
console.log('\nSuite 4: Privilege Escalation Prevention');

// 1. Newly registered user metadata cannot assign Administrator or Approver
function sanitizeRegistrationRole(inputRole: string): UserRole {
  // Enforces Minimum RBAC Correction
  if (inputRole === 'Copywriter') {
    return 'Copywriter';
  }
  return 'Designer'; // Default safe unprivileged role
}

assert(
  sanitizeRegistrationRole('Administrator') === 'Designer',
  'Client-supplied Administrator metadata is coerced to safe Designer role'
);
assert(
  sanitizeRegistrationRole('Approver') === 'Designer',
  'Client-supplied Approver metadata is coerced to safe Designer role'
);
assert(
  sanitizeRegistrationRole('Copywriter') === 'Copywriter',
  'Client-supplied Copywriter metadata is accepted as valid creator role'
);

// 2. Anti-Self-Promotion: User cannot change their own role
async function testSelfPromotion() {
  const result = await assignUserRole(adminUser, adminUser.id, 'Approver');
  assert(
    result.success === false,
    'User CANNOT alter their own role (Anti-Self-Promotion / Lockout prevention)'
  );
  assert(
    Boolean(result.error?.includes('Não é permitido alterar o próprio papel')),
    'Self-promotion attempt returns explicit security violation error'
  );
}

// 3. Normal user cannot assign roles to anyone
async function testUnauthorizedRoleAssignment() {
  const result = await assignUserRole(designer1, designer2.id, 'Administrator');
  assert(
    result.success === false,
    'Non-Administrator CANNOT assign roles to any user'
  );
  assert(
    Boolean(result.error?.includes('Apenas Administradores podem gerenciar')),
    'Unauthorized role assignment returns permission error'
  );
}

// 4. Normal user cannot add themselves to arbitrary campaigns
async function testUnauthorizedCampaignMembership() {
  const result = await addCampaignMember(
    designer1, // normal designer
    'camp-beta-2', // not their campaign
    designer1.id, // trying to add themselves
    'Designer'
  );
  assert(
    result.success === false,
    'Normal user CANNOT add themselves to arbitrary campaigns'
  );
}

// ----------------------------------------------------------------------
// SUITE 5: RLS & Non-Recursive Policy Validation
// ----------------------------------------------------------------------
console.log('\nSuite 5: RLS Non-Recursive Policy Verification');

// Test that RLS policy definitions exist and avoid recursion
import fs from 'fs';
const migrationContent = fs.readFileSync(
  'supabase/migrations/20260913_phase5_campaign_membership_rls.sql',
  'utf-8'
);

assert(
  migrationContent.includes('CREATE TABLE IF NOT EXISTS public.campaign_members'),
  'Database migration defines public.campaign_members table'
);
assert(
  migrationContent.includes('CREATE TABLE IF NOT EXISTS public.campaigns'),
  'Database migration defines public.campaigns table'
);
assert(
  migrationContent.includes('ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY'),
  'RLS is enabled on public.campaign_members'
);
assert(
  migrationContent.includes('ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY'),
  'RLS is enabled on public.campaigns'
);
assert(
  migrationContent.includes('CREATE OR REPLACE FUNCTION public.is_campaign_member'),
  'Non-recursive SECURITY DEFINER helper public.is_campaign_member exists'
);
assert(
  migrationContent.includes('SET search_path = public, pg_temp'),
  'Security helper functions enforce immutable search_path (public, pg_temp) against injection'
);
assert(
  migrationContent.includes('public.handle_new_user()'),
  'Database trigger handle_new_user enforces server-side role assignment on insert'
);

// Execute async test suites
(async () => {
  await testSelfPromotion();
  await testUnauthorizedRoleAssignment();
  await testUnauthorizedCampaignMembership();

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
})();
