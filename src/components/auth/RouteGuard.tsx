/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { LoginPage } from './LoginPage';
import { ForbiddenState } from './ForbiddenState';
import { LoadingState } from '../ui/LoadingState';
import { Permission } from '../../types/auth';

export interface RouteGuardProps {
  children: React.ReactNode;
  requiredPermission?: Permission;
  onFallback?: () => void;
}

export const RouteGuard: React.FC<RouteGuardProps> = ({
  children,
  requiredPermission,
  onFallback,
}) => {
  const { authStatus, user, hasPermission } = useAuth();

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4">
        <LoadingState message="Verificando sessão segura no Supabase..." />
      </div>
    );
  }

  if (authStatus === 'unauthenticated' || authStatus === 'blocked') {
    return <LoginPage />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <ForbiddenState
        requiredPermission={requiredPermission}
        userRole={user?.role}
        onBackToDashboard={onFallback || (() => window.location.reload())}
      />
    );
  }

  return <>{children}</>;
};
