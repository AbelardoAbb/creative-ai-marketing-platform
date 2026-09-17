/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  CampaignModel,
  CampaignMemberModel,
  CampaignStatus,
  CreateCampaignPayload,
  UpdateCampaignPayload,
} from '../../types/campaign';
import { UserRole } from '../../types/auth';
import { CampaignListView } from './CampaignListView';
import { CampaignDetailView } from './CampaignDetailView';
import { CampaignCreateModal } from './CampaignCreateModal';
import { LoadingState } from '../ui/LoadingState';
import { ErrorState } from '../ui/ErrorState';

export const CampaignWorkspaceContainer: React.FC = () => {
  const { user, session } = useAuth();

  const [campaigns, setCampaigns] = useState<CampaignModel[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignModel | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<CampaignMemberModel[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Derive canCreate based on role: Designer or Administrator
  const canCreate = user?.role === 'Designer' || user?.role === 'Administrator';

  // Helper for auth headers
  const getAuthHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-id': user?.id || 'anonymous',
      'x-user-role': user?.role || 'Designer',
      'x-user-email': user?.email || '',
      'x-user-name': user?.displayName || '',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  };

  // 1. Fetch campaigns list
  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/campaigns', {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erro HTTP ${res.status}`);
      }
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar la lista de campañas.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // 2. Fetch specific campaign details and its members
  const fetchCampaignDetails = async (campaignId: string) => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al cargar los detalles de la campaña.');
      }
      const data = await res.json();
      setSelectedCampaign(data.campaign);
      setSelectedMembers(data.members || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al obtener los datos de la campaña.');
    }
  };

  // 3. Create Campaign
  const handleCreateCampaign = async (payload: CreateCampaignPayload) => {
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Error al registrar la campaña.' };
      }

      await fetchCampaigns();
      if (data.campaign) {
        setSelectedCampaign(data.campaign);
        setSelectedMembers([
          {
            id: `mem-${data.campaign.id}-${user?.id}`,
            campaign_id: data.campaign.id,
            user_id: user?.id || 'creator',
            role: user?.role || 'Designer',
            user_email: user?.email,
            user_display_name: user?.displayName,
            joined_at: new Date().toISOString(),
          },
        ]);
      }
      return { success: true };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Error al procesar la creación.',
      };
    }
  };

  // 4. Update Campaign Briefing / Details
  const handleUpdateCampaign = async (updates: UpdateCampaignPayload) => {
    if (!selectedCampaign) return { success: false, error: 'Ninguna campaña seleccionada.' };

    try {
      const res = await fetch(`/api/campaigns/${selectedCampaign.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Error al actualizar los datos.' };
      }

      setSelectedCampaign(data.campaign);
      // Update in campaigns list as well
      setCampaigns((prev) =>
        prev.map((c) => (c.id === data.campaign.id ? data.campaign : c))
      );
      return { success: true };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Error en la solicitud.',
      };
    }
  };

  // 5. Update Status
  const handleStatusChange = async (newStatus: CampaignStatus) => {
    return handleUpdateCampaign({ status: newStatus });
  };

  // 6. Add Team Member
  const handleAddMember = async (
    targetUserId: string,
    role: UserRole,
    userEmail?: string,
    userDisplayName?: string
  ) => {
    if (!selectedCampaign) return { success: false, error: 'Ninguna campaña activa.' };

    try {
      const res = await fetch(`/api/campaigns/${selectedCampaign.id}/members`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          targetUserId,
          memberRole: role,
          userEmail,
          userDisplayName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Error al añadir miembro.' };
      }

      await fetchCampaignDetails(selectedCampaign.id);
      return { success: true };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Error al vincular miembro.',
      };
    }
  };

  // 7. Remove Team Member
  const handleRemoveMember = async (targetUserId: string) => {
    if (!selectedCampaign) return { success: false, error: 'Ninguna campaña activa.' };

    try {
      const res = await fetch(`/api/campaigns/${selectedCampaign.id}/members/${targetUserId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Error al eliminar miembro.' };
      }

      await fetchCampaignDetails(selectedCampaign.id);
      return { success: true };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Error al desvincular miembro.',
      };
    }
  };

  if (loading && campaigns.length === 0) {
    return <LoadingState message="Cargando espacio de trabajo de campañas..." />;
  }

  if (error && campaigns.length === 0) {
    return (
      <ErrorState
        title="Error al cargar campañas"
        message={error}
        onRetry={fetchCampaigns}
      />
    );
  }

  return (
    <div>
      {selectedCampaign ? (
        <CampaignDetailView
          campaign={selectedCampaign}
          members={selectedMembers}
          currentUser={user}
          onBack={() => {
            setSelectedCampaign(null);
            fetchCampaigns();
          }}
          onUpdateCampaign={handleUpdateCampaign}
          onStatusChange={handleStatusChange}
          onAddMember={handleAddMember}
          onRemoveMember={handleRemoveMember}
        />
      ) : (
        <CampaignListView
          campaigns={campaigns}
          currentUser={user}
          onSelectCampaign={(camp) => {
            setSelectedCampaign(camp);
            fetchCampaignDetails(camp.id);
          }}
          onCreateClick={() => setIsCreateModalOpen(true)}
          canCreate={canCreate}
        />
      )}

      {/* Campaign Creation Modal */}
      <CampaignCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateCampaign}
      />
    </div>
  );
};
