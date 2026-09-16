import React from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  Sparkles,
  PenTool,
  Image as ImageIcon,
  CheckCircle2,
  MessageSquare,
  History,
  ShieldCheck,
  Users,
  TrendingUp,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  Lock,
} from 'lucide-react';
import { NavigationId, UserRole } from '../../types/ui';
import { NAVIGATION_ITEMS } from '../../mock/uiPresentationData';
import { Badge } from '../ui/Badge';

export interface SidebarProps {
  currentTab: NavigationId;
  onSelectTab: (tabId: NavigationId) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  currentRole: UserRole;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  currentRole,
}) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'LayoutDashboard':
        return <LayoutDashboard className="w-4 h-4 shrink-0" />;
      case 'FolderKanban':
        return <FolderKanban className="w-4 h-4 shrink-0" />;
      case 'Sparkles':
        return <Sparkles className="w-4 h-4 shrink-0" />;
      case 'PenTool':
        return <PenTool className="w-4 h-4 shrink-0" />;
      case 'Image':
        return <ImageIcon className="w-4 h-4 shrink-0" />;
      case 'CheckCircle2':
        return <CheckCircle2 className="w-4 h-4 shrink-0" />;
      case 'MessageSquare':
        return <MessageSquare className="w-4 h-4 shrink-0" />;
      case 'History':
        return <History className="w-4 h-4 shrink-0" />;
      case 'ShieldCheck':
        return <ShieldCheck className="w-4 h-4 shrink-0" />;
      case 'Users':
        return <Users className="w-4 h-4 shrink-0" />;
      case 'TrendingUp':
        return <TrendingUp className="w-4 h-4 shrink-0" />;
      case 'Settings':
        return <Settings className="w-4 h-4 shrink-0" />;
      default:
        return <LayoutDashboard className="w-4 h-4 shrink-0" />;
    }
  };

  const content = (
    <aside className="flex flex-col h-full bg-white border-r border-slate-200 text-slate-700 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-slate-900 flex items-center gap-1.5">
                Creative AI
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  SaaS
                </span>
              </span>
              <span className="text-[11px] text-slate-500">Marketing Studio</span>
            </div>
          )}
        </div>

        {/* Mobile close button */}
        <button
          onClick={onCloseMobile}
          className="lg:hidden text-slate-400 hover:text-slate-700 p-1.5 rounded-md hover:bg-slate-100"
          aria-label="Cerrar navegación"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-1" aria-label="Menú principal">
        {NAVIGATION_ITEMS.map((item) => {
          const isActive = currentTab === item.id;
          const isPermitted = !item.allowedRoles || item.allowedRoles.includes(currentRole);

          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer group relative ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              } ${!isPermitted ? 'opacity-50' : ''}`}
            >
              <div
                className={`${
                  isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                }`}
              >
                {getIcon(item.iconName)}
              </div>

              {!isCollapsed && (
                <div className="flex-1 flex items-center justify-between text-left min-w-0">
                  <span className="truncate">{item.label}</span>
                  <div className="flex items-center gap-1.5">
                    {!isPermitted && (
                      <Lock className="w-3 h-3 text-slate-400" title="Requiere permisos adicionales" />
                    )}
                    {item.badge !== undefined && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Active indicator */}
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-blue-600 rounded-r" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer & Collapse Toggle */}
      <div className="p-3 border-t border-slate-200 flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] text-slate-500">Sistema en línea</span>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label={isCollapsed ? 'Expandir barra lateral' : 'Plegar barra lateral'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div
        className={`hidden lg:block shrink-0 transition-all duration-300 h-screen sticky top-0 ${
          isCollapsed ? 'w-18' : 'w-64'
        }`}
      >
        {content}
      </div>

      {/* Mobile Drawer Backdrop and Sidebar */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-64 max-w-[80vw] h-full z-10 animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
