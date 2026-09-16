/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RouteGuard } from './components/auth/RouteGuard';
import { ApplicationShell } from './components/layout/ApplicationShell';
import { DashboardView } from './components/views/DashboardView';
import { PlaceholderView } from './components/views/PlaceholderView';
import { CampaignWorkspaceContainer } from './components/campaigns/CampaignWorkspaceContainer';
import { GalleryView } from './components/gallery/GalleryView';
import { CostAndROIDashboard } from './components/governance/CostAndROIDashboard';
import { GovernanceView } from './components/governance/GovernanceView';
import { ForbiddenState } from './components/auth/ForbiddenState';
import { NavigationId, UserRole } from './types/ui';
import { Permission, hasRolePermission } from './types/auth';

/**
 * Route-level required permissions map.
 * Enforces role-based view restrictions at the UI level.
 * (Note: Backend routes independently enforce permissions with HTTP 403 checks).
 */
const TAB_REQUIRED_PERMISSIONS: Partial<Record<NavigationId, Permission>> = {
  approvals: 'approval.review',
  'users-permissions': 'users.manage',
  governance: 'audit.view',
  'costs-roi': 'costs.view',
};

function MainAppContent() {
  const { user, devVisualRole, setDevVisualRole } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavigationId>('dashboard');

  // Role resolution: real authenticated role by default, or dev visual preview if selected
  const effectiveRole: UserRole = devVisualRole || user?.role || 'Designer';

  const requiredPermission = TAB_REQUIRED_PERMISSIONS[currentTab];
  const isAuthorizedForTab = !requiredPermission || hasRolePermission(effectiveRole, requiredPermission);

  return (
    <ApplicationShell
      currentTab={currentTab}
      onSelectTab={setCurrentTab}
      currentRole={effectiveRole}
      onRoleChange={(newRole) => setDevVisualRole(newRole)}
    >
      {!isAuthorizedForTab ? (
        <ForbiddenState
          requiredPermission={requiredPermission}
          userRole={effectiveRole}
          onBackToDashboard={() => setCurrentTab('dashboard')}
        />
      ) : currentTab === 'dashboard' ? (
        <DashboardView onNavigate={setCurrentTab} />
      ) : currentTab === 'campaigns' ? (
        <CampaignWorkspaceContainer />
      ) : currentTab === 'gallery' ? (
        <GalleryView
          onNavigateToCampaign={(id) => {
            setCurrentTab('campaigns');
          }}
        />
      ) : currentTab === 'costs-roi' ? (
        <CostAndROIDashboard onNavigateToAudit={() => setCurrentTab('governance')} />
      ) : currentTab === 'governance' ? (
        <GovernanceView />
      ) : (
        <PlaceholderView
          viewId={currentTab}
          currentRole={effectiveRole}
          onNavigate={setCurrentTab}
        />
      )}
    </ApplicationShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RouteGuard>
        <MainAppContent />
      </RouteGuard>
    </AuthProvider>
  );
}
