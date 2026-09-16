/**
 * UI & Presentation Types — Creative AI Marketing Platform
 * Types for Phase 3 application shell, navigation, and reusable components.
 */

export type UserRole = 'Designer' | 'Copywriter' | 'Approver' | 'Administrator';

export interface DevTestUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string;
  department: string;
}

export type NavigationId =
  | 'dashboard'
  | 'campaigns'
  | 'generate-image'
  | 'create-content'
  | 'gallery'
  | 'approvals'
  | 'collaboration'
  | 'history'
  | 'governance'
  | 'users-permissions'
  | 'costs-roi'
  | 'settings';

export interface NavigationItem {
  id: NavigationId;
  label: string;
  description?: string;
  iconName: string;
  badge?: string | number;
  allowedRoles?: UserRole[];
}

export type ContentStatus = 'draft' | 'pending' | 'in_review' | 'approved' | 'rejected';

export interface PresentationCampaign {
  id: string;
  name: string;
  client: string;
  objective: string;
  status: 'active' | 'in_review' | 'completed' | 'draft';
  piecesCount: number;
  membersCount: number;
  updatedAt: string;
}

export interface PresentationImageAsset {
  id: string;
  title: string;
  campaignName: string;
  creatorName: string;
  creatorRole: string;
  thumbnailUrl: string;
  style: string;
  aspectRatio: string;
  status: ContentStatus;
  providerLabel: string;
  createdAt: string;
}

export interface PresentationTextContent {
  id: string;
  title: string;
  campaignName: string;
  channel: string;
  targetAudience: string;
  creatorName: string;
  excerpt: string;
  status: ContentStatus;
  version: string;
  updatedAt: string;
}

export interface PresentationActivityItem {
  id: string;
  userName: string;
  userRole: UserRole;
  avatarUrl: string;
  action: string;
  targetTitle: string;
  campaignName: string;
  timestamp: string;
  type: 'creation' | 'approval' | 'rejection' | 'comment' | 'ai_generation';
}

export interface PresentationMetricCard {
  id: string;
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
  timeframe: string;
  iconName: string;
  caption: string;
}
