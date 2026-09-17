import React, { useState } from 'react';
import {
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
  Layers,
  Wrench,
  Check,
} from 'lucide-react';
import { NavigationId, UserRole } from '../../types/ui';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Tabs } from '../ui/Tabs';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Toast } from '../ui/Toast';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { LoadingState } from '../ui/LoadingState';
import { ErrorState } from '../ui/ErrorState';
import { ChangePasswordSection } from '../settings/ChangePasswordSection';

export interface PlaceholderViewProps {
  viewId: NavigationId;
  currentRole: UserRole;
  onNavigate: (tabId: NavigationId) => void;
}

export const PlaceholderView: React.FC<PlaceholderViewProps> = ({
  viewId,
  currentRole,
  onNavigate,
}) => {
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('tab-1');
  const [showToast, setShowToast] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectValue, setSelectValue] = useState('opt-1');

  const metaConfig: Record<
    NavigationId,
    {
      title: string;
      subtitle: string;
      icon: React.ReactNode;
      targetPhase: string;
      integrationPoints: string[];
    }
  > = {
    dashboard: {
      title: 'Panel Principal',
      subtitle: 'Visión general de la operación creativa',
      icon: <Layers className="w-6 h-6 text-blue-600" />,
      targetPhase: 'Fase 3 (Activa)',
      integrationPoints: ['Métricas consolidadas de campañas y producciones'],
    },
    campaigns: {
      title: 'Gestión de Campañas y Briefings',
      subtitle: 'Creación y organización de campañas de marketing, público objetivo y clientes',
      icon: <FolderKanban className="w-6 h-6 text-blue-600" />,
      targetPhase: 'Fase 6 — Campañas',
      integrationPoints: [
        'Tabla `campaigns` y `campaign_members` en Supabase',
        'Políticas RLS por pertenencia a miembros',
        'Briefing estructurado para generación de IA',
      ],
    },
    'generate-image': {
      title: 'Estudio de Generación de Imágenes',
      subtitle: 'Creación de activos visuales personalizados con Stability AI y fallback',
      icon: <Sparkles className="w-6 h-6 text-blue-600" />,
      targetPhase: 'Fase 7 — Generación Visual',
      integrationPoints: [
        'Proveedor principal: Stability AI (Stable Diffusion API)',
        'Proveedor fallback: FallbackImageProvider (con auditoría explícita)',
        'Moderación previa de prompt (Input Moderation)',
        'Almacenamiento directo en Supabase Storage',
      ],
    },
    'create-content': {
      title: 'Estudio de Redacción y Copywriting',
      subtitle: 'Editor profesional integrado con Claude (Anthropic API) en vista comparativa',
      icon: <PenTool className="w-6 h-6 text-blue-600" />,
      targetPhase: 'Fase 8 & 9 — Claude & Editor',
      integrationPoints: [
        'Proveedor principal: Claude (Anthropic Messages API)',
        'Envío de contexto estructurado (Objetivo, Canal, Audiencia, Tono)',
        'Editor de comparación Original vs. Asistido',
        'Control de versiones continuo en `content_versions`',
      ],
    },
    gallery: {
      title: 'Galería de Activos Visuales',
      subtitle: 'Repositorio de imágenes generadas, metadatos de inferencia y envío a aprobación',
      icon: <ImageIcon className="w-6 h-6 text-blue-600" />,
      targetPhase: 'Fase 7 & 11 — Galería & Aprobaciones',
      integrationPoints: [
        'Listado de activos persistidos en Supabase Storage',
        'Filtros por campaña, autor y estado de aprobación',
        'Inspección detallada de metadados técnicos de generación',
      ],
    },
    approvals: {
      title: 'Flujo de Aprobación y Control de Calidad',
      subtitle: 'Cola de revisión para Aprobadores con regla estricta: el creador no aprueba su propio contenido',
      icon: <CheckCircle2 className="w-6 h-6 text-emerald-600" />,
      targetPhase: 'Fase 11 — Workflow de Aprobación',
      integrationPoints: [
        'Tabla `approvals` en Supabase con integridad referencial',
        'Validación de autorización en servidor (anti-autoaprobación)',
        'Justificación obligatoria en caso de rechazo',
      ],
    },
    collaboration: {
      title: 'Colaboración y Comentarios',
      subtitle: 'Discusión contextual entre Diseñadores, Copywriters y Aprobadores',
      icon: <MessageSquare className="w-6 h-6 text-blue-600" />,
      targetPhase: 'Fase 10 — Colaboración',
      integrationPoints: [
        'Comentarios en hilos vinculados a campañas y piezas',
        'Notificaciones de menciones y tareas asignadas',
      ],
    },
    history: {
      title: 'Historial y Control de Versiones',
      subtitle: 'Restauración de versiones anteriores y trazabilidad de cambios editoriales',
      icon: <History className="w-6 h-6 text-blue-600" />,
      targetPhase: 'Fase 12 — Historial de Versiones',
      integrationPoints: [
        'Historial granular de `content_versions` con diff visual',
        'Restauración autorizada hacia borradores de trabajo',
      ],
    },
    governance: {
      title: 'Gobernanza y Registro de Auditoría',
      subtitle: 'Registro inmutable de llamadas de IA, decisiones de moderación y calificaciones',
      icon: <ShieldCheck className="w-6 h-6 text-blue-600" />,
      targetPhase: 'Fase 12 & 13 — Auditoría & Moderación',
      integrationPoints: [
        'Tablas `activity_logs` y `ai_generations`',
        'Registro de proveedor real, tiempo de respuesta, tokens y costo estimado',
        'Clasificación de riesgo (Bajo Riesgo, Revisión Humana, Bloqueo)',
      ],
    },
    'users-permissions': {
      title: 'Usuarios y Permisos (RBAC)',
      subtitle: 'Gestión de roles (Designer, Copywriter, Approver, Administrator) y asignación a campañas',
      icon: <Users className="w-6 h-6 text-blue-600" />,
      targetPhase: 'Fase 4 & 5 — Autenticación & RBAC',
      integrationPoints: [
        'Supabase Auth con credenciales seguras',
        'Tablas `roles` y `campaign_members`',
        'Políticas RLS en PostgreSQL para aislamiento estricto',
      ],
    },
    'costs-roi': {
      title: 'Costos y Retorno de Inversión (ROI)',
      subtitle: 'Seguimiento del consumo de inferencia, tiempo ahorrado y eficiencia operativa',
      icon: <TrendingUp className="w-6 h-6 text-emerald-600" />,
      targetPhase: 'Fase 14 — Métricas & Costos',
      integrationPoints: [
        'Tabla `cost_records` agregando llamadas de texto e imagen',
        'Diferenciación clara entre consumo real y estimaciones operativas',
      ],
    },
    settings: {
      title: 'Configuración de la Plataforma',
      subtitle: 'Preferencias de la organización y estado de las integraciones de IA y Supabase',
      icon: <Settings className="w-6 h-6 text-slate-500" />,
      targetPhase: 'Configuración',
      integrationPoints: [
        'Estado de conexión Supabase, Claude y Stability AI',
        'Preferencias de interfaz y diseño corporativo',
      ],
    },
  };

  const currentMeta = metaConfig[viewId] || metaConfig.dashboard;

  return (
    <div className="space-y-8">
      {/* View Header */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-100">
            {currentMeta.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                {currentMeta.title}
              </h2>
              <Badge variant="blue" size="sm">
                {currentMeta.targetPhase}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {currentMeta.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Wrench className="w-3.5 h-3.5" />}
            onClick={() => setIsTestModalOpen(true)}
          >
            Probar componentes UI
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigate('dashboard')}>
            Volver al panel
          </Button>
        </div>
      </div>

      {/* Integration Blueprint & Architecture Contract Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {viewId === 'settings' && (
            <ChangePasswordSection />
          )}

          <Card variant="default" padding="lg">
            <h3 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              Contrato de integración planificado para esta ruta
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mb-4 leading-relaxed">
              Esta sección cuenta con arquitectura visual completa, componentes reactivos accesibles y persistencia integrada conforme a los contratos del sistema.
            </p>

            <div className="space-y-2.5">
              {currentMeta.integrationPoints.map((point, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700"
                >
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-mono shrink-0 mt-0.5 font-semibold">
                    {idx + 1}
                  </div>
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Interactive UI Component Sampler directly on the page */}
          <Card variant="default" padding="lg">
            <h3 className="text-base font-semibold text-slate-900 mb-4">
              Muestra de componentes reutilizables (Design System)
            </h3>

            {/* Tabs Component Demo */}
            <div className="mb-6">
              <Tabs
                tabs={[
                  { id: 'tab-1', label: 'Formularios y campos', badge: '3' },
                  { id: 'tab-2', label: 'Estados de feedback', badge: 'Listo' },
                  { id: 'tab-3', label: 'Carga y esqueletos' },
                ]}
                activeTab={activeTab}
                onChange={(t) => setActiveTab(t)}
              />
            </div>

            {activeTab === 'tab-1' && (
              <div className="space-y-4 max-w-xl">
                <Input
                  label="Título del briefing creativo"
                  placeholder="Ej: Campaña de lanzamiento Q3..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  helperText="Defina un nombre conciso y descriptivo para el proyecto."
                />

                <Select
                  label="Canal principal de distribución"
                  value={selectValue}
                  onChange={(e) => setSelectValue(e.target.value)}
                  options={[
                    { value: 'opt-1', label: 'Instagram Ads y Reels' },
                    { value: 'opt-2', label: 'LinkedIn Sponsored Content' },
                    { value: 'opt-3', label: 'E-mail marketing promocional' },
                    { value: 'opt-4', label: 'Display y medios programáticos' },
                  ]}
                />

                <Textarea
                  label="Instrucciones de estilo y restricciones de marca"
                  placeholder="Ej: No utilizar colores fluorescentes. Mantener tono profesional y elegante..."
                  rows={3}
                />

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    variant="primary"
                    onClick={() => {
                      setShowToast(true);
                    }}
                  >
                    Mostrar notificación Toast
                  </Button>
                  <Button variant="secondary" onClick={() => setInputValue('')}>
                    Limpiar
                  </Button>
                </div>

                {showToast && (
                  <div className="mt-4">
                    <Toast
                      id="demo-toast"
                      type="success"
                      title="Interacción de UI registrada"
                      message="El componente Toast se ha renderizado cumpliendo los estándares de accesibilidad."
                      onClose={() => setShowToast(false)}
                    />
                  </div>
                )}
              </div>
            )}

            {activeTab === 'tab-2' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <EmptyState
                    title="Ninguna pieza rechazada"
                    description="Todas las propuestas creativas enviadas han sido aprobadas o están en cola de revisión."
                    actionLabel="Ver cola de aprobaciones"
                    onAction={() => onNavigate('approvals')}
                  />
                  <ErrorState
                    title="Simulación de error de validación"
                    message="Ejemplo de estado de error accesible con botón de reintento controlado."
                    onRetry={() => alert('Acción de reintento ejecutada.')}
                  />
                </div>
              </div>
            )}

            {activeTab === 'tab-3' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-500">
                  Estados de carga con Skeleton para transiciones suaves:
                </p>
                <div className="space-y-2 max-w-md">
                  <Skeleton variant="text" className="w-3/4 h-5" />
                  <Skeleton variant="text" className="w-full h-4" />
                  <Skeleton variant="text" className="w-1/2 h-4" />
                  <div className="flex items-center gap-3 pt-2">
                    <Skeleton variant="circular" className="w-10 h-10" />
                    <Skeleton variant="rectangular" className="h-8 w-28" />
                  </div>
                </div>

                <div className="pt-4">
                  <LoadingState message="Simulando procesamiento en segundo plano..." />
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right 1 Col: Role Context & Permissions info */}
        <div className="space-y-6">
          <Card variant="default" padding="md">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Contexto del rol actual
            </h4>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-500 block">Rol seleccionado (DEV):</span>
                <span className="text-sm font-bold text-blue-700">{currentRole}</span>
              </div>
              <Badge variant="blue" size="sm">
                VISTA PREVIA
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
              El selector superior permite emular la vista de este rol. Los accesos del menú y las operaciones se ajustan dinámicamente según la matriz de privilegios mínimos (RBAC).
            </p>
          </Card>

          <Card variant="outline" padding="md" className="bg-slate-50 border-slate-200">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Seguridad & Gobernanza
            </h4>
            <p className="text-xs text-slate-800 font-medium">
              Controles Enterprise Activos
            </p>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              Autenticación Supabase con sesiones seguras, tokens JWT y políticas RLS activas en base de datos.
            </p>
          </Card>
        </div>
      </div>

      {/* Component Tester Modal */}
      <Modal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        title="Validación del Sistema de Diseño"
        description="Prueba interactiva de botones, etiquetas y accesibilidad modal."
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button variant="outline" size="sm" onClick={() => setIsTestModalOpen(false)}>
              Cerrar
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Check className="w-4 h-4" />}
              onClick={() => setIsTestModalOpen(false)}
            >
              Confirmar validación
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Este modal implementa cierre con la tecla <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono text-[11px] text-slate-800">ESC</kbd>, clic en fondo oscurecido y contraste de nivel WCAG AA.
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="success" hasDot>
              Aprobado
            </Badge>
            <Badge variant="warning" hasDot>
              Pendiente
            </Badge>
            <Badge variant="error" hasDot>
              Rechazado
            </Badge>
            <Badge variant="info" hasDot>
              En revisión
            </Badge>
          </div>
        </div>
      </Modal>
    </div>
  );
};
