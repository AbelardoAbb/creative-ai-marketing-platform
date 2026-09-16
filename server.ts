/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  getSupabaseServerStatus,
  getServerSupabaseAdminClient,
  requireAuth,
  requireRole,
  requirePermission,
  requireNotAuthor,
  requireCampaignMembership,
  checkUserCampaignMembership,
  assignUserRole,
  addCampaignMember,
  removeCampaignMember,
  AuthenticatedRequest,
} from './server/auth';
import { ROLE_PERMISSIONS, UserRole, hasRolePermission } from './src/types/auth';
import {
  CampaignModel,
  CampaignStatus,
  isValidStatusTransition,
  buildCampaignAIContextContract,
  CreateCampaignPayload,
  UpdateCampaignPayload,
} from './src/types/campaign';
import { memoryCampaignStore } from './server/campaignStore';
import {
  imageGenerationService,
  ImageGenerationOptions,
} from './server/imageProvider';
import { evaluateInputModeration } from './server/moderation';
import {
  extractCleanCampaignImageContext,
  constructGenerationPrompt,
} from './server/promptBuilder';
import { uploadGeneratedAssetToStorage } from './server/storage';
import { imageAssetStore } from './server/imageAssetStore';
import {
  ImageAssetModel,
  ImageGenerationRequestPayload,
  HumanEvaluationPayload,
  SupportedImageStyle,
  SupportedAspectRatio,
  ASPECT_RATIO_DIMENSIONS,
} from './src/types/imageAsset';
import {
  ContentModel,
  ContentVersionModel,
  ContentOperation,
  ContentChannel,
  ContentStatus,
  ContentGenerationRequestPayload,
} from './src/types/content';
import { buildStructuredCampaignContext } from './server/contextBuilder';
import { claudeService } from './server/claudeService';
import { contentStore } from './server/contentStore';
import { moderationEngine } from './server/moderationEngine';
import { moderationStore } from './server/moderationStore';
import {
  ModerationStatus,
  ModerationRiskLevel,
  ModerationDecision,
} from './src/types/moderation';
import { costEngine } from './server/costEngine';
import { aiAuditStore } from './server/aiAuditStore';
import {
  CalculationStatus,
  CostSummaryMetrics,
  PricingModelConfig,
  ROIFrameworkMetrics,
} from './src/types/cost';
import {
  AIAuditEvent,
  AIOperationalMetrics,
  ProductivityMetrics,
} from './src/types/aiAudit';

// Load environment variables from .env
dotenv.config();

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // -------------------------------------------------------------
  // API ROUTES (Always before Vite middleware)
  // -------------------------------------------------------------

  // 1. Supabase Status Check (Never exposes sensitive keys)
  app.get('/api/auth/status', (req, res) => {
    const status = getSupabaseServerStatus();
    res.json(status);
  });

  // 2. Authenticated User Identity & Permissions
  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const permissions = ROLE_PERMISSIONS[user.role] || [];
    res.json({
      user,
      permissions,
      serverTimestamp: new Date().toISOString(),
    });
  });

  // 3. Server-side Permission Verification
  app.post('/api/auth/verify-permission', requireAuth, (req: AuthenticatedRequest, res) => {
    const { permission } = req.body;
    if (!permission) {
      res.status(400).json({ error: 'Parâmetro "permission" é obrigatório.' });
      return;
    }

    const user = req.user!;
    const permissions = ROLE_PERMISSIONS[user.role] || [];
    const granted = permissions.includes(permission);

    res.json({
      userId: user.id,
      role: user.role,
      permission,
      granted,
      reason: granted
        ? `Permissão '${permission}' concedida para o papel '${user.role}'.`
        : `Permissão '${permission}' negada para o papel '${user.role}'.`,
    });
  });

  // -------------------------------------------------------------
  // PHASE 6: CAMPAIGN MANAGEMENT & CREATIVE WORKSPACE ROUTES
  // -------------------------------------------------------------

  // 4. List Campaigns Accessible to the Authenticated User (with search, status & client filtering)
  app.get('/api/campaigns', requireAuth, requirePermission('campaign.view'), async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const { search, status, client: clientFilter } = req.query;
    const client = getServerSupabaseAdminClient();

    try {
      let campaignsList: CampaignModel[] = [];

      if (client) {
        if (user.role === 'Administrator') {
          let query = client.from('campaigns').select('*');
          if (status && typeof status === 'string' && status !== 'all') {
            query = query.eq('status', status);
          }
          if (clientFilter && typeof clientFilter === 'string' && clientFilter !== 'all') {
            query = query.ilike('client', `%${clientFilter}%`);
          }
          if (search && typeof search === 'string') {
            query = query.or(`name.ilike.%${search}%,campaign_objective.ilike.%${search}%,client.ilike.%${search}%`);
          }
          const { data, error } = await query.order('created_at', { ascending: false });

          if (!error && data) {
            campaignsList = data as CampaignModel[];
          }
        } else {
          // Regular members: access only campaigns they are members of OR created
          const { data: memberEntries } = await client
            .from('campaign_members')
            .select('campaign_id')
            .eq('user_id', user.id);

          const campaignIds = (memberEntries || []).map((m) => m.campaign_id);

          let query = client.from('campaigns').select('*');
          if (campaignIds.length > 0) {
            query = query.or(`created_by.eq.${user.id},id.in.(${campaignIds.join(',')})`);
          } else {
            query = query.eq('created_by', user.id);
          }

          if (status && typeof status === 'string' && status !== 'all') {
            query = query.eq('status', status);
          }
          if (clientFilter && typeof clientFilter === 'string' && clientFilter !== 'all') {
            query = query.ilike('client', `%${clientFilter}%`);
          }
          if (search && typeof search === 'string') {
            query = query.or(`name.ilike.%${search}%,campaign_objective.ilike.%${search}%,client.ilike.%${search}%`);
          }

          const { data: campaigns, error: cErr } = await query.order('created_at', { ascending: false });
          if (!cErr && campaigns) {
            campaignsList = campaigns as CampaignModel[];
          }
        }
      }

      // Memory Store Fallback / Sync if DB table has not been provisioned yet
      if (campaignsList.length === 0) {
        let memCampaigns = memoryCampaignStore.listCampaigns();

        // Role-based visibility in memory store
        if (user.role !== 'Administrator') {
          memCampaigns = memCampaigns.filter(
            (c) => c.created_by === user.id || memoryCampaignStore.isMember(c.id, user.id)
          );
        }

        // Apply filters
        if (status && typeof status === 'string' && status !== 'all') {
          memCampaigns = memCampaigns.filter((c) => c.status === status);
        }
        if (clientFilter && typeof clientFilter === 'string' && clientFilter !== 'all') {
          memCampaigns = memCampaigns.filter((c) => c.client.toLowerCase().includes((clientFilter as string).toLowerCase()));
        }
        if (search && typeof search === 'string') {
          const s = (search as string).toLowerCase();
          memCampaigns = memCampaigns.filter(
            (c) =>
              c.name.toLowerCase().includes(s) ||
              (c.client && c.client.toLowerCase().includes(s)) ||
              (c.campaign_objective && c.campaign_objective.toLowerCase().includes(s))
          );
        }

        campaignsList = memCampaigns;
      }

      res.json({
        campaigns: campaignsList,
        total: campaignsList.length,
        scope: user.role === 'Administrator' ? 'global_administrator' : 'member_restricted',
      });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao listar campanhas.' });
    }
  });

  // 5. Create Campaign (Requires campaign.create: Designer or Administrator)
  // Enforces server-side validation, clean sanitize, and creator auto-membership
  app.post('/api/campaigns', requireAuth, requirePermission('campaign.create'), async (req: AuthenticatedRequest, res) => {
    const {
      name,
      client: clientName,
      description,
      product_or_service,
      campaign_objective,
      target_audience,
      key_message,
      tone_of_voice,
      language,
      channels,
      visual_direction,
      creative_constraints,
    } = req.body;

    // Strict Server-Side Validation: Name and Objective are mandatory
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Nome da campanha é obrigatório.' });
      return;
    }

    if (!campaign_objective || typeof campaign_objective !== 'string' || !campaign_objective.trim()) {
      res.status(400).json({ error: 'Objetivo da campanha (campaign_objective) é obrigatório.' });
      return;
    }

    const payload: CreateCampaignPayload = {
      name: name.trim(),
      client: (clientName && typeof clientName === 'string' && clientName.trim()) || 'Geral',
      description: description ? String(description).trim() : undefined,
      product_or_service: product_or_service ? String(product_or_service).trim() : undefined,
      campaign_objective: campaign_objective.trim(),
      target_audience: target_audience ? String(target_audience).trim() : undefined,
      key_message: key_message ? String(key_message).trim() : undefined,
      tone_of_voice: tone_of_voice ? String(tone_of_voice).trim() : 'Profissional e Persuasivo',
      language: (language && typeof language === 'string' && language.trim()) || 'pt-BR',
      channels: Array.isArray(channels) && channels.length > 0 ? channels : ['Instagram', 'LinkedIn'],
      visual_direction: visual_direction ? String(visual_direction).trim() : undefined,
      creative_constraints: creative_constraints ? String(creative_constraints).trim() : undefined,
    };

    const client = getServerSupabaseAdminClient();

    try {
      let createdCampaign: CampaignModel | null = null;

      if (client) {
        const { data, error: cErr } = await client
          .from('campaigns')
          .insert({
            name: payload.name,
            client: payload.client,
            description: payload.description || null,
            product_or_service: payload.product_or_service || null,
            campaign_objective: payload.campaign_objective,
            target_audience: payload.target_audience || null,
            key_message: payload.key_message || null,
            tone_of_voice: payload.tone_of_voice || null,
            language: payload.language,
            channels: payload.channels,
            visual_direction: payload.visual_direction || null,
            creative_constraints: payload.creative_constraints || null,
            status: 'draft',
            created_by: req.user!.id,
          })
          .select()
          .single();

        if (!cErr && data) {
          createdCampaign = data as CampaignModel;
          // Automatically add creator as member in database
          await client.from('campaign_members').insert({
            campaign_id: createdCampaign.id,
            user_id: req.user!.id,
            role: req.user!.role,
          });
        }
      }

      // Memory store fallback & sync
      if (!createdCampaign) {
        createdCampaign = memoryCampaignStore.createCampaign(
          payload,
          req.user!.id,
          req.user!.role,
          req.user!.email,
          req.user!.displayName
        );
      }

      res.status(201).json({
        success: true,
        campaign: createdCampaign,
        message: 'Campanha criada com sucesso e membro criador associado.',
      });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao criar campanha.' });
    }
  });

  // 6. Access Campaign Details & Team (Enforces Campaign Membership)
  // Non-members CANNOT access campaigns they are not assigned to!
  app.get(
    '/api/campaigns/:campaignId',
    requireAuth,
    requireCampaignMembership({ requirePermission: 'campaign.view' }),
    async (req: AuthenticatedRequest, res) => {
      const { campaignId } = req.params;
      const client = getServerSupabaseAdminClient();

      try {
        let campaign: CampaignModel | null = null;
        let members: Array<{ id: string; user_id: string; role: UserRole; created_at: string; user_email?: string; user_display_name?: string }> = [];

        if (client) {
          const { data, error } = await client
            .from('campaigns')
            .select('*')
            .eq('id', campaignId)
            .maybeSingle();

          if (!error && data) {
            campaign = data as CampaignModel;
            const { data: memberRows } = await client
              .from('campaign_members')
              .select('id, user_id, role, created_at')
              .eq('campaign_id', campaignId);
            members = memberRows || [];
          }
        }

        // Memory Store Fallback
        if (!campaign) {
          campaign = memoryCampaignStore.getCampaign(campaignId);
          if (campaign) {
            members = memoryCampaignStore.getMembers(campaignId);
          }
        }

        if (!campaign) {
          res.status(404).json({ error: 'Campanha não encontrada.' });
          return;
        }

        // Include structured AI Context Contract ready for Phase 7+ consumption
        const aiContextContract = buildCampaignAIContextContract(campaign);

        res.json({
          campaign,
          members,
          aiContextContract,
          accessGranted: true,
          requesterRole: req.user!.role,
          campaignMemberRole: req.campaignMemberRole,
        });
      } catch (err: unknown) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao carregar campanha.' });
      }
    }
  );

  // 7. Update Campaign / Briefing (Requires campaign.edit + Campaign Membership)
  app.put(
    '/api/campaigns/:campaignId',
    requireAuth,
    requireCampaignMembership({ requirePermission: 'campaign.edit' }),
    async (req: AuthenticatedRequest, res) => {
      const { campaignId } = req.params;
      const updates = req.body as UpdateCampaignPayload;
      const client = getServerSupabaseAdminClient();

      // If status transition requested, validate transition matrix
      if (updates.status) {
        let currentStatus: CampaignStatus = 'draft';
        if (client) {
          const { data } = await client.from('campaigns').select('status').eq('id', campaignId).maybeSingle();
          if (data?.status) currentStatus = data.status;
        }
        if (!currentStatus) {
          const mem = memoryCampaignStore.getCampaign(campaignId);
          if (mem) currentStatus = mem.status;
        }

        if (!isValidStatusTransition(currentStatus, updates.status)) {
          res.status(400).json({
            error: `Transição de status inválida: não é permitido alterar de '${currentStatus}' para '${updates.status}'.`,
          });
          return;
        }
      }

      try {
        let updatedCampaign: CampaignModel | null = null;

        if (client) {
          const { data, error } = await client
            .from('campaigns')
            .update({
              ...(updates.name ? { name: updates.name.trim() } : {}),
              ...(updates.client ? { client: updates.client.trim() } : {}),
              ...(updates.description !== undefined ? { description: updates.description?.trim() || null } : {}),
              ...(updates.product_or_service !== undefined ? { product_or_service: updates.product_or_service?.trim() || null } : {}),
              ...(updates.campaign_objective ? { campaign_objective: updates.campaign_objective.trim() } : {}),
              ...(updates.target_audience !== undefined ? { target_audience: updates.target_audience?.trim() || null } : {}),
              ...(updates.key_message !== undefined ? { key_message: updates.key_message?.trim() || null } : {}),
              ...(updates.tone_of_voice !== undefined ? { tone_of_voice: updates.tone_of_voice?.trim() || null } : {}),
              ...(updates.language ? { language: updates.language.trim() } : {}),
              ...(updates.channels ? { channels: updates.channels } : {}),
              ...(updates.visual_direction !== undefined ? { visual_direction: updates.visual_direction?.trim() || null } : {}),
              ...(updates.creative_constraints !== undefined ? { creative_constraints: updates.creative_constraints?.trim() || null } : {}),
              ...(updates.status ? { status: updates.status } : {}),
              updated_at: new Date().toISOString(),
            })
            .eq('id', campaignId)
            .select()
            .maybeSingle();

          if (!error && data) {
            updatedCampaign = data as CampaignModel;
          }
        }

        // Memory Store Fallback / Sync
        const memUpdated = memoryCampaignStore.updateCampaign(campaignId, updates);
        if (!updatedCampaign) {
          updatedCampaign = memUpdated;
        }

        if (!updatedCampaign) {
          res.status(404).json({ error: 'Campanha não encontrada.' });
          return;
        }

        res.json({
          success: true,
          campaign: updatedCampaign,
          aiContextContract: buildCampaignAIContextContract(updatedCampaign),
          message: 'Campanha e briefing atualizados com sucesso.',
        });
      } catch (err: unknown) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao atualizar campanha.' });
      }
    }
  );

  // 8. Add Campaign Member (Restricted to Administrator or Campaign Creator)
  app.post('/api/campaigns/:campaignId/members', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { campaignId } = req.params;
    const { targetUserId, memberRole, userEmail, userDisplayName } = req.body;

    if (!targetUserId || !memberRole) {
      res.status(400).json({ error: 'targetUserId e memberRole são obrigatórios.' });
      return;
    }

    if (!['Designer', 'Copywriter', 'Approver', 'Administrator'].includes(memberRole)) {
      res.status(400).json({ error: 'Papel de membro inválido.' });
      return;
    }

    // Verify authority: Admin or Creator
    const client = getServerSupabaseAdminClient();
    let isCreator = false;
    if (client) {
      const { data } = await client.from('campaigns').select('created_by').eq('id', campaignId).maybeSingle();
      if (data?.created_by === req.user!.id) isCreator = true;
    }
    const memCampaign = memoryCampaignStore.getCampaign(campaignId);
    if (memCampaign && memCampaign.created_by === req.user!.id) {
      isCreator = true;
    }

    if (req.user!.role !== 'Administrator' && !isCreator) {
      res.status(403).json({ error: 'Apenas Administradores ou o Criador da campanha podem adicionar membros.' });
      return;
    }

    // Add to DB if available
    await addCampaignMember(req.user!, campaignId, targetUserId, memberRole as UserRole);

    // Sync in memory store
    const member = memoryCampaignStore.addMember(
      campaignId,
      targetUserId,
      memberRole as UserRole,
      userEmail,
      userDisplayName
    );

    res.status(201).json({
      success: true,
      member,
      message: `Membro adicionado com sucesso com o papel '${memberRole}'.`,
    });
  });

  // 9. Remove Campaign Member (Restricted to Administrator or Campaign Creator)
  app.delete('/api/campaigns/:campaignId/members/:targetUserId', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { campaignId, targetUserId } = req.params;

    // Verify authority
    const client = getServerSupabaseAdminClient();
    let campaignCreator: string | null = null;
    if (client) {
      const { data } = await client.from('campaigns').select('created_by').eq('id', campaignId).maybeSingle();
      if (data) campaignCreator = data.created_by;
    }
    const memCamp = memoryCampaignStore.getCampaign(campaignId);
    if (memCamp && !campaignCreator) {
      campaignCreator = memCamp.created_by;
    }

    if (req.user!.role !== 'Administrator' && campaignCreator !== req.user!.id) {
      res.status(403).json({ error: 'Apenas Administradores ou o Criador da campanha podem remover membros.' });
      return;
    }

    if (targetUserId === campaignCreator) {
      res.status(400).json({ error: 'Não é permitido remover o criador da campanha da equipe.' });
      return;
    }

    await removeCampaignMember(req.user!, campaignId, targetUserId);
    memoryCampaignStore.removeMember(campaignId, targetUserId);

    res.json({
      success: true,
      message: 'Membro removido da equipe com sucesso.',
    });
  });

  // 10. Direct AI Context Export endpoint (Prepared for future Claude & Image Gen consumption)
  app.get(
    '/api/campaigns/:campaignId/ai-context',
    requireAuth,
    requireCampaignMembership({ requirePermission: 'campaign.view' }),
    async (req: AuthenticatedRequest, res) => {
      const { campaignId } = req.params;
      let campaign: CampaignModel | null = null;
      const client = getServerSupabaseAdminClient();

      if (client) {
        const { data } = await client.from('campaigns').select('*').eq('id', campaignId).maybeSingle();
        if (data) campaign = data as CampaignModel;
      }
      if (!campaign) {
        campaign = memoryCampaignStore.getCampaign(campaignId);
      }

      if (!campaign) {
        res.status(404).json({ error: 'Campanha não encontrada.' });
        return;
      }

      const contract = buildCampaignAIContextContract(campaign);
      res.json({
        success: true,
        contract,
        readyForAI: true,
        timestamp: new Date().toISOString(),
      });
    }
  );

  // -------------------------------------------------------------
  // PHASE 5: ADMINISTRATION SECURITY & ROLE ASSIGNMENT
  // -------------------------------------------------------------

  // 11. Assign Role (Requires roles.manage: Administrator only)
  app.post(
    '/api/admin/roles/assign',
    requireAuth,
    requirePermission('roles.manage'),
    async (req: AuthenticatedRequest, res) => {
      const { targetUserId, newRole } = req.body;

      if (!targetUserId || !newRole) {
        res.status(400).json({ error: 'targetUserId e newRole são obrigatórios.' });
        return;
      }

      if (!['Designer', 'Copywriter', 'Approver', 'Administrator'].includes(newRole)) {
        res.status(400).json({ error: 'Papel fornecido é inválido.' });
        return;
      }

      const result = await assignUserRole(req.user!, targetUserId, newRole as UserRole);

      if (!result.success) {
        res.status(403).json({ error: result.error });
        return;
      }

      res.json({
        success: true,
        targetUserId,
        assignedRole: newRole,
        assignedBy: req.user!.email,
        message: `Papel '${newRole}' atribuído ao usuário com sucesso.`,
      });
    }
  );

  // 12. Governance & Audit View (Requires governance.view: Administrator only)
  app.get(
    '/api/governance/view',
    requireAuth,
    requirePermission('governance.view'),
    (req: AuthenticatedRequest, res) => {
      res.json({
        authorized: true,
        admin: req.user!.email,
        scope: 'governance.overview',
        governanceRules: [
          'Anti-Self-Approval: O criador do conteúdo não pode aprovar a própria peça.',
          'Anti-Self-Promotion: Usuários não podem se autoatribuir Administrador ou Aprovador.',
          'Campaign Scoping: Apenas membros de uma campanha podem acessar seus recursos.',
          'Administrator Separation: Administrador não possui aprovação editorial inerente.',
        ],
      });
    }
  );

  // 13. Approver Decision Route (Requires approval.decide + Anti-Self-Approval check)
  app.post(
    '/api/approvals/decision',
    requireAuth,
    requirePermission('approval.decide'),
    requireNotAuthor((req) => req.body.contentAuthorId),
    (req: AuthenticatedRequest, res) => {
      const { contentId, decision, comments } = req.body;
      res.json({
        success: true,
        contentId,
        decision,
        reviewerId: req.user!.id,
        reviewerRole: req.user!.role,
        comments,
        message: 'Decisão de aprovação processada com sucesso no backend.',
      });
    }
  );

  // -------------------------------------------------------------
  // PHASE 7: REAL IMAGE GENERATION (STABILITY AI) & ASSET GALLERY
  // -------------------------------------------------------------

  // 14. Stability AI & Image Provider Status (Safe check, never exposes STABILITY_API_KEY)
  app.get('/api/assets/provider-status', requireAuth, (req: AuthenticatedRequest, res) => {
    const isConfigured = imageGenerationService.isStabilityConfigured();
    res.json({
      provider: 'stability_ai',
      supportedModel: 'stable-image-core',
      status: isConfigured ? 'READY' : 'BLOCKED',
      message: isConfigured
        ? 'Stability AI API está configurada e disponível para inferência visual.'
        : 'STABILITY_API_KEY não configurada no servidor. O serviço de geração está no estado BLOCKED.',
      fallbackAvailable: true,
      allowedStyles: [
        'Photorealistic',
        'Editorial',
        'Advertising',
        'Anime',
        'Oil Painting',
        'Cinematic',
        'Minimalist',
      ],
      allowedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:2'],
    });
  });

  // 15. List Image Assets (Filtered by campaign and role authorization)
  app.get(
    '/api/assets',
    requireAuth,
    requirePermission('asset.view'),
    async (req: AuthenticatedRequest, res) => {
      const user = req.user!;
      const { campaignId, status } = req.query;
      const client = getServerSupabaseAdminClient();

      try {
        let assets: ImageAssetModel[] = [];

        // Check if user has access to specified campaign
        if (campaignId && typeof campaignId === 'string') {
          if (user.role !== 'Administrator') {
            const isMem =
              memoryCampaignStore.isMember(campaignId, user.id) ||
              memoryCampaignStore.getCampaign(campaignId)?.created_by === user.id;

            if (!isMem && client) {
              const { data: memberEntry } = await client
                .from('campaign_members')
                .select('id')
                .eq('campaign_id', campaignId)
                .eq('user_id', user.id)
                .maybeSingle();

              const { data: campaignEntry } = await client
                .from('campaigns')
                .select('created_by')
                .eq('id', campaignId)
                .maybeSingle();

              if (!memberEntry && campaignEntry?.created_by !== user.id) {
                res.status(403).json({
                  error: 'Forbidden',
                  message: 'Acesso negado aos assets desta campanha.',
                });
                return;
              }
            }
          }

          // Fetch from Supabase if table exists
          if (client) {
            let query = client.from('image_assets').select('*').eq('campaign_id', campaignId);
            if (status && typeof status === 'string' && status !== 'all') {
              query = query.eq('status', status);
            }
            const { data, error } = await query.order('created_at', { ascending: false });
            if (!error && data && data.length > 0) {
              assets = data as ImageAssetModel[];
            }
          }

          // Merge / Fallback with in-memory imageAssetStore
          if (assets.length === 0) {
            assets = imageAssetStore.listAssetsByCampaign(campaignId);
            if (status && typeof status === 'string' && status !== 'all') {
              assets = assets.filter((a) => a.status === status);
            }
          }
        } else {
          // List across all accessible campaigns
          if (client) {
            let query = client.from('image_assets').select('*');
            if (status && typeof status === 'string' && status !== 'all') {
              query = query.eq('status', status);
            }
            const { data, error } = await query.order('created_at', { ascending: false });
            if (!error && data && data.length > 0) {
              assets = data as ImageAssetModel[];
            }
          }

          if (assets.length === 0) {
            assets = imageAssetStore.listAllAssets();
            if (status && typeof status === 'string' && status !== 'all') {
              assets = assets.filter((a) => a.status === status);
            }
          }

          // Filter by user campaign access if not Administrator
          if (user.role !== 'Administrator') {
            assets = assets.filter((a) => {
              if (a.created_by === user.id) return true;
              return memoryCampaignStore.isMember(a.campaign_id, user.id);
            });
          }
        }

        res.json({
          assets,
          total: assets.length,
        });
      } catch (err: unknown) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Erro ao listar assets.',
        });
      }
    }
  );

  // 16. Real Image Generation Endpoint (Requires asset.generate + Campaign Membership)
  app.post(
    '/api/assets/generate',
    requireAuth,
    requirePermission('asset.generate'),
    requireCampaignMembership(),
    async (req: AuthenticatedRequest, res) => {
      const user = req.user!;
      const {
        campaignId,
        userPrompt,
        negativePrompt: userNegativePrompt,
        style = 'Advertising',
        aspectRatio = '1:1',
        additionalInstructions,
        parentAssetId,
        allowFallback = false,
      } = req.body as ImageGenerationRequestPayload & { allowFallback?: boolean };

      // 1. Validate mandatory input parameters
      if (!campaignId || typeof campaignId !== 'string') {
        res.status(400).json({
          error: 'BadRequest',
          statusCode: 'VALIDATION_ERROR',
          message: 'Identificador da campanha (campaignId) é obrigatório.',
        });
        return;
      }

      if (!userPrompt || typeof userPrompt !== 'string' || !userPrompt.trim()) {
        res.status(400).json({
          error: 'BadRequest',
          statusCode: 'VALIDATION_ERROR',
          message: 'O conceito visual / prompt é obrigatório para iniciar a geração.',
        });
        return;
      }

      // 2. Fetch Campaign Context for prompt enrichment
      const client = getServerSupabaseAdminClient();
      let campaign: CampaignModel | null = null;

      if (client) {
        const { data } = await client.from('campaigns').select('*').eq('id', campaignId).maybeSingle();
        if (data) campaign = data as CampaignModel;
      }

      if (!campaign) {
        campaign = memoryCampaignStore.getCampaign(campaignId);
      }

      if (!campaign) {
        res.status(404).json({
          error: 'NotFound',
          message: 'Campanha vinculada não foi encontrada para contextualização.',
        });
        return;
      }

      // 3. INPUT MODERATION CHECKPOINT
      const moderation = evaluateInputModeration(
        userPrompt,
        additionalInstructions,
        userNegativePrompt
      );

      if (moderation.risk === 'HIGH_RISK') {
        // High Risk is BLOCKED immediately before calling external providers
        imageAssetStore.logGenerationEvent({
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          campaign_id: campaignId,
          user_id: user.id,
          provider: 'stability_ai',
          model: 'stable-image-core',
          generation_status: 'BLOCKED',
          moderation_status: 'HIGH_RISK',
          estimated_cost: '0.000 USD',
          error_message: moderation.reason,
          timestamp: new Date().toISOString(),
        });

        // Record centralized AI Audit event (Phase 10B)
        aiAuditStore.recordEvent({
          campaign_id: campaignId,
          campaign_name: campaign.name,
          user_id: user.id,
          user_name: user.displayName,
          user_role: user.role,
          provider: 'stability_ai',
          model: 'stable-image-core',
          operation: parentAssetId ? 'image_variation' : 'image_generate',
          status: 'BLOCKED',
          moderation_status: 'HIGH_RISK',
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: 0,
          input_tokens: null,
          output_tokens: null,
          total_tokens: null,
          token_status: 'TOKEN_USAGE_UNKNOWN',
          estimated_cost: null,
          currency: 'USD',
          cost_status: 'COST_UNKNOWN',
          error_code: 'MODERATION_BLOCKED',
          error_message: moderation.reason,
          metadata: { style, aspectRatio },
        });

        res.status(422).json({
          error: 'ModerationBlocked',
          statusCode: 'MODERATION_BLOCKED',
          message:
            moderation.reason ||
            'Requisição bloqueada pelo filtro de moderação de segurança por conter termos proibidos ou sensíveis.',
          moderation,
        });
        return;
      }

      // 4. Check Stability AI API Key Credential Status
      const isStabilityConfigured = imageGenerationService.isStabilityConfigured();
      if (!isStabilityConfigured && !allowFallback) {
        aiAuditStore.recordEvent({
          campaign_id: campaignId,
          campaign_name: campaign.name,
          user_id: user.id,
          user_name: user.displayName,
          user_role: user.role,
          provider: 'stability_ai',
          model: 'stable-image-core',
          operation: parentAssetId ? 'image_variation' : 'image_generate',
          status: 'BLOCKED',
          moderation_status: 'LOW_RISK',
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: 0,
          input_tokens: null,
          output_tokens: null,
          total_tokens: null,
          token_status: 'TOKEN_USAGE_UNKNOWN',
          estimated_cost: null,
          currency: 'USD',
          cost_status: 'COST_UNKNOWN',
          error_code: 'PROVIDER_BLOCKED',
          error_message: 'STABILITY_API_KEY não configurada no servidor.',
          metadata: { style, aspectRatio },
        });

        res.status(503).json({
          error: 'ProviderBlocked',
          statusCode: 'BLOCKED',
          message:
            'STABILITY_API_KEY não configurada no servidor. Não é permitida a simulação de geração falsa quando o provedor real não estiver configurado.',
        });
        return;
      }

      // 5. Context Construction & Prompt Synthesis
      const cleanContext = extractCleanCampaignImageContext(
        campaign,
        style as SupportedImageStyle,
        aspectRatio as SupportedAspectRatio,
        additionalInstructions
      );

      const synthesized = constructGenerationPrompt(cleanContext, userPrompt);
      const effectiveNegativePrompt = userNegativePrompt
        ? `${userNegativePrompt}, ${synthesized.negativePrompt}`
        : synthesized.negativePrompt;

      // 6. Call Image Generation Provider
      const genOptions: ImageGenerationOptions = {
        prompt: synthesized.prompt,
        negativePrompt: effectiveNegativePrompt,
        aspectRatio: (aspectRatio as SupportedAspectRatio) || '1:1',
        style: (style as SupportedImageStyle) || 'Advertising',
      };

      const result = await imageGenerationService.generateImage(genOptions, allowFallback);

      // Handle Provider Errors
      if (!result.success || !result.imageBuffer) {
        imageAssetStore.logGenerationEvent({
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          campaign_id: campaignId,
          user_id: user.id,
          provider: result.provider,
          model: result.model,
          generation_status: 'ERROR',
          moderation_status: moderation.risk,
          generation_duration_ms: result.durationMs,
          estimated_cost: result.estimatedCost,
          error_message: result.error,
          timestamp: new Date().toISOString(),
        });

        // Record centralized AI Audit event (Phase 10B)
        aiAuditStore.recordEvent({
          campaign_id: campaignId,
          campaign_name: campaign.name,
          user_id: user.id,
          user_name: user.displayName,
          user_role: user.role,
          provider: result.provider,
          model: result.model,
          operation: parentAssetId ? 'image_variation' : 'image_generate',
          status: result.isBlocked ? 'BLOCKED' : 'FAILED',
          moderation_status: moderation.risk,
          started_at: new Date(Date.now() - result.durationMs).toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: result.durationMs,
          input_tokens: null,
          output_tokens: null,
          total_tokens: null,
          token_status: 'TOKEN_USAGE_UNKNOWN',
          estimated_cost: null,
          currency: 'USD',
          cost_status: 'COST_UNKNOWN',
          error_code: result.isBlocked ? 'PROVIDER_BLOCKED' : 'PROVIDER_ERROR',
          error_message: result.error,
          metadata: { style, aspectRatio, dimensions: result.dimensions },
        });

        res.status(result.statusCode === 429 ? 429 : 502).json({
          error: 'ProviderError',
          statusCode: 'ERROR',
          message: result.error || 'Falha ao processar inferência visual com o provedor de imagem.',
          provider: result.provider,
          model: result.model,
        });
        return;
      }

      // 7. Store generated image buffer in Supabase Storage
      const assetId = `asset-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const storageUpload = await uploadGeneratedAssetToStorage(
        campaignId,
        assetId,
        result.imageBuffer,
        result.mimeType
      );

      // 8. Output Moderation Checkpoint
      // Sets initial state to READY_FOR_REVIEW if LOW_RISK, or MODERATION_REVIEW if MEDIUM_RISK
      const initialAssetStatus =
        moderation.risk === 'MEDIUM_RISK' ? 'MODERATION_REVIEW' : 'READY_FOR_REVIEW';

      // 9. Persist Image Asset Entity
      const newAsset: ImageAssetModel = {
        id: assetId,
        campaign_id: campaignId,
        created_by: user.id,
        provider: result.provider,
        model: result.model,
        prompt: synthesized.prompt,
        negative_prompt: effectiveNegativePrompt,
        style: (style as SupportedImageStyle) || 'Advertising',
        aspect_ratio: (aspectRatio as SupportedAspectRatio) || '1:1',
        status: initialAssetStatus,
        moderation_status: moderation.risk,
        moderation_notes: moderation.reason,
        storage_path: storageUpload.storagePath,
        public_url: storageUpload.publicUrl,
        dimensions: result.dimensions,
        generation_duration_ms: result.durationMs,
        estimated_cost: result.estimatedCost,
        parent_asset_id: parentAssetId || undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        creator_display_name: user.displayName,
        creator_role: user.role,
      };

      // Persist to Supabase image_assets if available
      if (client) {
        await client.from('image_assets').insert({
          id: newAsset.id,
          campaign_id: newAsset.campaign_id,
          created_by: newAsset.created_by,
          provider: newAsset.provider,
          model: newAsset.model,
          prompt: newAsset.prompt,
          negative_prompt: newAsset.negative_prompt || null,
          style: newAsset.style,
          aspect_ratio: newAsset.aspect_ratio,
          status: newAsset.status,
          moderation_status: newAsset.moderation_status,
          moderation_notes: newAsset.moderation_notes || null,
          storage_path: newAsset.storage_path,
          public_url: newAsset.public_url,
          width: newAsset.dimensions.width,
          height: newAsset.dimensions.height,
          generation_duration_ms: newAsset.generation_duration_ms,
          estimated_cost: newAsset.estimated_cost,
          parent_asset_id: newAsset.parent_asset_id || null,
        });
      }

      // Always save to synchronized imageAssetStore
      imageAssetStore.saveAsset(newAsset);

      // Record successful generation event in audit logs
      imageAssetStore.logGenerationEvent({
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        asset_id: newAsset.id,
        campaign_id: campaignId,
        user_id: user.id,
        provider: result.provider,
        model: result.model,
        generation_status: 'SUCCESS',
        moderation_status: moderation.risk,
        generation_duration_ms: result.durationMs,
        estimated_cost: result.estimatedCost,
        timestamp: new Date().toISOString(),
      });

      // Record centralized AI Audit event (Phase 10B)
      const isRealStability = result.provider === 'stability_ai' && imageGenerationService.isStabilityConfigured();
      aiAuditStore.recordEvent({
        asset_id: newAsset.id,
        campaign_id: campaignId,
        campaign_name: campaign.name,
        user_id: user.id,
        user_name: user.displayName,
        user_role: user.role,
        provider: result.provider,
        model: result.model,
        operation: parentAssetId ? 'image_variation' : 'image_generate',
        status: 'SUCCESS',
        moderation_status: moderation.risk,
        started_at: new Date(Date.now() - result.durationMs).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: result.durationMs,
        input_tokens: null,
        output_tokens: null,
        total_tokens: null,
        token_status: 'TOKEN_USAGE_UNKNOWN',
        // Requirement 24: If not real Stability AI with live key: COST_UNKNOWN, null cost
        estimated_cost: isRealStability ? 0.03 : null,
        currency: 'USD',
        cost_status: isRealStability ? 'KNOWN' : 'COST_UNKNOWN',
        metadata: {
          dimensions: result.dimensions,
          style: newAsset.style,
          aspectRatio: newAsset.aspect_ratio,
          isFallback: result.provider === 'fallback_provider',
          hasLiveCredential: isRealStability,
        },
      });

      res.status(201).json({
        success: true,
        statusCode: 'GENERATED',
        asset: newAsset,
        moderation,
        generationInfo: {
          provider: result.provider,
          model: result.model,
          durationMs: result.durationMs,
          estimatedCost: result.estimatedCost,
          storagePath: storageUpload.storagePath,
        },
      });
    }
  );

  // 17. Human Evaluation & Rating Endpoint (1-5 stars + feedback)
  app.post(
    '/api/assets/:assetId/evaluate',
    requireAuth,
    requirePermission('asset.view'),
    async (req: AuthenticatedRequest, res) => {
      const { assetId } = req.params;
      const { rating, feedback } = req.body as HumanEvaluationPayload;

      if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
        res.status(400).json({
          error: 'BadRequest',
          message: 'A avaliação deve ser uma nota numérica inteira entre 1 e 5 estrelas.',
        });
        return;
      }

      const client = getServerSupabaseAdminClient();
      let updated = imageAssetStore.evaluateAsset(assetId, { rating, feedback });

      if (client) {
        const { data, error } = await client
          .from('image_assets')
          .update({
            rating: Math.round(rating),
            feedback: feedback ? feedback.trim() : null,
            status: 'READY_FOR_REVIEW',
            updated_at: new Date().toISOString(),
          })
          .eq('id', assetId)
          .select()
          .maybeSingle();

        if (!error && data) {
          updated = data as ImageAssetModel;
        }
      }

      if (!updated) {
        res.status(404).json({
          error: 'NotFound',
          message: 'Asset visual não encontrado para avaliação.',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Avaliação humana registrada com sucesso.',
        asset: updated,
      });
    }
  );

  // -------------------------------------------------------------
  // PHASE 8: REAL CLAUDE INTEGRATION & AI CONTENT WORKSPACE ROUTES
  // -------------------------------------------------------------

  // 18. Claude Provider Status (Safe check, never exposes ANTHROPIC_API_KEY)
  app.get('/api/claude/status', requireAuth, (req: AuthenticatedRequest, res) => {
    const isConfigured = claudeService.isConfigured();
    res.json({
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      status: isConfigured ? 'READY' : 'BLOCKED',
      configured: isConfigured,
      message: isConfigured
        ? 'Anthropic Claude API está configurada e disponível para processamento textual.'
        : 'ANTHROPIC_API_KEY não configurada no servidor. O serviço Claude está no estado BLOCKED.',
      supportedOperations: [
        'generate',
        'summarize',
        'expand',
        'correct',
        'rewrite',
        'variations',
        'adapt_channel',
      ],
      supportedChannels: ['Social Media', 'Advertisement', 'Email', 'Website', 'Blog Post', 'Print'],
    });
  });

  // 19. Process Content with Claude (Generate, Summarize, Expand, Correct, Rewrite, Variations, Adapt)
  app.post(
    '/api/content/process',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const user = req.user!;
      const hasPerm = hasRolePermission(user.role, 'content.create') || hasRolePermission(user.role, 'content.edit');
      if (!hasPerm) {
        res.status(403).json({
          error: 'Forbidden',
          statusCode: 'FORBIDDEN',
          message: `Acesso negado. Ação requer permissão 'content.create' ou 'content.edit'. Seu papel atual é '${user.role}'.`,
        });
        return;
      }

      const {
        campaignId,
        operation,
        channel = 'Social Media',
        sourceContent,
        instructions,
        targetAudience,
        tone,
        language,
        contentId,
      } = req.body;

      // 1. Validate mandatory fields
      if (!campaignId || typeof campaignId !== 'string') {
        res.status(400).json({
          error: 'BadRequest',
          statusCode: 'VALIDATION_ERROR',
          message: 'Identificador da campanha (campaignId) é obrigatório.',
        });
        return;
      }

      const validOps = ['generate', 'summarize', 'expand', 'correct', 'rewrite', 'variations', 'adapt_channel'];
      if (!operation || !validOps.includes(operation)) {
        res.status(400).json({
          error: 'BadRequest',
          statusCode: 'VALIDATION_ERROR',
          message: `Operação inválida. Operações suportadas: ${validOps.join(', ')}.`,
        });
        return;
      }

      // Size limits for prompt injection and abuse prevention
      if (instructions && instructions.length > 4000) {
        res.status(400).json({
          error: 'BadRequest',
          statusCode: 'VALIDATION_ERROR',
          message: 'Instruções adicionais excedem o limite de 4.000 caracteres.',
        });
        return;
      }

      if (sourceContent && sourceContent.length > 20000) {
        res.status(400).json({
          error: 'BadRequest',
          statusCode: 'VALIDATION_ERROR',
          message: 'Conteúdo de origem excede o limite de 20.000 caracteres.',
        });
        return;
      }

      // Non-generate operations require source content
      if (operation !== 'generate' && (!sourceContent || !sourceContent.trim())) {
        res.status(400).json({
          error: 'BadRequest',
          statusCode: 'VALIDATION_ERROR',
          message: `A operação '${operation}' requer um conteúdo base (sourceContent) para transformação.`,
        });
        return;
      }

      // 2. Validate Campaign Membership
      if (user.role !== 'Administrator') {
        const memCheck = await checkUserCampaignMembership(user.id, campaignId);
        if (!memCheck.isMember) {
          res.status(403).json({
            error: 'Forbidden',
            statusCode: 'FORBIDDEN',
            message: 'Acesso negado. Você não é membro autorizado desta campanha.',
          });
          return;
        }
      }

      // 3. Fetch Campaign Context
      const client = getServerSupabaseAdminClient();
      let campaign: CampaignModel | null = null;
      if (client) {
        const { data } = await client.from('campaigns').select('*').eq('id', campaignId).maybeSingle();
        if (data) campaign = data as CampaignModel;
      }
      if (!campaign) {
        campaign = memoryCampaignStore.getCampaign(campaignId);
      }
      if (!campaign) {
        res.status(404).json({
          error: 'NotFound',
          statusCode: 'NOT_FOUND',
          message: 'Campanha vinculada não encontrada para extração de contexto.',
        });
        return;
      }

      // 4. Build Structured Campaign Context
      const structuredContext = buildStructuredCampaignContext(
        campaign,
        operation as ContentOperation,
        channel as ContentChannel
      );

      // 4.5 Centralized Input Moderation Layer (Phase 10A)
      const inputModeration = moderationEngine.moderateInput({
        campaignId,
        userId: user.id,
        userName: user.displayName,
        userRole: user.role,
        resourceType: 'content',
        resourceId: contentId,
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        operation,
        textInputs: [sourceContent, instructions, targetAudience, tone],
        userPrompt: instructions,
        contextText: sourceContent,
      });

      const inputModEvent = moderationStore.createEvent({
        campaign_id: campaignId,
        user_id: user.id,
        user_name: user.displayName,
        user_role: user.role,
        resource_type: 'content',
        resource_id: contentId,
        stage: 'INPUT',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        operation,
        risk_level: inputModeration.riskLevel,
        decision: inputModeration.decision,
        categories: inputModeration.categories,
        reason: inputModeration.reason,
        evaluated_snippet: inputModeration.evaluatedSnippet,
      });

      if (inputModeration.riskLevel === 'HIGH_RISK') {
        contentStore.logAIGeneration({
          campaign_id: campaignId,
          content_id: contentId,
          user_id: user.id,
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          operation,
          status: 'BLOCKED',
          duration_ms: 0,
          tokens_input: 0,
          tokens_output: 0,
          estimated_cost: '0.000000 USD',
          error_message: inputModeration.reason,
        });

        // Record centralized AI Audit event (Phase 10B)
        aiAuditStore.recordEvent({
          campaign_id: campaignId,
          campaign_name: campaign.name,
          content_id: contentId || null,
          user_id: user.id,
          user_name: user.displayName,
          user_role: user.role,
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          operation,
          status: 'BLOCKED',
          moderation_status: 'HIGH_RISK',
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: 0,
          input_tokens: null,
          output_tokens: null,
          total_tokens: null,
          token_status: 'TOKEN_USAGE_UNKNOWN',
          estimated_cost: null,
          currency: 'USD',
          cost_status: 'COST_UNKNOWN',
          error_code: 'MODERATION_BLOCKED',
          error_message: inputModeration.reason,
        });

        res.status(422).json({
          error: 'ModerationBlocked',
          statusCode: 'MODERATION_BLOCKED',
          message:
            inputModeration.reason ||
            'Requisição bloqueada pelo filtro de moderação de segurança por conter termos proibidos ou sensíveis.',
          moderation: inputModeration,
          eventId: inputModEvent.id,
        });
        return;
      }

      if (inputModeration.riskLevel === 'MEDIUM_RISK') {
        contentStore.logAIGeneration({
          campaign_id: campaignId,
          content_id: contentId,
          user_id: user.id,
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          operation,
          status: 'BLOCKED',
          duration_ms: 0,
          tokens_input: 0,
          tokens_output: 0,
          estimated_cost: '0.000000 USD',
          error_message: inputModeration.reason,
        });

        // Record centralized AI Audit event (Phase 10B)
        aiAuditStore.recordEvent({
          campaign_id: campaignId,
          campaign_name: campaign.name,
          content_id: contentId || null,
          user_id: user.id,
          user_name: user.displayName,
          user_role: user.role,
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          operation,
          status: 'BLOCKED',
          moderation_status: 'REQUIRES_HUMAN_REVIEW',
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: 0,
          input_tokens: null,
          output_tokens: null,
          total_tokens: null,
          token_status: 'TOKEN_USAGE_UNKNOWN',
          estimated_cost: null,
          currency: 'USD',
          cost_status: 'COST_UNKNOWN',
          error_code: 'REQUIRES_HUMAN_REVIEW',
          error_message: inputModeration.reason,
        });

        res.status(422).json({
          error: 'ModerationReviewRequired',
          statusCode: 'REQUIRES_HUMAN_REVIEW',
          message:
            inputModeration.reason ||
            'Requisição retida para revisão humana de segurança antes do envio ao provedor de IA.',
          moderation: inputModeration,
          eventId: inputModEvent.id,
        });
        return;
      }

      // 5. Call Claude Service
      const result = await claudeService.processContent({
        operation,
        context: structuredContext,
        channel,
        sourceContent,
        userInstructions: instructions,
        targetAudienceOverride: targetAudience,
        toneOverride: tone,
        languageOverride: language,
      });

      // 6. Log AI Generation Event in legacy store for backwards compatibility
      const logEntry = contentStore.logAIGeneration({
        campaign_id: campaignId,
        content_id: contentId,
        user_id: user.id,
        provider: 'anthropic',
        model: result.model,
        operation,
        status: result.status,
        duration_ms: result.durationMs,
        tokens_input: result.tokensInput,
        tokens_output: result.tokensOutput,
        estimated_cost: result.estimatedCost,
        error_message: result.errorMessage,
      });

      // Record centralized AI Audit event (Phase 10B)
      const inTokens = typeof result.tokensInput === 'number' ? result.tokensInput : null;
      const outTokens = typeof result.tokensOutput === 'number' ? result.tokensOutput : null;
      const hasKnownTokens = inTokens !== null && outTokens !== null;
      const calculatedCost = hasKnownTokens ? Math.round(((inTokens * 0.003 + outTokens * 0.015) / 1000) * 1000000) / 1000000 : null;

      const auditStatus = result.status === 'BLOCKED' ? 'BLOCKED' : result.success ? 'SUCCESS' : 'FAILED';

      aiAuditStore.recordEvent({
        campaign_id: campaignId,
        campaign_name: campaign.name,
        content_id: contentId || null,
        user_id: user.id,
        user_name: user.displayName,
        user_role: user.role,
        provider: 'anthropic',
        model: result.model,
        operation,
        status: auditStatus,
        moderation_status: inputModeration.riskLevel,
        started_at: new Date(Date.now() - (result.durationMs || 0)).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: result.durationMs || null,
        input_tokens: inTokens,
        output_tokens: outTokens,
        total_tokens: hasKnownTokens ? inTokens + outTokens : null,
        token_status: hasKnownTokens ? 'KNOWN' : 'TOKEN_USAGE_UNKNOWN',
        estimated_cost: calculatedCost,
        currency: 'USD',
        cost_status: hasKnownTokens ? 'KNOWN' : 'COST_UNKNOWN',
        error_code: result.status,
        error_message: result.errorMessage,
      });

      // Also persist log to Supabase if table available
      if (client) {
        try {
          await client.from('ai_generation_logs').insert({
            id: logEntry.id,
            campaign_id: logEntry.campaign_id,
            content_id: logEntry.content_id || null,
            user_id: logEntry.user_id,
            provider: logEntry.provider,
            model: logEntry.model,
            operation: logEntry.operation,
            status: logEntry.status,
            duration_ms: logEntry.duration_ms,
            tokens_input: logEntry.tokens_input,
            tokens_output: logEntry.tokens_output,
            estimated_cost: logEntry.estimated_cost,
            error_message: logEntry.error_message || null,
            timestamp: logEntry.timestamp,
          });
        } catch {
          // Fall through to memory store log
        }
      }

      // 7. Handle Provider Failure States (BLOCKED, RATE_LIMITED, TIMEOUT, etc.)
      if (!result.success) {
        res.status(result.statusCode || 500).json({
          error: result.status === 'BLOCKED' ? 'ProviderBlocked' : 'ProviderError',
          statusCode: result.status,
          message: result.errorMessage || 'Falha ao processar conteúdo com o Anthropic Claude.',
          result,
          logId: logEntry.id,
        });
        return;
      }

      // 8. Output Moderation Checkpoint (Phase 10A)
      let outputModeration = undefined;
      let outputModEvent = undefined;

      if (result.generatedContent) {
        outputModeration = moderationEngine.moderateOutput({
          campaignId,
          userId: user.id,
          userName: user.displayName,
          userRole: user.role,
          resourceType: 'content',
          resourceId: contentId,
          provider: 'anthropic',
          model: result.model,
          operation,
          outputContent: result.generatedContent,
        });

        outputModEvent = moderationStore.createEvent({
          campaign_id: campaignId,
          user_id: user.id,
          user_name: user.displayName,
          user_role: user.role,
          resource_type: 'content',
          resource_id: contentId,
          stage: 'OUTPUT',
          provider: 'anthropic',
          model: result.model,
          operation,
          risk_level: outputModeration.riskLevel,
          decision: outputModeration.decision,
          categories: outputModeration.categories,
          reason: outputModeration.reason,
          evaluated_snippet: outputModeration.evaluatedSnippet,
        });

        if (outputModeration.riskLevel === 'HIGH_RISK') {
          // Record output moderation block in central audit log
          aiAuditStore.recordEvent({
            campaign_id: campaignId,
            campaign_name: campaign.name,
            content_id: contentId || null,
            user_id: user.id,
            user_name: user.displayName,
            user_role: user.role,
            provider: 'anthropic',
            model: result.model,
            operation,
            status: 'BLOCKED',
            moderation_status: 'HIGH_RISK',
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            duration_ms: 0,
            input_tokens: inTokens,
            output_tokens: outTokens,
            total_tokens: hasKnownTokens ? inTokens + outTokens : null,
            token_status: hasKnownTokens ? 'KNOWN' : 'TOKEN_USAGE_UNKNOWN',
            estimated_cost: calculatedCost,
            currency: 'USD',
            cost_status: hasKnownTokens ? 'KNOWN' : 'COST_UNKNOWN',
            error_code: 'OUTPUT_MODERATION_BLOCKED',
            error_message: outputModeration.reason,
          });

          res.status(422).json({
            error: 'OutputModerationBlocked',
            statusCode: 'MODERATION_BLOCKED',
            message:
              'O texto gerado pelo modelo foi bloqueado pelo filtro de moderação de saída por violação de diretrizes de segurança.',
            moderation: outputModeration,
            eventId: outputModEvent.id,
          });
          return;
        }
      }

      res.json({
        success: true,
        result,
        logId: logEntry.id,
        moderation: outputModeration || inputModeration,
        moderationEventId: outputModEvent?.id || inputModEvent.id,
      });
    }
  );

  // 20. List Campaign Contents
  app.get(
    '/api/campaigns/:campaignId/contents',
    requireAuth,
    requirePermission('content.view'),
    async (req: AuthenticatedRequest, res) => {
      const user = req.user!;
      const { campaignId } = req.params;

      if (user.role !== 'Administrator') {
        const mem = await checkUserCampaignMembership(user.id, campaignId);
        if (!mem.isMember) {
          res.status(403).json({ error: 'Forbidden', message: 'Acesso negado aos conteúdos desta campanha.' });
          return;
        }
      }

      const client = getServerSupabaseAdminClient();
      let contentsList: ContentModel[] = [];

      if (client) {
        try {
          const { data, error } = await client
            .from('contents')
            .select('*')
            .eq('campaign_id', campaignId)
            .order('updated_at', { ascending: false });

          if (!error && data && data.length > 0) {
            // Fetch versions for each content
            const contentIds = data.map((c) => c.id);
            const { data: verData } = await client
              .from('content_versions')
              .select('*')
              .in('content_id', contentIds)
              .order('version_number', { ascending: true });

            const versionsByContent = new Map<string, ContentVersionModel[]>();
            (verData || []).forEach((v) => {
              const list = versionsByContent.get(v.content_id) || [];
              list.push(v as ContentVersionModel);
              versionsByContent.set(v.content_id, list);
            });

            contentsList = data.map((c) => ({
              ...c,
              versions: versionsByContent.get(c.id) || [],
            })) as ContentModel[];
          }
        } catch {
          // Fallback to memory store
        }
      }

      if (contentsList.length === 0) {
        contentsList = contentStore.listCampaignContents(campaignId);
      }

      res.json({
        contents: contentsList,
        total: contentsList.length,
      });
    }
  );

  // 21. Create Content Item (Creates initial record and Version 1)
  app.post(
    '/api/campaigns/:campaignId/contents',
    requireAuth,
    requirePermission('content.create'),
    async (req: AuthenticatedRequest, res) => {
      const user = req.user!;
      const { campaignId } = req.params;
      const { title, channel = 'Social Media', content = '', provider, model, operation } = req.body;

      if (user.role !== 'Administrator') {
        const mem = await checkUserCampaignMembership(user.id, campaignId);
        if (!mem.isMember) {
          res.status(403).json({ error: 'Forbidden', message: 'Acesso negado para criar conteúdo nesta campanha.' });
          return;
        }
      }

      const newContent = contentStore.createContent({
        campaign_id: campaignId,
        title: title || 'Conteúdo Sem Título',
        channel,
        content,
        created_by: user.id,
        created_by_name: user.displayName,
        created_by_role: user.role,
        provider,
        model,
        operation,
      });

      // Persist to Supabase if available
      const client = getServerSupabaseAdminClient();
      if (client) {
        try {
          await client.from('contents').insert({
          id: newContent.id,
          campaign_id: newContent.campaign_id,
          title: newContent.title,
          channel: newContent.channel,
          status: newContent.status,
          current_version: newContent.current_version,
          content: newContent.content,
          created_by: newContent.created_by,
          created_by_name: newContent.created_by_name,
          created_by_role: newContent.created_by_role,
          created_at: newContent.created_at,
          updated_at: newContent.updated_at,
        });

        if (newContent.versions && newContent.versions.length > 0) {
          const v = newContent.versions[0];
          await client.from('content_versions').insert({
            id: v.id,
            content_id: v.content_id,
            version_number: v.version_number,
            author_id: v.author_id,
            author_name: v.author_name,
            author_role: v.author_role,
            provider: v.provider || null,
            model: v.model || null,
            operation: v.operation || null,
            content: v.content,
            notes: v.notes || null,
            created_at: v.created_at,
          });
        }
      } catch {
        // Fall back to memory store content
      }
    }

      res.status(201).json({
        success: true,
        content: newContent,
        message: 'Conteúdo e versão inicial criados com sucesso.',
      });
    }
  );

  // 22. Get Single Content with Full Version History
  app.get(
    '/api/contents/:contentId',
    requireAuth,
    requirePermission('content.view'),
    async (req: AuthenticatedRequest, res) => {
      const user = req.user!;
      const { contentId } = req.params;

      const content = contentStore.getContent(contentId);
      if (!content) {
        res.status(404).json({ error: 'NotFound', message: 'Conteúdo não encontrado.' });
        return;
      }

      if (user.role !== 'Administrator') {
        const mem = await checkUserCampaignMembership(user.id, content.campaign_id);
        if (!mem.isMember) {
          res.status(403).json({ error: 'Forbidden', message: 'Acesso negado aos dados deste conteúdo.' });
          return;
        }
      }

      res.json({ content });
    }
  );

  // 23. Save New Content Version (Human edit or accepted AI transformation - Never destroys history)
  app.post(
    '/api/contents/:contentId/versions',
    requireAuth,
    requirePermission('content.edit'),
    async (req: AuthenticatedRequest, res) => {
      const user = req.user!;
      const { contentId } = req.params;
      const { content, provider, model, operation, notes, status } = req.body;

      if (!content || typeof content !== 'string') {
        res.status(400).json({ error: 'BadRequest', message: 'O texto do conteúdo é obrigatório.' });
        return;
      }

      const existing = contentStore.getContent(contentId);
      if (!existing) {
        res.status(404).json({ error: 'NotFound', message: 'Conteúdo não encontrado.' });
        return;
      }

      if (user.role !== 'Administrator') {
        const mem = await checkUserCampaignMembership(user.id, existing.campaign_id);
        if (!mem.isMember) {
          res.status(403).json({ error: 'Forbidden', message: 'Acesso negado para editar este conteúdo.' });
          return;
        }
      }

      const result = contentStore.saveNewVersion(contentId, {
        author_id: user.id,
        author_name: user.displayName,
        author_role: user.role,
        content,
        provider,
        model,
        operation,
        notes,
        status,
      });

      if (!result) {
        res.status(500).json({ error: 'SaveFailed', message: 'Falha ao salvar nova versão do conteúdo.' });
        return;
      }

      // Persist to Supabase if available
      const client = getServerSupabaseAdminClient();
      if (client) {
        try {
          await client.from('contents').update({
            content: result.content.content,
            current_version: result.content.current_version,
            status: result.content.status,
            updated_at: result.content.updated_at,
          }).eq('id', contentId);

          await client.from('content_versions').insert({
            id: result.version.id,
            content_id: result.version.content_id,
            version_number: result.version.version_number,
            source_version: result.version.source_version || null,
            author_id: result.version.author_id,
            author_name: result.version.author_name,
            author_role: result.version.author_role,
            provider: result.version.provider || null,
            model: result.version.model || null,
            operation: result.version.operation || null,
            content: result.version.content,
            notes: result.version.notes || null,
            created_at: result.version.created_at,
          });
        } catch {
          // Fall back to memory store
        }
      }

      res.status(201).json({
        success: true,
        content: result.content,
        version: result.version,
        message: `Nova versão #${result.version.version_number} registrada com sucesso.`,
      });
    }
  );

  // 24. Restore Earlier Version
  app.post(
    '/api/contents/:contentId/restore',
    requireAuth,
    requirePermission('content.edit'),
    async (req: AuthenticatedRequest, res) => {
      const user = req.user!;
      const { contentId } = req.params;
      const { targetVersionNumber } = req.body;

      if (!targetVersionNumber || typeof targetVersionNumber !== 'number') {
        res.status(400).json({ error: 'BadRequest', message: 'Número da versão alvo (targetVersionNumber) é obrigatório.' });
        return;
      }

      const existing = contentStore.getContent(contentId);
      if (!existing) {
        res.status(404).json({ error: 'NotFound', message: 'Conteúdo não encontrado.' });
        return;
      }

      if (user.role !== 'Administrator') {
        const mem = await checkUserCampaignMembership(user.id, existing.campaign_id);
        if (!mem.isMember) {
          res.status(403).json({ error: 'Forbidden', message: 'Acesso negado para restaurar versão deste conteúdo.' });
          return;
        }
      }

      const updated = contentStore.restoreVersion(contentId, targetVersionNumber, {
        id: user.id,
        name: user.displayName,
        role: user.role,
      });

      if (!updated) {
        res.status(404).json({ error: 'VersionNotFound', message: `Versão #${targetVersionNumber} não encontrada no histórico.` });
        return;
      }

      res.json({
        success: true,
        content: updated,
        message: `Versão #${targetVersionNumber} restaurada com sucesso criando a nova versão #${updated.current_version}.`,
      });
    }
  );

  // 25. Evaluate Content (Human Rating & Feedback)
  app.post(
    '/api/contents/:contentId/evaluate',
    requireAuth,
    requirePermission('content.view'),
    async (req: AuthenticatedRequest, res) => {
      const user = req.user!;
      const { contentId } = req.params;
      const { rating, feedback } = req.body;

      if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        res.status(400).json({ error: 'BadRequest', message: 'A avaliação deve ser uma nota de 1 a 5 estrelas.' });
        return;
      }

      const existing = contentStore.getContent(contentId);
      if (!existing) {
        res.status(404).json({ error: 'NotFound', message: 'Conteúdo não encontrado.' });
        return;
      }

      if (user.role !== 'Administrator') {
        const mem = await checkUserCampaignMembership(user.id, existing.campaign_id);
        if (!mem.isMember) {
          res.status(403).json({ error: 'Forbidden', message: 'Acesso negado.' });
          return;
        }
      }

      const updated = contentStore.evaluateContent(contentId, rating, feedback);
      res.json({
        success: true,
        content: updated,
        message: 'Avaliação humana registrada com sucesso.',
      });
    }
  );

  // 26. Submit for Review (Transitions status to READY_FOR_REVIEW)
  const handleSubmitReview = async (req: AuthenticatedRequest, res: express.Response) => {
    const user = req.user!;
    const { contentId } = req.params;

    const existing = contentStore.getContent(contentId);
    if (!existing) {
      res.status(404).json({ error: 'NotFound', message: 'Conteúdo não encontrado.' });
      return;
    }

    if (user.role !== 'Administrator') {
      const mem = await checkUserCampaignMembership(user.id, existing.campaign_id);
      if (!mem.isMember) {
        res.status(403).json({ error: 'Forbidden', message: 'Acesso negado para submeter conteúdo desta campanha.' });
        return;
      }
    }

    // Permission check: Must have content.edit or content.create
    if (
      !hasRolePermission(user.role, 'content.edit') &&
      !hasRolePermission(user.role, 'content.create') &&
      user.role !== 'Administrator'
    ) {
      res.status(403).json({ error: 'Forbidden', message: 'Permissão insuficiente para submeter conteúdo para revisão.' });
      return;
    }

    const result = contentStore.submitForReview(contentId, {
      id: user.id,
      name: user.displayName,
      role: user.role,
    });

    if (!result.success) {
      res.status(400).json({ error: 'BadRequest', message: result.error });
      return;
    }

    // Persist to Supabase if configured
    const client = getServerSupabaseAdminClient();
    if (client && result.content && result.event) {
      try {
        await client
          .from('contents')
          .update({
            status: result.content.status,
            submitted_at: result.content.submitted_at,
            updated_at: result.content.updated_at,
          })
          .eq('id', contentId);

        await client.from('content_review_events').insert({
          id: result.event.id,
          campaign_id: result.event.campaign_id,
          content_id: result.event.content_id,
          version_number: result.event.version_number,
          action: result.event.action,
          actor_id: result.event.actor_id,
          actor_name: result.event.actor_name,
          actor_role: result.event.actor_role,
          previous_status: result.event.previous_status,
          new_status: result.event.new_status,
          notes: result.event.notes || null,
          timestamp: result.event.timestamp,
        });
      } catch {
        // Continue with memory store state
      }
    }

    res.json({
      success: true,
      content: result.content,
      event: result.event,
      message: 'Conteúdo enviado com sucesso para revisão e governança de aprovação.',
    });
  };

  app.post('/api/contents/:contentId/submit-review', requireAuth, handleSubmitReview);
  app.post('/api/content/:contentId/submit-review', requireAuth, handleSubmitReview);

  // 27. Start Review (Transitions READY_FOR_REVIEW -> UNDER_REVIEW)
  const handleStartReview = async (req: AuthenticatedRequest, res: express.Response) => {
    const user = req.user!;
    const { contentId } = req.params;

    // Approver permission check: Administrator does NOT automatically have approval.review
    if (!hasRolePermission(user.role, 'approval.review') && !hasRolePermission(user.role, 'approval.decide')) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Usuários com o papel '${user.role}' não possuem permissão para revisar conteúdos.`,
      });
      return;
    }

    const existing = contentStore.getContent(contentId);
    if (!existing) {
      res.status(404).json({ error: 'NotFound', message: 'Conteúdo não encontrado.' });
      return;
    }

    // Campaign membership check
    const mem = await checkUserCampaignMembership(user.id, existing.campaign_id);
    if (!mem.isMember && user.role !== 'Administrator') {
      res.status(403).json({ error: 'Forbidden', message: 'Acesso negado: Revisor não faz parte desta campanha.' });
      return;
    }

    const result = contentStore.startReview(contentId, {
      id: user.id,
      name: user.displayName,
      role: user.role,
    });

    if (!result.success) {
      res.status(400).json({ error: 'BadRequest', message: result.error });
      return;
    }

    // Persist to Supabase if configured
    const client = getServerSupabaseAdminClient();
    if (client && result.content && result.event) {
      try {
        await client
          .from('contents')
          .update({
            status: result.content.status,
            updated_at: result.content.updated_at,
          })
          .eq('id', contentId);

        await client.from('content_review_events').insert({
          id: result.event.id,
          campaign_id: result.event.campaign_id,
          content_id: result.event.content_id,
          version_number: result.event.version_number,
          action: result.event.action,
          actor_id: result.event.actor_id,
          actor_name: result.event.actor_name,
          actor_role: result.event.actor_role,
          previous_status: result.event.previous_status,
          new_status: result.event.new_status,
          notes: result.event.notes || null,
          timestamp: result.event.timestamp,
        });
      } catch {
        // Fall back to memory store
      }
    }

    res.json({
      success: true,
      content: result.content,
      event: result.event,
      message: 'Revisão iniciada com sucesso.',
    });
  };

  app.post('/api/contents/:contentId/start-review', requireAuth, handleStartReview);
  app.post('/api/content/:contentId/start-review', requireAuth, handleStartReview);

  // 28. Approve Content
  const handleApproveContent = async (req: AuthenticatedRequest, res: express.Response) => {
    const user = req.user!;
    const { contentId } = req.params;
    const { comment } = req.body;

    // Approval permission check: Administrator does NOT automatically have approval.decide
    if (!hasRolePermission(user.role, 'approval.decide')) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Usuários com o papel '${user.role}' não possuem permissão para aprovar conteúdos.`,
      });
      return;
    }

    const existing = contentStore.getContent(contentId);
    if (!existing) {
      res.status(404).json({ error: 'NotFound', message: 'Conteúdo não encontrado.' });
      return;
    }

    // Campaign membership check
    const mem = await checkUserCampaignMembership(user.id, existing.campaign_id);
    if (!mem.isMember && user.role !== 'Administrator') {
      res.status(403).json({ error: 'Forbidden', message: 'Acesso negado: Revisor não faz parte desta campanha.' });
      return;
    }

    // CRITICAL ANTI-SELF-APPROVAL RULE: Creator can NEVER approve own content!
    if (existing.created_by === user.id) {
      res.status(403).json({
        error: 'GovernanceViolation',
        decision: 'DENIED',
        message: 'Violação de Governança: O criador do conteúdo não pode aprovar a própria peça.',
      });
      return;
    }

    const result = contentStore.approveContent(
      contentId,
      {
        id: user.id,
        name: user.displayName,
        role: user.role,
      },
      comment
    );

    if (!result.success) {
      res.status(400).json({ error: 'BadRequest', message: result.error });
      return;
    }

    // Persist to Supabase if configured
    const client = getServerSupabaseAdminClient();
    if (client && result.content && result.record && result.event) {
      try {
        await client
          .from('contents')
          .update({
            status: result.content.status,
            reviewed_by: result.content.reviewed_by,
            reviewed_by_name: result.content.reviewed_by_name,
            reviewed_at: result.content.reviewed_at,
            updated_at: result.content.updated_at,
          })
          .eq('id', contentId);

        await client.from('content_approval_records').insert({
          id: result.record.id,
          campaign_id: result.record.campaign_id,
          content_id: result.record.content_id,
          version_number: result.record.version_number,
          decision: result.record.decision,
          reviewer_id: result.record.reviewer_id,
          reviewer_name: result.record.reviewer_name,
          reviewer_role: result.record.reviewer_role,
          reason: result.record.reason || null,
          created_at: result.record.created_at,
        });

        await client.from('content_review_events').insert({
          id: result.event.id,
          campaign_id: result.event.campaign_id,
          content_id: result.event.content_id,
          version_number: result.event.version_number,
          action: result.event.action,
          actor_id: result.event.actor_id,
          actor_name: result.event.actor_name,
          actor_role: result.event.actor_role,
          previous_status: result.event.previous_status,
          new_status: result.event.new_status,
          notes: result.event.notes || null,
          timestamp: result.event.timestamp,
        });
      } catch {
        // Fall back to memory store
      }
    }

    res.json({
      success: true,
      content: result.content,
      record: result.record,
      event: result.event,
      message: `Conteúdo versão #${result.content?.current_version} aprovado com sucesso.`,
    });
  };

  app.post('/api/contents/:contentId/approve', requireAuth, handleApproveContent);
  app.post('/api/content/:contentId/approve', requireAuth, handleApproveContent);

  // 29. Reject Content (Requires meaningful justification)
  const handleRejectContent = async (req: AuthenticatedRequest, res: express.Response) => {
    const user = req.user!;
    const { contentId } = req.params;
    const { reason } = req.body;

    // Reviewer permission check
    if (!hasRolePermission(user.role, 'approval.decide') && !hasRolePermission(user.role, 'approval.review')) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Usuários com o papel '${user.role}' não possuem permissão para avaliar conteúdos.`,
      });
      return;
    }

    // Meaningful justification check: empty or whitespace-only is strictly forbidden
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'A justificativa de rejeição é obrigatória e não pode ser vazia.',
      });
      return;
    }

    const existing = contentStore.getContent(contentId);
    if (!existing) {
      res.status(404).json({ error: 'NotFound', message: 'Conteúdo não encontrado.' });
      return;
    }

    // Campaign membership check
    const mem = await checkUserCampaignMembership(user.id, existing.campaign_id);
    if (!mem.isMember && user.role !== 'Administrator') {
      res.status(403).json({ error: 'Forbidden', message: 'Acesso negado: Revisor não faz parte desta campanha.' });
      return;
    }

    const result = contentStore.rejectContent(
      contentId,
      {
        id: user.id,
        name: user.displayName,
        role: user.role,
      },
      reason.trim()
    );

    if (!result.success) {
      res.status(400).json({ error: 'BadRequest', message: result.error });
      return;
    }

    // Persist to Supabase if configured
    const client = getServerSupabaseAdminClient();
    if (client && result.content && result.record && result.event) {
      try {
        await client
          .from('contents')
          .update({
            status: result.content.status,
            rejection_reason: result.content.rejection_reason,
            reviewed_by: result.content.reviewed_by,
            reviewed_by_name: result.content.reviewed_by_name,
            reviewed_at: result.content.reviewed_at,
            updated_at: result.content.updated_at,
          })
          .eq('id', contentId);

        await client.from('content_approval_records').insert({
          id: result.record.id,
          campaign_id: result.record.campaign_id,
          content_id: result.record.content_id,
          version_number: result.record.version_number,
          decision: result.record.decision,
          reviewer_id: result.record.reviewer_id,
          reviewer_name: result.record.reviewer_name,
          reviewer_role: result.record.reviewer_role,
          reason: result.record.reason,
          created_at: result.record.created_at,
        });

        await client.from('content_review_events').insert({
          id: result.event.id,
          campaign_id: result.event.campaign_id,
          content_id: result.event.content_id,
          version_number: result.event.version_number,
          action: result.event.action,
          actor_id: result.event.actor_id,
          actor_name: result.event.actor_name,
          actor_role: result.event.actor_role,
          previous_status: result.event.previous_status,
          new_status: result.event.new_status,
          notes: result.event.notes || null,
          timestamp: result.event.timestamp,
        });
      } catch {
        // Fall back to memory store
      }
    }

    res.json({
      success: true,
      content: result.content,
      record: result.record,
      event: result.event,
      message: 'Conteúdo rejeitado com solicitação de revisão.',
    });
  };

  app.post('/api/contents/:contentId/reject', requireAuth, handleRejectContent);
  app.post('/api/content/:contentId/reject', requireAuth, handleRejectContent);

  // 30. Revise Rejected Content (Creates Version N+1, preserves rejected version)
  const handleReviseContent = async (req: AuthenticatedRequest, res: express.Response) => {
    const user = req.user!;
    const { contentId } = req.params;
    const { content, notes } = req.body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ error: 'BadRequest', message: 'O texto da revisão é obrigatório.' });
      return;
    }

    const existing = contentStore.getContent(contentId);
    if (!existing) {
      res.status(404).json({ error: 'NotFound', message: 'Conteúdo não encontrado.' });
      return;
    }

    const mem = await checkUserCampaignMembership(user.id, existing.campaign_id);
    if (!mem.isMember && user.role !== 'Administrator') {
      res.status(403).json({ error: 'Forbidden', message: 'Acesso negado para editar este conteúdo.' });
      return;
    }

    const result = contentStore.reviseRejectedContent(
      contentId,
      {
        id: user.id,
        name: user.displayName,
        role: user.role,
      },
      content.trim(),
      notes
    );

    if (!result.success) {
      res.status(400).json({ error: 'BadRequest', message: result.error });
      return;
    }

    res.json({
      success: true,
      content: result.content,
      version: result.version,
      message: `Nova versão #${result.version?.version_number} criada para revisão a partir da versão rejeitada.`,
    });
  };

  app.post('/api/contents/:contentId/revise', requireAuth, handleReviseContent);
  app.post('/api/content/:contentId/revise', requireAuth, handleReviseContent);

  // 31. Collaboration Comments (List & Add)
  const handleGetComments = async (req: AuthenticatedRequest, res: express.Response) => {
    const user = req.user!;
    const { contentId } = req.params;

    const existing = contentStore.getContent(contentId);
    if (!existing) {
      res.status(404).json({ error: 'NotFound', message: 'Conteúdo não encontrado.' });
      return;
    }

    // Campaign isolation check: Users outside the campaign cannot read comments
    const mem = await checkUserCampaignMembership(user.id, existing.campaign_id);
    if (!mem.isMember && user.role !== 'Administrator') {
      res.status(403).json({ error: 'Forbidden', message: 'Acesso negado aos comentários deste conteúdo.' });
      return;
    }

    const comments = contentStore.getComments(contentId);
    res.json({ comments, total: comments.length });
  };

  app.get('/api/contents/:contentId/comments', requireAuth, handleGetComments);
  app.get('/api/content/:contentId/comments', requireAuth, handleGetComments);

  const handleAddComment = async (req: AuthenticatedRequest, res: express.Response) => {
    const user = req.user!;
    const { contentId } = req.params;
    const { text, version_number } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'BadRequest', message: 'O texto do comentário é obrigatório.' });
      return;
    }

    const existing = contentStore.getContent(contentId);
    if (!existing) {
      res.status(404).json({ error: 'NotFound', message: 'Conteúdo não encontrado.' });
      return;
    }

    // Campaign isolation check: Users outside the campaign cannot add comments
    const mem = await checkUserCampaignMembership(user.id, existing.campaign_id);
    if (!mem.isMember && user.role !== 'Administrator') {
      res.status(403).json({ error: 'Forbidden', message: 'Acesso negado para comentar neste conteúdo.' });
      return;
    }

    // Server-side identity enforcement: user_id, author_name, author_role NEVER trusted from client
    const result = contentStore.addComment(contentId, {
      campaign_id: existing.campaign_id,
      version_number: version_number || existing.current_version,
      author_id: user.id,
      author_name: user.displayName,
      author_role: user.role,
      text: text.trim(),
    });

    if (!result.success) {
      res.status(400).json({ error: 'BadRequest', message: result.error });
      return;
    }

    // Persist to Supabase if configured
    const client = getServerSupabaseAdminClient();
    if (client && result.comment) {
      try {
        await client.from('content_comments').insert({
          id: result.comment.id,
          campaign_id: result.comment.campaign_id,
          content_id: result.comment.content_id,
          version_number: result.comment.version_number,
          author_id: result.comment.author_id,
          author_name: result.comment.author_name,
          author_role: result.comment.author_role,
          text: result.comment.text,
          created_at: result.comment.created_at,
        });
      } catch {
        // Fall back to memory store
      }
    }

    res.status(201).json({
      success: true,
      comment: result.comment,
      message: 'Comentário registrado com sucesso.',
    });
  };

  app.post('/api/contents/:contentId/comments', requireAuth, handleAddComment);
  app.post('/api/content/:contentId/comments', requireAuth, handleAddComment);

  // 32. Review History & Audit Timeline
  const handleGetReviewEvents = async (req: AuthenticatedRequest, res: express.Response) => {
    const user = req.user!;
    const { contentId } = req.params;

    const existing = contentStore.getContent(contentId);
    if (!existing) {
      res.status(404).json({ error: 'NotFound', message: 'Conteúdo não encontrado.' });
      return;
    }

    const mem = await checkUserCampaignMembership(user.id, existing.campaign_id);
    if (!mem.isMember && user.role !== 'Administrator') {
      res.status(403).json({ error: 'Forbidden', message: 'Acesso negado ao histórico deste conteúdo.' });
      return;
    }

    const events = contentStore.getReviewEvents(contentId);
    res.json({ events, total: events.length });
  };

  app.get('/api/contents/:contentId/review-events', requireAuth, handleGetReviewEvents);
  app.get('/api/content/:contentId/review-events', requireAuth, handleGetReviewEvents);
  app.get('/api/contents/:contentId/review-history', requireAuth, handleGetReviewEvents);
  app.get('/api/content/:contentId/review-history', requireAuth, handleGetReviewEvents);

  // 33. Review Queue
  app.get(
    '/api/campaigns/:campaignId/review-queue',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const user = req.user!;
      const { campaignId } = req.params;
      const statusFilter = req.query.status as ContentStatus | undefined;

      const mem = await checkUserCampaignMembership(user.id, campaignId);
      if (!mem.isMember && user.role !== 'Administrator') {
        res.status(403).json({ error: 'Forbidden', message: 'Acesso negado à fila de revisão desta campanha.' });
        return;
      }

      const queue = contentStore.getReviewQueue(campaignId, statusFilter);
      res.json({ queue, total: queue.length });
    }
  );

  app.get(
    '/api/review-queue',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const user = req.user!;
      const statusFilter = req.query.status as ContentStatus | undefined;

      // Filter to campaigns user has access to
      const allQueue = contentStore.getReviewQueue(undefined, statusFilter);
      const authorizedQueue: ContentModel[] = [];

      for (const item of allQueue) {
        if (user.role === 'Administrator') {
          authorizedQueue.push(item);
        } else {
          const mem = await checkUserCampaignMembership(user.id, item.campaign_id);
          if (mem.isMember) {
            authorizedQueue.push(item);
          }
        }
      }

      res.json({ queue: authorizedQueue, total: authorizedQueue.length });
    }
  );

  // 34. Get AI Generation Logs for Campaign
  app.get(
    '/api/campaigns/:campaignId/content-logs',
    requireAuth,
    requirePermission('campaign.view'),
    async (req: AuthenticatedRequest, res) => {
      const user = req.user!;
      const { campaignId } = req.params;

      if (user.role !== 'Administrator') {
        const mem = await checkUserCampaignMembership(user.id, campaignId);
        if (!mem.isMember) {
          res.status(403).json({ error: 'Forbidden', message: 'Acesso negado aos logs desta campanha.' });
          return;
        }
      }

      const logs = contentStore.getAILogs(campaignId);
      res.json({ logs, total: logs.length });
    }
  );

  // 35. List Campaign Moderation Audit Events (Phase 10A)
  app.get(
    '/api/campaigns/:campaignId/moderation',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const user = req.user!;
      const { campaignId } = req.params;

      if (user.role !== 'Administrator') {
        const mem = await checkUserCampaignMembership(user.id, campaignId);
        if (!mem.isMember) {
          res.status(403).json({
            error: 'Forbidden',
            message: 'Acesso negado aos registros de moderação desta campanha.',
          });
          return;
        }
      }

      const events = moderationStore.listEvents(campaignId);
      res.json({ events, total: events.length });
    }
  );

  // 36. List Pending Moderation Reviews (Phase 10A)
  app.get(
    '/api/campaigns/:campaignId/moderation/pending',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const user = req.user!;
      const { campaignId } = req.params;

      if (user.role !== 'Administrator') {
        const mem = await checkUserCampaignMembership(user.id, campaignId);
        if (!mem.isMember) {
          res.status(403).json({
            error: 'Forbidden',
            message: 'Acesso negado às pendências de moderação desta campanha.',
          });
          return;
        }
      }

      const pending = moderationStore.listPendingReviews(campaignId);
      res.json({ pending, total: pending.length });
    }
  );

  // 37. Resolve Pending Moderation Review (Approver / Administrator only) (Phase 10A)
  app.post(
    '/api/campaigns/:campaignId/moderation/:eventId/resolve',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const user = req.user!;
      const { campaignId, eventId } = req.params;
      const { decision, notes } = req.body;

      // Governance: Only Approver or Administrator can resolve moderation reviews
      if (user.role !== 'Approver' && user.role !== 'Administrator') {
        res.status(403).json({
          error: 'Forbidden',
          statusCode: 'FORBIDDEN',
          message: `Apenas usuários com papel 'Approver' ou 'Administrator' podem resolver revisões de moderação. Seu papel é '${user.role}'.`,
        });
        return;
      }

      if (user.role !== 'Administrator') {
        const mem = await checkUserCampaignMembership(user.id, campaignId);
        if (!mem.isMember) {
          res.status(403).json({
            error: 'Forbidden',
            message: 'Acesso negado a esta campanha.',
          });
          return;
        }
      }

      if (!decision || (decision !== 'ALLOW' && decision !== 'BLOCK')) {
        res.status(400).json({
          error: 'BadRequest',
          statusCode: 'VALIDATION_ERROR',
          message: "Decisão de moderação inválida. Deve ser 'ALLOW' ou 'BLOCK'.",
        });
        return;
      }

      if (!notes || typeof notes !== 'string' || notes.trim().length < 5) {
        res.status(400).json({
          error: 'BadRequest',
          statusCode: 'VALIDATION_ERROR',
          message: 'Justificativa da resolução de moderação é obrigatória e deve ter ao menos 5 caracteres.',
        });
        return;
      }

      try {
        const updatedEvent = moderationStore.resolveReview({
          eventId,
          resolver: {
            id: user.id,
            name: user.displayName,
            role: user.role,
          },
          decision,
          notes: notes.trim(),
        });

        // Sync with content item if linked
        if (updatedEvent.resource_type === 'content' && updatedEvent.resource_id) {
          const newStatus: ModerationStatus = decision === 'ALLOW' ? 'LOW_RISK' : 'BLOCKED';
          const newRisk: ModerationRiskLevel = decision === 'ALLOW' ? 'LOW_RISK' : 'HIGH_RISK';
          contentStore.updateContentModeration(
            updatedEvent.resource_id,
            newStatus,
            newRisk,
            `Resolução por ${user.displayName} (${user.role}): ${notes.trim()}`
          );
        }

        res.json({
          success: true,
          event: updatedEvent,
          message: `Revisão de moderação concluída com sucesso (${decision}).`,
        });
      } catch (err: unknown) {
        res.status(400).json({
          error: 'BadRequest',
          message: err instanceof Error ? err.message : 'Falha ao resolver pendência de moderação.',
        });
      }
    }
  );

  // -------------------------------------------------------------
  // PHASE 10B: AI AUDIT, COST TRACKING & ROI METRICS ENDPOINTS
  // -------------------------------------------------------------

  // 38. Comprehensive Custos & ROI Governance Data (Admin & users with 'costs.view' permission)
  app.get(
    '/api/governance/costs-roi',
    requireAuth,
    requirePermission('costs.view'),
    async (req: AuthenticatedRequest, res) => {
      const { campaignId, userId } = req.query as { campaignId?: string; userId?: string };

      const operational = aiAuditStore.getOperationalMetrics({ campaignId, userId });
      const costs = aiAuditStore.getCostSummary({ campaignId, userId });
      const productivity = aiAuditStore.getProductivityMetrics({ campaignId });
      const roi = aiAuditStore.getROIMetrics({ campaignId });
      const recentAuditEvents = aiAuditStore.listEvents({ campaignId, userId, limit: 25 });

      res.json({
        operational,
        costs,
        productivity,
        roi,
        auditEventsCount: recentAuditEvents.length,
        recentAuditEvents,
      });
    }
  );

  // 39. Centralized AI Audit Trail with Granular Filters (Admin & users with 'audit.view' permission)
  app.get(
    '/api/governance/ai-audit',
    requireAuth,
    requirePermission('audit.view'),
    async (req: AuthenticatedRequest, res) => {
      const {
        userId,
        campaignId,
        provider,
        model,
        operation,
        status,
        moderationStatus,
        startDate,
        endDate,
        limit,
        offset,
      } = req.query as Record<string, string | undefined>;

      const parsedLimit = limit ? Math.min(parseInt(limit, 10), 200) : 50;
      const parsedOffset = offset ? parseInt(offset, 10) : 0;

      const events = aiAuditStore.listEvents({
        userId,
        campaignId,
        provider,
        model,
        operation,
        status: status as any,
        moderationStatus: moderationStatus as any,
        startDate,
        endDate,
        limit: parsedLimit,
        offset: parsedOffset,
      });

      res.json({
        events,
        total: events.length,
        limit: parsedLimit,
        offset: parsedOffset,
      });
    }
  );

  // 40. Official AI Pricing Catalog Configuration (Admin & users with 'costs.view' permission)
  app.get(
    '/api/governance/pricing-config',
    requireAuth,
    requirePermission('costs.view'),
    async (req: AuthenticatedRequest, res) => {
      const pricingCatalog = costEngine.getPricingCatalog();
      res.json({ pricingCatalog });
    }
  );

  // 41. Campaign-Level AI Operational & Productivity Metrics (Scoped to campaign members)
  app.get(
    '/api/campaigns/:campaignId/ai-metrics',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const user = req.user!;
      const { campaignId } = req.params;

      if (user.role !== 'Administrator') {
        const mem = await checkUserCampaignMembership(user.id, campaignId);
        if (!mem.isMember) {
          res.status(403).json({ error: 'Forbidden', message: 'Acesso negado aos dados desta campanha.' });
          return;
        }
      }

      const operational = aiAuditStore.getOperationalMetrics({ campaignId });
      const productivity = aiAuditStore.getProductivityMetrics({ campaignId });
      const roi = aiAuditStore.getROIMetrics({ campaignId });

      // Financial cost data is restricted to Administrator or users with costs.view permission
      const hasCostsView = hasRolePermission(user.role, 'costs.view');
      const costs = hasCostsView ? aiAuditStore.getCostSummary({ campaignId }) : null;

      res.json({
        operational,
        productivity,
        roi,
        costs,
        hasFinancialAccess: hasCostsView,
      });
    }
  );

  // -------------------------------------------------------------
  // API 404 HANDLER (prevents falling through to Vite HTML for API calls)
  // -------------------------------------------------------------
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      error: 'NotFound',
      message: `API endpoint não encontrado: ${req.method} ${req.path}`,
    });
  });

  // -------------------------------------------------------------
  // VITE OR STATIC MIDDLEWARE
  // -------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Creative AI Server] running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});

