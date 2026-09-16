import React, { useState } from 'react';
import { Menu, Bell, ShieldAlert, ChevronDown, Check, LogOut } from 'lucide-react';
import { NavigationId, UserRole } from '../../types/ui';
import { NAVIGATION_ITEMS } from '../../mock/uiPresentationData';
import { Avatar } from '../ui/Avatar';
import { IconButton } from '../ui/IconButton';
import { useAuth } from '../../hooks/useAuth';

export interface TopBarProps {
  currentTab: NavigationId;
  onOpenMobileMenu: () => void;
  selectedRole: UserRole;
  onRoleChange: (role: UserRole) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentTab,
  onOpenMobileMenu,
  selectedRole,
  onRoleChange,
}) => {
  const { user, signOut } = useAuth();
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const currentNav = NAVIGATION_ITEMS.find((item) => item.id === currentTab);

  const displayUser = user || {
    id: 'anon',
    displayName: 'Usuario invitado',
    email: 'autenticacion.pendiente@empresa.com',
    role: selectedRole,
    avatarUrl: undefined,
    accountStatus: 'active' as const,
  };

  const roleColors: Record<UserRole, string> = {
    Designer: 'bg-slate-100 text-slate-700 border-slate-200',
    Copywriter: 'bg-slate-100 text-slate-700 border-slate-200',
    Approver: 'bg-blue-50 text-blue-700 border-blue-200',
    Administrator: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Left: Mobile Menu & Current Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          aria-label="Abrir menú de navegación"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-semibold text-slate-900 tracking-tight">
              {currentNav?.label || 'Panel'}
            </h1>
            <span className="hidden sm:inline-block text-xs text-slate-300">•</span>
            <span className="hidden sm:inline-block text-xs text-slate-500 font-medium">
              Creative AI Platform
            </span>
          </div>
          {currentNav?.description && (
            <p className="hidden md:block text-[11px] text-slate-500">
              {currentNav.description}
            </p>
          )}
        </div>
      </div>

      {/* Right: Role Switcher (DEV/TEST ONLY), Notifications & Profile */}
      <div className="flex items-center gap-3">
        {/* DEV / TEST ONLY Role Switcher Badge & Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors text-xs cursor-pointer text-slate-700"
            title="Selector de rol para pruebas de interfaz"
          >
            <div className="flex items-center gap-1 text-[10px] uppercase font-medium tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
              <ShieldAlert className="w-3 h-3 text-amber-600" />
              <span>TEST PREVIEW</span>
            </div>
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${roleColors[selectedRole]}`}>
              {selectedRole}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Role Dropdown */}
          {isRoleDropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-3">
              <div className="p-2.5 border-b border-slate-100 mb-2 bg-slate-50 rounded-md">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Entorno de pruebas visuales</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                  Este selector altera únicamente la previsualización visual de la interfaz. <strong>NO</strong> altera permisos ni modifica su usuario en el backend.
                </p>
              </div>

              <div className="space-y-1">
                {(['Designer', 'Copywriter', 'Approver', 'Administrator'] as UserRole[]).map(
                  (role) => {
                    const isCurrent = selectedRole === role;
                    return (
                      <button
                        key={role}
                        onClick={() => {
                          onRoleChange(role);
                          setIsRoleDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`px-2 py-0.5 rounded border ${roleColors[role]}`}>
                          {role}
                        </span>
                        {isCurrent && <Check className="w-4 h-4 text-blue-600" />}
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative">
          <IconButton
            aria-label="Notificaciones"
            icon={<Bell className="w-4 h-4 text-slate-600" />}
            variant="ghost"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative hover:bg-slate-100"
          />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs font-semibold text-slate-800">
                <span>Notificaciones del sistema</span>
                <span className="text-[10px] text-slate-500 font-normal">Sesión activa</span>
              </div>
              <div className="py-3 text-center text-xs text-slate-500">
                No hay notificaciones nuevas en este momento.
              </div>
            </div>
          )}
        </div>

        {/* Real User Profile Area with Logout */}
        <div className="hidden sm:flex items-center gap-2.5 pl-2 border-l border-slate-200">
          <Avatar
            name={displayUser.displayName}
            avatarUrl={displayUser.avatarUrl}
            role={user ? user.role : selectedRole}
            size="md"
          />
          <div className="flex flex-col text-left">
            <span className="text-xs font-medium text-slate-800 leading-tight">
              {displayUser.displayName}
            </span>
            <span className="text-[10px] text-slate-500 truncate max-w-[140px]">
              {displayUser.email}
            </span>
          </div>

          {/* Logout Action Button */}
          {user && (
            <button
              onClick={() => signOut()}
              className="p-1.5 ml-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
