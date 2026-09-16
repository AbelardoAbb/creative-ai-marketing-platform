/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserRole } from './ui';

export type { UserRole };

/**
 * Granular Permission Matrix for Creative AI Marketing Platform
 * Defines discrete actions across the platform.
 */
export type Permission =
  | 'campaign.view'
  | 'campaign.create'
  | 'campaign.edit'
  | 'content.create'
  | 'content.edit'
  | 'content.view'
  | 'asset.create'
  | 'asset.generate'
  | 'asset.view'
  | 'approval.review'
  | 'approval.decide'
  | 'comment.create'
  | 'users.manage'
  | 'roles.manage'
  | 'governance.view'
  | 'audit.view'
  | 'costs.view';

/**
 * Canonical Role-to-Permission mapping (Phase 5 Refinement).
 * 
 * Designer:
 * - campaign.view
 * - campaign.create (when authorized)
 * - campaign.edit (when authorized)
 * - asset.create
 * - asset.generate
 * - content.view
 * 
 * Copywriter:
 * - campaign.view
 * - content.create
 * - content.edit
 * - content.view
 * - asset.view
 * 
 * Approver:
 * - campaign.view
 * - content.view
 * - asset.view
 * - approval.review
 * - approval.decide
 * - comment.create
 * 
 * Administrator:
 * - users.manage
 * - roles.manage
 * - governance.view
 * - audit.view
 * - costs.view
 * - campaign.view
 * 
 * CRITICAL GOVERNANCE RULES:
 * - Administrator does NOT automatically receive approval.decide.
 * - The creator of a resource must never be allowed to approve that same resource.
 */
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  Designer: [
    'campaign.view',
    'campaign.create',
    'campaign.edit',
    'asset.create',
    'asset.generate',
    'content.view',
  ],
  Copywriter: [
    'campaign.view',
    'content.create',
    'content.edit',
    'content.view',
    'asset.view',
  ],
  Approver: [
    'campaign.view',
    'content.view',
    'asset.view',
    'approval.review',
    'approval.decide',
    'comment.create',
  ],
  Administrator: [
    'users.manage',
    'roles.manage',
    'governance.view',
    'audit.view',
    'costs.view',
    'campaign.view',
  ],
} as const;

/**
 * Checks if a specific role inherently holds a permission.
 */
export function hasRolePermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions ? permissions.includes(permission) : false;
}

/**
 * Campaign & Membership Types
 */
export interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'in_review' | 'completed' | 'archived';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignMember {
  id: string;
  campaignId: string;
  userId: string;
  role: UserRole;
  createdAt: string;
  userEmail?: string;
  userDisplayName?: string;
}

export interface CampaignAccessResult {
  authorized: boolean;
  reason?: string;
  memberRole?: UserRole;
}

/**
 * Enforces the anti-self-approval rule:
 * An Approver cannot approve or reject content they created themselves.
 */
export function canUserApproveContent(
  reviewerId: string,
  reviewerRole: UserRole,
  authorId: string
): { allowed: boolean; reason?: string } {
  if (!hasRolePermission(reviewerRole, 'approval.decide')) {
    return {
      allowed: false,
      reason: `Usuários com o papel '${reviewerRole}' não possuem autorização para aprovar conteúdo.`,
    };
  }

  if (reviewerId === authorId) {
    return {
      allowed: false,
      reason: 'Violação de Governança: O criador do conteúdo não pode aprovar a própria peça.',
    };
  }

  return { allowed: true };
}

/**
 * Authenticated User Identity
 * Derived strictly from authenticated Supabase Auth session and server-side role resolution.
 */
export interface UserIdentity {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
  accountStatus: 'active' | 'suspended' | 'pending_verification';
  createdAt?: string;
}

/**
 * Supabase Integration Status
 */
export type SupabaseStatus = 'CONFIGURED' | 'BLOCKED';

export interface SupabaseConfigStatus {
  status: SupabaseStatus;
  configured: boolean;
  supabaseUrl: string | null;
  missingEnvVars: string[];
  reason: string;
}
