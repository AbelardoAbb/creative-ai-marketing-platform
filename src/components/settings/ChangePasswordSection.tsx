import React, { useState } from 'react';
import { Lock, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getSupabaseClient } from '../../lib/supabaseClient';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

export const ChangePasswordSection: React.FC = () => {
  const { user, session } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!user || !session) {
      setErrorMessage('Debe iniciar sesión para cambiar su contraseña.');
      return;
    }

    if (!newPassword) {
      setErrorMessage('Por favor, ingrese la nueva contraseña.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setErrorMessage('El servicio de autenticación no está disponible.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setErrorMessage(error.message || 'Error al actualizar la contraseña.');
      } else {
        setSuccessMessage('Contraseña actualizada exitosamente.');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch {
      setErrorMessage('Ocurrió un error inesperado al actualizar la contraseña.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card variant="default" padding="lg" id="change-password-section" className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
          <Lock className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Cambiar contraseña
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Actualice la credencial de acceso para su cuenta autenticada.
          </p>
        </div>
      </div>

      {!user || !session ? (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Esta sección requiere una sesión autenticada. Inicie sesión para cambiar su contraseña.</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          {user.email && (
            <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <span className="font-medium text-slate-700">Cuenta activa:</span>{' '}
              <span className="font-mono text-slate-900">{user.email}</span>
            </div>
          )}

          {successMessage && (
            <div
              id="change-password-success"
              className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div
              id="change-password-error"
              className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="new-password"
              className="block text-xs font-medium text-slate-700"
            >
              Nueva contraseña
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                disabled={isLoading}
                className="w-full rounded-lg bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-sm py-2 pl-3 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 disabled:bg-slate-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="confirm-new-password"
              className="block text-xs font-medium text-slate-700"
            >
              Confirmar nueva contraseña
            </label>
            <input
              id="confirm-new-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita la nueva contraseña"
              disabled={isLoading}
              className="w-full rounded-lg bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 disabled:bg-slate-50 disabled:cursor-not-allowed"
            />
          </div>

          <div className="pt-2">
            <Button
              id="submit-change-password-btn"
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              disabled={isLoading || !newPassword || !confirmPassword}
            >
              {isLoading ? 'Actualizando...' : 'Actualizar contraseña'}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
};
