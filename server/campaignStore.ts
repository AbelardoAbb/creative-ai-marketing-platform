/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CampaignModel, CampaignMemberModel, CreateCampaignPayload, UpdateCampaignPayload, CampaignStatus } from '../src/types/campaign';
import { UserRole } from '../src/types/auth';

/**
 * Server-side in-memory store for campaigns and members.
 * Used for instant synchronization when Supabase database tables are being created,
 * ensuring seamless fallback and persistence throughout the app lifecycle.
 */

const campaignsMap = new Map<string, CampaignModel>();
const campaignMembersMap = new Map<string, CampaignMemberModel[]>();

// Pre-seed some real initial campaigns for demonstrations with proper author attribution
const SEED_CAMPAIGNS: CampaignModel[] = [
  {
    id: 'camp-spring-2026-001',
    name: 'Lançamento Primavera Sustentável 2026',
    client: 'EcoVibe Cosméticos',
    description: 'Campanha de lançamento da nova linha de skincare 100% orgânica e embalagens biodegradáveis.',
    product_or_service: 'Linha Bio-Active Skincare',
    campaign_objective: 'Aumentar reconhecimento de marca e gerar 15.000 cadastros para lista de espera.',
    target_audience: 'Mulheres e homens de 22 a 40 anos, com foco em sustentabilidade, bem-estar e consumo consciente.',
    key_message: 'Cuidado genuíno com a sua pele e respeito absoluto pelo planeta.',
    tone_of_voice: 'Acolhedor, inspirador, transparente e sofisticado.',
    language: 'pt-BR',
    channels: ['Instagram', 'LinkedIn', 'YouTube', 'TikTok'],
    visual_direction: 'Fotografia com iluminação natural matutina, tons terrosos, verde botânico e textura orgânica.',
    creative_constraints: 'Não utilizar tons plásticos saturados ou animais em ambientes artificiais. Certificações visíveis.',
    status: 'active',
    created_by: 'user-designer-seed',
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 'camp-fintech-ai-002',
    name: 'NexusPay: Inteligência Financeira Autônoma',
    client: 'Nexus Global Bank',
    description: 'Campanha B2B para lançamento da plataforma corporativa de fluxo de caixa preditivo.',
    product_or_service: 'NexusPay Smart Cash Flow',
    campaign_objective: 'Gerar 800 leads qualificados de Diretores Financeiros (CFOs) e Head de Operações.',
    target_audience: 'C-Level e tomadores de decisão em médias e grandes empresas tech no Brasil e América Latina.',
    key_message: 'Decisões financeiras em tempo real sem adivinhações.',
    tone_of_voice: 'Seguro, assertivo, inovador e analítico.',
    language: 'pt-BR',
    channels: ['LinkedIn', 'Google Ads', 'Email Marketing'],
    visual_direction: 'Minimalismo escuro com acentos azul cobalto e roxo elétrico, diagramas limpos e tipografia geométrica.',
    creative_constraints: 'Não prometer retornos de investimento sem disclaimer regulatório do Banco Central.',
    status: 'in_review',
    created_by: 'user-designer-seed',
    created_at: new Date(Date.now() - 12 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'camp-tech-blackfriday-003',
    name: 'Aceleração Tech Black Friday',
    client: 'HyperTech E-commerce',
    description: 'Ofertas relâmpago e benefícios de upgrade antecipado para hardware gamer.',
    product_or_service: 'Monitores OLED e Acessórios Gamer de Alta Performance',
    campaign_objective: 'Maximizar conversão em vendas imediatas com ROAS superior a 4.5x.',
    target_audience: 'Gamers e profissionais de criação entre 18 e 35 anos.',
    key_message: 'Ultra velocidade com taxa de atualização insana e latência zero.',
    tone_of_voice: 'Enérgico, dinâmico e provocativo.',
    language: 'pt-BR',
    channels: ['Instagram', 'TikTok', 'Twitch', 'YouTube'],
    visual_direction: 'Alto contraste, fundos escuros com neon magenta e ciano, renderizações 3D em alta fidelidade.',
    creative_constraints: 'Obrigatório incluir selo de garantia de 3 anos e tempo de resposta de 0.03ms.',
    status: 'draft',
    created_by: 'user-designer-seed',
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
];

// Initialize seed data
for (const camp of SEED_CAMPAIGNS) {
  campaignsMap.set(camp.id, camp);
  campaignMembersMap.set(camp.id, [
    {
      id: `member-${camp.id}-1`,
      campaign_id: camp.id,
      user_id: camp.created_by,
      role: 'Designer',
      created_at: camp.created_at,
      user_email: 'designer@creativeai.com',
      user_display_name: 'Lead Designer',
    },
    {
      id: `member-${camp.id}-2`,
      campaign_id: camp.id,
      user_id: 'user-copywriter-seed',
      role: 'Copywriter',
      created_at: camp.created_at,
      user_email: 'copywriter@creativeai.com',
      user_display_name: 'Senior Copywriter',
    },
  ]);
}

export const memoryCampaignStore = {
  listCampaigns(): CampaignModel[] {
    return Array.from(campaignsMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  getCampaign(id: string): CampaignModel | null {
    return campaignsMap.get(id) || null;
  },

  createCampaign(data: CreateCampaignPayload, creatorId: string, creatorRole: UserRole, creatorEmail?: string, creatorName?: string): CampaignModel {
    const id = `camp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newCampaign: CampaignModel = {
      id,
      name: data.name.trim(),
      client: (data.client || 'Geral').trim(),
      description: data.description?.trim() || null,
      product_or_service: data.product_or_service?.trim() || null,
      campaign_objective: data.campaign_objective?.trim() || null,
      target_audience: data.target_audience?.trim() || null,
      key_message: data.key_message?.trim() || null,
      tone_of_voice: data.tone_of_voice?.trim() || null,
      language: data.language?.trim() || 'pt-BR',
      channels: Array.isArray(data.channels) && data.channels.length > 0 ? data.channels : ['Instagram', 'LinkedIn'],
      visual_direction: data.visual_direction?.trim() || null,
      creative_constraints: data.creative_constraints?.trim() || null,
      status: 'draft',
      created_by: creatorId,
      created_at: now,
      updated_at: now,
    };

    campaignsMap.set(id, newCampaign);

    // Automatically add creator as member
    const member: CampaignMemberModel = {
      id: `member-${id}-${Date.now()}`,
      campaign_id: id,
      user_id: creatorId,
      role: creatorRole,
      created_at: now,
      user_email: creatorEmail,
      user_display_name: creatorName,
    };
    campaignMembersMap.set(id, [member]);

    return newCampaign;
  },

  updateCampaign(id: string, updates: UpdateCampaignPayload): CampaignModel | null {
    const existing = campaignsMap.get(id);
    if (!existing) return null;

    const updated: CampaignModel = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    campaignsMap.set(id, updated);
    return updated;
  },

  getMembers(campaignId: string): CampaignMemberModel[] {
    return campaignMembersMap.get(campaignId) || [];
  },

  isMember(campaignId: string, userId: string): boolean {
    const members = campaignMembersMap.get(campaignId) || [];
    return members.some((m) => m.user_id === userId);
  },

  getMember(campaignId: string, userId: string): CampaignMemberModel | null {
    const members = campaignMembersMap.get(campaignId) || [];
    return members.find((m) => m.user_id === userId) || null;
  },

  addMember(campaignId: string, userId: string, role: UserRole, userEmail?: string, userDisplayName?: string): CampaignMemberModel {
    const members = campaignMembersMap.get(campaignId) || [];
    const existingIndex = members.findIndex((m) => m.user_id === userId);

    const member: CampaignMemberModel = {
      id: `member-${campaignId}-${userId}`,
      campaign_id: campaignId,
      user_id: userId,
      role,
      created_at: new Date().toISOString(),
      user_email: userEmail,
      user_display_name: userDisplayName,
    };

    if (existingIndex >= 0) {
      members[existingIndex] = member;
    } else {
      members.push(member);
    }

    campaignMembersMap.set(campaignId, members);
    return member;
  },

  removeMember(campaignId: string, userId: string): boolean {
    const members = campaignMembersMap.get(campaignId) || [];
    const filtered = members.filter((m) => m.user_id !== userId);
    if (filtered.length !== members.length) {
      campaignMembersMap.set(campaignId, filtered);
      return true;
    }
    return false;
  },
};
