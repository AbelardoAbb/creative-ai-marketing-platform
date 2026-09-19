/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Sparkles,
  Lock,
  Mail,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  Server,
  Key,
  Database,
  ArrowRight,
  UserPlus,
  LogIn,
  CheckCircle2,
  User,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { UserRole } from '../../types/auth';

export const LoginPage: React.FC = () => {
  const {
    signInWithPassword,
    signUp,
    isBlocked,
    blockedDetails,
    error,
    refreshSession,
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('Designer');
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);

    if (!email.trim() || !password.trim()) {
      setLocalError('Por favor preencha o seu e-mail e palavra-passe corporativos.');
      return;
    }

    setIsLoading(true);

    if (mode === 'signup') {
      if (!fullName.trim()) {
        setLocalError('Por favor insira o seu nome completo para o registo.');
        setIsLoading(false);
        return;
      }

      const result = await signUp(email.trim(), password, fullName.trim(), role);
      setIsLoading(false);

      if (!result.success && result.error) {
        setLocalError(result.error);
      } else if (result.message) {
        setSuccessMessage(result.message);
      }
    } else {
      const result = await signInWithPassword(email.trim(), password);
      setIsLoading(false);

      if (!result.success && result.error) {
        setLocalError(result.error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 antialiased">
      <div className="w-full max-w-lg relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 mb-2">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center justify-center gap-2">
            Creative AI
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              COPILOT
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Plataforma Enterprise de Marketing e Motor RBAC
          </p>
        </div>

        {/* CONDITION 1: BLOCKED STATE (Supabase Credentials Missing) */}
        {isBlocked ? (
          <Card
            variant="elevated"
            padding="lg"
            className="border-amber-200 bg-white shadow-sm space-y-5"
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-amber-700">
                      ESTADO:
                    </span>
                    <Badge variant="warning" hasDot size="sm">
                      BLOQUEADO
                    </Badge>
                  </div>
                  <h2 className="text-sm sm:text-base font-semibold text-slate-900 mt-0.5">
                    Supabase Auth não configurado
                  </h2>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
              <p>
                A autenticação da plataforma requer a ligação de uma <strong>instância real de Supabase Auth e PostgreSQL</strong>.
              </p>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700 space-y-1.5 font-mono">
                <div className="text-slate-800 font-sans font-medium text-xs mb-1">
                  Variáveis de ambiente necessárias:
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-red-600 font-bold">• SUPABASE_URL:</span>
                  <span className="text-slate-500">URL do seu projeto Supabase</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-red-600 font-bold">• SUPABASE_ANON_KEY:</span>
                  <span className="text-slate-500">Chave pública para o cliente</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-700 font-bold">• SUPABASE_SERVICE_ROLE_KEY:</span>
                  <span className="text-slate-500">Chave de serviço (apenas backend)</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500">
                Após configurar as credenciais:
              </span>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={refreshSession}
              >
                Verificar ligação
              </Button>
            </div>
          </Card>
        ) : (
          /* CONDITION 2: REAL SUPABASE AUTH LOGIN & REGISTRATION FORM */
          <Card
            variant="elevated"
            padding="lg"
            className="bg-white border-slate-200 shadow-sm space-y-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Autenticação Corporativa
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ligado ao Supabase Auth com RBAC nativo.
                </p>
              </div>
              <Badge variant="success" hasDot size="sm">
                Supabase Ativo
              </Badge>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setLocalError(null);
                  setSuccessMessage(null);
                }}
                className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  mode === 'signin'
                    ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Iniciar sessão</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setLocalError(null);
                  setSuccessMessage(null);
                }}
                className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Criar conta</span>
              </button>
            </div>

            {successMessage && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-800 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="leading-snug">{successMessage}</div>
              </div>
            )}

            {(error || localError) && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-800 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="leading-snug">{localError || error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === 'signup' && (
                <>
                  <Input
                    label="Nome Completo"
                    type="text"
                    placeholder="O seu nome e apelido"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    leftIcon={<User className="w-4 h-4" />}
                    required
                  />

                  <Select
                    label="Função Inicial de Criação (RBAC)"
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    options={[
                      { value: 'Designer', label: 'Designer (Criação visual e geração de ativos)' },
                      { value: 'Copywriter', label: 'Copywriter (Redação e criação editorial)' },
                    ]}
                  />
                  <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-100 text-[11px] text-blue-800 leading-snug">
                    <span className="font-semibold text-blue-900">Controlo de Privilégios:</span> As funções de{' '}
                    <span className="text-blue-950 font-mono font-medium">Approver</span> e{' '}
                    <span className="text-blue-950 font-mono font-medium">Administrator</span> são atribuídas exclusivamente por um Administrador autenticado.
                  </div>
                </>
              )}

              <Input
                label="E-mail Corporativo"
                type="email"
                placeholder="utilizador@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
                required
                autoComplete="email"
              />

              <Input
                label="Palavra-passe"
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                required
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full justify-center"
                  isLoading={isLoading}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  {mode === 'signup' ? 'Registar e aceder' : 'Iniciar sessão'}
                </Button>
              </div>
            </form>

            <div className="pt-2 border-t border-slate-200 text-center">
              <p className="text-[11px] text-slate-500">
                Sessão segura gerida através de tokens JWT no Supabase Auth.
              </p>
            </div>
          </Card>
        )}

        {/* Security Disclosures */}
        <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-600">
          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-white border border-slate-200 shadow-sm">
            <Server className="w-3.5 h-3.5 text-blue-600" />
            <span>Backend RBAC Ativo</span>
          </div>
          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-white border border-slate-200 shadow-sm">
            <Key className="w-3.5 h-3.5 text-emerald-600" />
            <span>Chave de Serviço Protegida</span>
          </div>
        </div>
      </div>
    </div>
  );
};
