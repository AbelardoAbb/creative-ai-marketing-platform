/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Users, UserPlus, Shield, Trash2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { UserRole } from '../../types/auth';
import { CampaignMemberModel } from '../../types/campaign';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';

export interface CampaignTeamTabProps {
  campaignId: string;
  creatorId: string;
  members: CampaignMemberModel[];
  canManageTeam: boolean;
  onAddMember: (targetUserId: string, role: UserRole, userEmail?: string, userDisplayName?: string) => Promise<{ success: boolean; error?: string }>;
  onRemoveMember: (targetUserId: string) => Promise<{ success: boolean; error?: string }>;
}

const AVAILABLE_ROLES: { value: UserRole; label: string }[] = [
  { value: 'Designer', label: 'Designer (Criação visual e ativos)' },
  { value: 'Copywriter', label: 'Redator / Copywriter (Textos com IA)' },
  { value: 'Approver', label: 'Aprovador (Revisão e governação editorial)' },
  { value: 'Administrator', label: 'Administrador (Supervisão e auditoria)' },
];

export const CampaignTeamTab: React.FC<CampaignTeamTabProps> = ({
  campaignId,
  creatorId,
  members,
  canManageTeam,
  onAddMember,
  onRemoveMember,
}) => {
  const [targetEmail, setTargetEmail] = useState('');
  const [targetName, setTargetName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('Copywriter');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!targetEmail.trim()) {
      setError('Indique o endereço de e-mail ou identificador do utilizador.');
      return;
    }

    setLoading(true);
    try {
      const targetUserId = `user-${targetEmail.trim().toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const res = await onAddMember(
        targetUserId,
        selectedRole,
        targetEmail.trim(),
        targetName.trim() || undefined
      );

      if (res.success) {
        setSuccessMsg(`Membro adicionado com sucesso à equipa da campanha.`);
        setTargetEmail('');
        setTargetName('');
      } else {
        setError(res.error || 'Erro ao adicionar membro.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar membro.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (userId: string, isCreator: boolean) => {
    if (isCreator) {
      setError('Não é permitido remover o criador da campanha da equipa.');
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const res = await onRemoveMember(userId);
      if (res.success) {
        setSuccessMsg('Membro removido da campanha com sucesso.');
      } else {
        setError(res.error || 'Erro ao remover membro.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao remover membro.');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case 'Administrator':
        return 'blue';
      case 'Approver':
        return 'warning';
      case 'Copywriter':
        return 'info';
      case 'Designer':
      default:
        return 'success';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">Equipa da Campanha e Permissões</h3>
            <Badge variant="neutral" size="sm">
              {members.length} membros
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            O isolamento por RLS garante que unicamente os utilizadores listados aqui possam aceder ou editar os conteúdos desta campanha.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-red-700 text-xs sm:text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-emerald-800 text-xs sm:text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Members Roster (2 Cols) */}
        <div className="lg:col-span-2 space-y-3">
          <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-2">
            Membros Atribuídos
          </h4>

          {members.length === 0 ? (
            <Card padding="md" className="text-center text-xs text-slate-500">
              Nenhum membro registado além do criador.
            </Card>
          ) : (
            members.map((m) => {
              const isCreator = m.user_id === creatorId;
              const displayName = m.user_display_name || m.user_email || m.user_id;

              return (
                <div
                  key={m.id || m.user_id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-colors shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-semibold text-sm">
                      {displayName.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">{displayName}</span>
                        {isCreator && (
                          <Badge variant="blue" size="sm">
                            Criador
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-slate-500">
                        {m.user_email || `ID: ${m.user_id.substring(0, 16)}...`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge variant={getRoleBadgeVariant(m.role)} size="sm">
                      {m.role}
                    </Badge>

                    {canManageTeam && !isCreator && (
                      <button
                        type="button"
                        onClick={() => handleRemove(m.user_id, isCreator)}
                        disabled={loading}
                        aria-label="Eliminar membro"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Add Member Form (1 Col) */}
        <div>
          {canManageTeam ? (
            <Card padding="md" className="space-y-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  Adicionar Membro à Equipa
                </h4>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Adicione colaboradores para produzir imagens, redações ou realizar a aprovação final.
              </p>

              <form onSubmit={handleAddMember} className="space-y-3.5 pt-2">
                <Input
                  label="Endereço de E-mail ou Utilizador *"
                  placeholder="colaborador@empresa.com"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  required
                />
                <Input
                  label="Nome a Exibir"
                  placeholder="Ex: Mariana Costa"
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                />
                <Select
                  label="Função na Campanha"
                  options={AVAILABLE_ROLES}
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="w-full mt-2"
                  isLoading={loading}
                  leftIcon={<UserPlus className="w-4 h-4" />}
                >
                  Conceder Acesso
                </Button>
              </form>
            </Card>
          ) : (
            <Card padding="md" className="space-y-3 bg-slate-50 border-slate-200">
              <div className="flex items-center gap-2 text-slate-600">
                <Shield className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Gestão Restrita
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Unicamente o Criador da campanha ou os Administradores têm permissão para adicionar ou remover membros desta equipa.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
