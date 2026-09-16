/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from 'dotenv';
dotenv.config();

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Request, Response, NextFunction } from 'express';
import {
  UserRole,
  Permission,
  ROLE_PERMISSIONS,
  hasRolePermission,
  UserIdentity,
  SupabaseConfigStatus,
  Campaign,
  CampaignMember,
} from '../src/types/auth';
import { memoryCampaignStore } from './campaignStore';

/**
 * Server-Side Supabase Configuration.
 * 
 * SECURITY DIRECTIVES:
 * 1. SUPABASE_SERVICE_ROLE_KEY is strictly accessed on the server.
 * 2. It is NEVER transmitted to the browser, placed in client bundles, or logged.
 * 3. Client identity and role are derived strictly from verified JWT tokens and database lookup.
 */
function cleanSupabaseUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  // If a publishable key or project ref was mistakenly passed as URL, extract ref from JWT if available
  try {
    const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    if (anon.includes('.')) {
      const payload = JSON.parse(Buffer.from(anon.split('.')[1], 'base64').toString());
      if (payload?.ref) {
        return `https://${payload.ref}.supabase.co`;
      }
    }
  } catch {}
  return '';
}

const SUPABASE_URL = cleanSupabaseUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '');
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

let serverAdminClient: SupabaseClient | null = null;

export function isServerSupabaseConfigured(): boolean {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_URL !== 'https://your-project.supabase.co' &&
    (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY)
  );
}

export function getSupabaseServerStatus(): SupabaseConfigStatus {
  const missing: string[] = [];
  if (!SUPABASE_URL || SUPABASE_URL === 'https://your-project.supabase.co') {
    missing.push('SUPABASE_URL');
  }
  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === 'your-anon-key') {
    missing.push('SUPABASE_ANON_KEY');
  }
  if (!SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY === 'your-service-role-key') {
    missing.push('SUPABASE_SERVICE_ROLE_KEY (opcional para testes básicos, obrigatório para RLS bypass no servidor)');
  }

  const isConfigured = missing.filter((m) => !m.includes('opcional')).length === 0;

  return {
    status: isConfigured ? 'CONFIGURED' : 'BLOCKED',
    configured: isConfigured,
    supabaseUrl: SUPABASE_URL || null,
    missingEnvVars: missing,
    reason: isConfigured
      ? 'Supabase Auth & Database configurados com sucesso.'
      : 'Credenciais do Supabase não configuradas no ambiente. A autenticação real está em estado BLOCKED até a definição das variáveis.',
  };
}

export function getServerSupabaseAdminClient(): SupabaseClient | null {
  if (!isServerSupabaseConfigured()) {
    return null;
  }

  if (!serverAdminClient) {
    const keyToUse = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    serverAdminClient = createClient(SUPABASE_URL, keyToUse, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return serverAdminClient;
}

// Augment Express Request type
export interface AuthenticatedRequest extends Request {
  user?: UserIdentity;
  campaignMemberRole?: UserRole;
}

/**
 * Derives user identity from authenticated JWT token and server-side role resolution.
 * 
 * SECURITY ENFORCEMENT (Minimum RBAC Correction):
 * Client metadata (user_metadata) can NEVER self-assign 'Administrator' or 'Approver'.
 * True role must come from trusted server database table (user_roles).
 */
export async function authenticateToken(token: string): Promise<UserIdentity | null> {
  const client = getServerSupabaseAdminClient();
  if (!client) {
    return null;
  }

  try {
    // 1. Verify token cryptographically with Supabase Auth
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      console.warn('[Auth] Token validation failed:', error?.message);
      return null;
    }

    const authUser = data.user;

    // 2. Fetch role from user_roles database table (Single Source of Truth)
    let role: UserRole = 'Designer';
    let accountStatus: 'active' | 'suspended' | 'pending_verification' = 'active';

    const { data: roleData, error: roleError } = await client
      .from('user_roles')
      .select('role, account_status')
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (!roleError && roleData) {
      role = roleData.role as UserRole;
      accountStatus = roleData.account_status as 'active' | 'suspended' | 'pending_verification';
    } else {
      // Check server-controlled app_metadata (can only be set via service role)
      const appRole = authUser.app_metadata?.role;
      if (['Administrator', 'Approver', 'Designer', 'Copywriter'].includes(appRole)) {
        role = appRole as UserRole;
      } else {
        // Fallback for user_metadata: ONLY allow safe unprivileged roles!
        // Client can NEVER self-promote to Administrator or Approver.
        const metaRole = authUser.user_metadata?.role;
        if (metaRole === 'Copywriter') {
          role = 'Copywriter';
        } else {
          role = 'Designer'; // Default safe unprivileged role
        }
      }
    }

    const displayName =
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      authUser.email?.split('@')[0] ||
      'Usuário';

    return {
      id: authUser.id,
      email: authUser.email || '',
      displayName,
      avatarUrl: authUser.user_metadata?.avatar_url,
      role,
      accountStatus,
      createdAt: authUser.created_at,
    };
  } catch (err) {
    console.error('[Auth] Unexpected error during token authentication:', err);
    return null;
  }
}

/**
 * Express Middleware: Requires valid Supabase Auth Bearer token.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!isServerSupabaseConfigured()) {
    res.status(503).json({
      error: 'SupabaseUnavailable',
      status: 'BLOCKED',
      message: 'O serviço de autenticação Supabase não está configurado.',
    });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Development fallback when token not yet issued
    const devUserId = req.headers['x-user-id'] as string;
    if (process.env.NODE_ENV !== 'production' && devUserId) {
      const devRole = (req.headers['x-user-role'] as UserRole) || 'Copywriter';
      req.user = {
        id: devUserId,
        email: (req.headers['x-user-email'] as string) || 'dev@example.com',
        displayName: (req.headers['x-user-name'] as string) || 'Dev User',
        role: devRole,
        accountStatus: 'active',
        createdAt: new Date().toISOString(),
      };
      next();
      return;
    }

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Token de autenticação ausente. Forneça o header Authorization: Bearer <token>.',
    });
    return;
  }

  const token = authHeader.substring(7).trim();
  const identity = await authenticateToken(token);

  if (!identity) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Sessão inválida ou expirada. Efetue login novamente.',
    });
    return;
  }

  if (identity.accountStatus !== 'active') {
    res.status(403).json({
      error: 'AccountSuspended',
      message: 'Sua conta está suspensa ou aguardando verificação.',
    });
    return;
  }

  req.user = identity;
  next();
}

/**
 * Express Middleware: Requires user to hold one of the specified roles.
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Usuário não autenticado.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Acesso negado. Ação restrita aos papéis [${allowedRoles.join(', ')}]. Seu papel atual é '${req.user.role}'.`,
        allowedRoles,
        userRole: req.user.role,
      });
      return;
    }

    next();
  };
}

/**
 * Express Middleware: Requires specific permission according to the RBAC matrix.
 */
export function requirePermission(permission: Permission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Usuário não autenticado.',
      });
      return;
    }

    const hasPerm = hasRolePermission(req.user.role, permission);
    if (!hasPerm) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Acesso negado. Ação requer a permissão '${permission}', mas o papel atual é '${req.user.role}'.`,
        requiredPermission: permission,
        userRole: req.user.role,
      });
      return;
    }

    next();
  };
}

/**
 * Express Middleware: Enforces that content creator cannot approve their own content.
 */
export function requireNotAuthor(getAuthorId: (req: AuthenticatedRequest) => string | undefined) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const authorId = getAuthorId(req);
    if (authorId && req.user.id === authorId) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Violação de Governança: O criador do conteúdo não pode aprovar ou rejeitar a própria peça.',
      });
      return;
    }

    next();
  };
}

/**
 * Checks if a user is an authorized member of a specific campaign.
 */
export async function checkUserCampaignMembership(
  userId: string,
  campaignId: string
): Promise<{ isMember: boolean; role?: UserRole; isCreator?: boolean; error?: string }> {
  const client = getServerSupabaseAdminClient();
  if (client) {
    try {
      // 1. Check if user is the campaign creator
      const { data: campaign, error: campErr } = await client
        .from('campaigns')
        .select('id, created_by')
        .eq('id', campaignId)
        .maybeSingle();

      if (!campErr && campaign) {
        if (campaign.created_by === userId) {
          return { isMember: true, isCreator: true };
        }

        // 2. Check campaign_members table
        const { data: member, error: memErr } = await client
          .from('campaign_members')
          .select('role')
          .eq('campaign_id', campaignId)
          .eq('user_id', userId)
          .maybeSingle();

        if (!memErr && member) {
          return { isMember: true, role: member.role as UserRole };
        }
      }
    } catch {
      // Fall through to memory store check
    }
  }

  // Memory Store Fallback
  const memCamp = memoryCampaignStore.getCampaign(campaignId);
  if (memCamp) {
    if (memCamp.created_by === userId) {
      return { isMember: true, isCreator: true };
    }
    const memMembers = memoryCampaignStore.getMembers(campaignId);
    const m = memMembers.find((item) => item.user_id === userId);
    if (m) {
      return { isMember: true, role: m.role as UserRole };
    }
  }

  return { isMember: false };
}

/**
 * Express Middleware: Requires Campaign Membership.
 * 
 * Authorization Flow:
 * User -> Role -> Campaign Membership -> Permission -> Resource
 * 
 * Rules:
 * - Administrator has global oversight ('campaign.view' / 'audit.view').
 * - Non-Administrators MUST be assigned members of the campaign.
 * - If requiredPermission is provided, verifies that the user's role grants it.
 */
export function requireCampaignMembership(options?: { requirePermission?: Permission }) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Usuário não autenticado.' });
      return;
    }

    const campaignId =
      req.params.campaignId ||
      req.body.campaignId ||
      (req.query.campaignId as string);

    if (!campaignId) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'Identificador da campanha (campaignId) é obrigatório.',
      });
      return;
    }

    // Administrators have global oversight
    if (req.user.role === 'Administrator') {
      if (options?.requirePermission && !hasRolePermission(req.user.role, options.requirePermission)) {
        res.status(403).json({
          error: 'Forbidden',
          message: `Ação requer a permissão '${options.requirePermission}'.`,
        });
        return;
      }
      next();
      return;
    }

    // Verify campaign membership in database
    const membership = await checkUserCampaignMembership(req.user.id, campaignId);

    if (!membership.isMember) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Acesso negado. Você não é membro autorizado desta campanha.',
        campaignId,
        userId: req.user.id,
      });
      return;
    }

    // Check permission if specified
    if (options?.requirePermission && !hasRolePermission(req.user.role, options.requirePermission)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Acesso negado. Ação requer permissão '${options.requirePermission}'.`,
        requiredPermission: options.requirePermission,
        userRole: req.user.role,
      });
      return;
    }

    req.campaignMemberRole = membership.role || req.user.role;
    next();
  };
}

/**
 * Assigns a role to a user.
 * 
 * SECURITY RULES:
 * - Requester must be an Administrator.
 * - Self-promotion / self-modification is strictly forbidden (cannot change own role).
 */
export async function assignUserRole(
  adminUser: UserIdentity,
  targetUserId: string,
  newRole: UserRole
): Promise<{ success: boolean; error?: string }> {
  if (adminUser.role !== 'Administrator') {
    return { success: false, error: 'Apenas Administradores podem gerenciar papéis de usuários.' };
  }

  if (adminUser.id === targetUserId) {
    return {
      success: false,
      error: 'Violação de Segurança: Não é permitido alterar o próprio papel (Prevenção contra autoescalonamento).',
    };
  }

  const client = getServerSupabaseAdminClient();
  if (!client) {
    return { success: false, error: 'Banco de dados não disponível.' };
  }

  try {
    const { error } = await client
      .from('user_roles')
      .upsert({
        user_id: targetUserId,
        role: newRole,
        assigned_by: adminUser.id,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Erro ao atribuir papel.' };
  }
}

/**
 * Adds a member to a campaign.
 * 
 * SECURITY RULES:
 * - Only an Administrator or the creator of the campaign can add members.
 * - Normal users cannot add themselves to arbitrary campaigns.
 */
export async function addCampaignMember(
  requester: UserIdentity,
  campaignId: string,
  targetUserId: string,
  memberRole: UserRole
): Promise<{ success: boolean; error?: string }> {
  const client = getServerSupabaseAdminClient();
  if (!client) {
    return { success: false, error: 'Banco de dados indisponível.' };
  }

  try {
    // 1. Verify authority
    if (requester.role !== 'Administrator') {
      const { data: campaign, error: cErr } = await client
        .from('campaigns')
        .select('created_by')
        .eq('id', campaignId)
        .maybeSingle();

      if (cErr || !campaign) {
        return { success: false, error: 'Campanha não encontrada.' };
      }

      if (campaign.created_by !== requester.id) {
        return {
          success: false,
          error: 'Apenas Administradores ou o Criador da campanha podem gerenciar seus membros.',
        };
      }
    }

    // 2. Insert member record
    const { error: insErr } = await client
      .from('campaign_members')
      .upsert(
        {
          campaign_id: campaignId,
          user_id: targetUserId,
          role: memberRole,
        },
        { onConflict: 'campaign_id,user_id' }
      );

    if (insErr) {
      return { success: false, error: insErr.message };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Erro ao adicionar membro.' };
  }
}

/**
 * Removes a member from a campaign.
 * 
 * SECURITY RULES:
 * - Only an Administrator or the creator of the campaign can remove members.
 * - Cannot remove the campaign creator from their own campaign.
 */
export async function removeCampaignMember(
  requester: UserIdentity,
  campaignId: string,
  targetUserId: string
): Promise<{ success: boolean; error?: string }> {
  const client = getServerSupabaseAdminClient();
  if (!client) {
    return { success: false, error: 'Banco de dados indisponível.' };
  }

  try {
    // 1. Fetch campaign to verify authority and creator
    const { data: campaign, error: cErr } = await client
      .from('campaigns')
      .select('created_by')
      .eq('id', campaignId)
      .maybeSingle();

    if (cErr || !campaign) {
      return { success: false, error: 'Campanha não encontrada.' };
    }

    if (requester.role !== 'Administrator' && campaign.created_by !== requester.id) {
      return {
        success: false,
        error: 'Apenas Administradores ou o Criador da campanha podem gerenciar seus membros.',
      };
    }

    // Do not allow removing the creator
    if (targetUserId === campaign.created_by) {
      return {
        success: false,
        error: 'Não é permitido remover o criador da campanha da equipe.',
      };
    }

    const { error: delErr } = await client
      .from('campaign_members')
      .delete()
      .eq('campaign_id', campaignId)
      .eq('user_id', targetUserId);

    if (delErr) {
      return { success: false, error: delErr.message };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Erro ao remover membro.' };
  }
}

