/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Building2,
  FolderKanban,
  Sparkles,
  Users,
  FileText,
  Activity,
  Layers,
  CheckCircle2,
  AlertCircle,
  Shield,
  PenTool,
  ClipboardCheck,
  Cpu,
} from 'lucide-react';
import {
  CampaignModel,
  CampaignMemberModel,
  CampaignStatus,
  UpdateCampaignPayload,
} from '../../types/campaign';
import { UserRole } from '../../types/auth';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Tabs } from '../ui/Tabs';
import { CampaignOverviewTab } from './CampaignOverviewTab';
import { CampaignBriefingTab } from './CampaignBriefingTab';
import { CampaignTeamTab } from './CampaignTeamTab';
import { CampaignActivityTab } from './CampaignActivityTab';
import { ImageStudioTab } from '../studio/ImageStudioTab';
import { ContentEditorTab } from '../content/ContentEditorTab';
import { CampaignReviewQueueTab } from './CampaignReviewQueueTab';
import { CampaignAIMetricsTab } from './CampaignAIMetricsTab';

export interface CampaignDetailViewProps {
  campaign: CampaignModel;
  members: CampaignMemberModel[];
  currentUser: { id: string; role: UserRole; email?: string } | null;
  onBack: () => void;
  onUpdateCampaign: (updates: UpdateCampaignPayload) => Promise<{ success: boolean; error?: string }>;
  onStatusChange: (newStatus: CampaignStatus) => Promise<{ success: boolean; error?: string }>;
  onAddMember: (targetUserId: string, role: UserRole, userEmail?: string, userDisplayName?: string) => Promise<{ success: boolean; error?: string }>;
  onRemoveMember: (targetUserId: string) => Promise<{ success: boolean; error?: string }>;
}

export const CampaignDetailView: React.FC<CampaignDetailViewProps> = ({
  campaign,
  members,
  currentUser,
  onBack,
  onUpdateCampaign,
  onStatusChange,
  onAddMember,
  onRemoveMember,
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedContentForEditor, setSelectedContentForEditor] = useState<string | null>(null);

  const isCreator = currentUser?.id === campaign.created_by;
  const isAdmin = currentUser?.role === 'Administrator';
  const isDesigner = currentUser?.role === 'Designer';

  // Can edit briefing if Admin or Creator or Designer assigned
  const canEditBriefing = isAdmin || isCreator || (isDesigner && members.some((m) => m.user_id === currentUser?.id));
  // Can manage team if Admin or Creator
  const canManageTeam = isAdmin || isCreator;

  const getStatusBadgeVariant = (status: CampaignStatus) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'in_review':
        return 'warning';
      case 'completed':
        return 'blue';
      case 'archived':
        return 'neutral';
      case 'draft':
      default:
        return 'info';
    }
  };

  const getStatusLabel = (status: CampaignStatus) => {
    switch (status) {
      case 'active':
        return 'ACTIVA';
      case 'in_review':
        return 'EN REVISIÓN';
      case 'completed':
        return 'COMPLETADA';
      case 'archived':
        return 'ARCHIVADA';
      case 'draft':
      default:
        return 'BORRADOR';
    }
  };

  const tabs = [
    { id: 'overview', label: 'Visión General', icon: <Layers className="w-4 h-4" /> },
    { id: 'review_queue', label: 'Cola de Aprobación', icon: <ClipboardCheck className="w-4 h-4" /> },
    { id: 'content', label: 'Editor de Contenido (Claude)', icon: <PenTool className="w-4 h-4" /> },
    { id: 'studio', label: 'Estudio de Imagen (IA)', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'briefing', label: 'Briefing y Contexto IA', icon: <FileText className="w-4 h-4" /> },
    { id: 'team', label: `Equipo (${members.length})`, icon: <Users className="w-4 h-4" /> },
    { id: 'ai_metrics', label: 'Métricas de IA', icon: <Cpu className="w-4 h-4" /> },
    { id: 'activity', label: 'Actividades', icon: <Activity className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Volver a Campañas
          </Button>
          <span className="text-slate-300">/</span>
          <span className="text-xs sm:text-sm text-slate-500 font-mono">
            {campaign.id.substring(0, 12)}...
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={getStatusBadgeVariant(campaign.status)} size="md">
            {getStatusLabel(campaign.status)}
          </Badge>
          {isCreator && (
            <Badge variant="blue" size="md">
              Creador de la Campaña
            </Badge>
          )}
        </div>
      </div>

      {/* Campaign Header Card */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
                {campaign.client || 'Cliente General'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{campaign.name}</h1>
            {campaign.product_or_service && (
              <p className="text-xs sm:text-sm text-slate-500">
                Producto en foco: <span className="text-slate-700 font-medium">{campaign.product_or_service}</span>
              </p>
            )}
          </div>

          {/* Quick Meta Stats */}
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Inicio: {new Date(campaign.created_at).toLocaleDateString('es-ES')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>{members.length} colaboradores</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* Active Tab Panel */}
      <div className="pt-2">
        {activeTab === 'overview' && (
          <CampaignOverviewTab
            campaign={campaign}
            members={members}
            canEdit={canEditBriefing}
            onStatusChange={onStatusChange}
            onNavigateToTab={setActiveTab}
          />
        )}

        {activeTab === 'review_queue' && (
          <CampaignReviewQueueTab
            campaign={campaign}
            onOpenContentInEditor={(contentId) => {
              setSelectedContentForEditor(contentId);
              setActiveTab('content');
            }}
          />
        )}

        {activeTab === 'content' && (
          <ContentEditorTab
            campaign={campaign}
            initialContentId={selectedContentForEditor}
          />
        )}

        {activeTab === 'studio' && (
          <ImageStudioTab campaign={campaign} />
        )}

        {activeTab === 'briefing' && (
          <CampaignBriefingTab
            campaign={campaign}
            canEdit={canEditBriefing}
            onUpdate={onUpdateCampaign}
          />
        )}

        {activeTab === 'team' && (
          <CampaignTeamTab
            campaignId={campaign.id}
            creatorId={campaign.created_by}
            members={members}
            canManageTeam={canManageTeam}
            onAddMember={onAddMember}
            onRemoveMember={onRemoveMember}
          />
        )}

        {activeTab === 'ai_metrics' && <CampaignAIMetricsTab campaign={campaign} />}

        {activeTab === 'activity' && <CampaignActivityTab campaign={campaign} />}
      </div>
    </div>
  );
};
