/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldX, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { UserRole, Permission } from '../../types/auth';

export interface ForbiddenStateProps {
  requiredPermission?: Permission;
  userRole?: UserRole;
  onBackToDashboard: () => void;
}

export const ForbiddenState: React.FC<ForbiddenStateProps> = ({
  requiredPermission,
  userRole,
  onBackToDashboard,
}) => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card variant="default" padding="lg" className="max-w-md w-full text-center bg-white border-slate-200 shadow-sm">
        <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mx-auto mb-4">
          <ShieldX className="w-6 h-6" />
        </div>

        <span className="text-[11px] font-mono font-bold tracking-widest text-red-600 uppercase">
          Erro 403 • Acesso Proibido
        </span>
        <h2 className="text-lg font-bold text-slate-900 mt-1">
          Permissão Insuficiente (RBAC)
        </h2>

        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
          A sua função autenticada atual ({userRole ? <strong className="text-slate-900">{userRole}</strong> : 'não identificada'}) não dispõe da autorização necessária para aceder a este módulo.
        </p>

        {requiredPermission && (
          <div className="mt-4 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 font-mono">
            Requer: <span className="text-blue-700 font-semibold">{requiredPermission}</span>
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            onClick={onBackToDashboard}
          >
            Voltar ao painel principal
          </Button>
        </div>
      </Card>
    </div>
  );
};
