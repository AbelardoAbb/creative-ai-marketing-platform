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
      title: 'Painel Principal',
      subtitle: 'Visão geral da operação criativa',
      icon: <Layers className="w-6 h-6 text-blue-600" />,
      targetPhase: 'Fase 3 (Ativa)',
      integrationPoints: ['Métricas consolidadas de campanhas e produções'],
    },
    campaigns: {
      title: 'Gestão de Campanhas e Briefings',
      subtitle: 'Criação e organização de campanhas de marketing, público-alvo e clientes',
      icon: <FolderKanban className="w-6 h-6 text-blue-600" />,
      targetPhase: 'Fase 6 — Campanhas',
      integrationPoints: [
        'Tabela `campaigns` e `campaign_members` no Supabase',
        'Políticas RLS por pertença a membros',
        'Briefing estruturado para geração de IA',
      ],
    },
    'generate-image': {
      title: 'Estúdio de Geração de Imagens',
      subtitle: 'Criação de ativos visuais personalizados com Stability AI e fallback',
      icon: <Sparkles className="w-6 h-6 text-blue-600" />,
      targetPhase: 'Fase 7 — Geração Visual',
      integrationPoints: [
        'Fornecedor principal: Stability AI (Stable Diffusion API)',
        'Fornecedor de recurso: FallbackImageProvider (com auditoria explícita)',
        'Moderação prévia de prompt (Input Moderation)',
        'Armazenamento direto no Supabase Storage',
      ],
    },
    'create-content': {
      title: 'Estúdio de Redação e Copywriting',
      subtitle: 'Editor profissional integrado com Claude (Anthropic API) em vista comparativa',
      icon: <PenTool className="w-6 h-6 text-blue-600" />,
      targetPhase: 'Fase 8 & 9 — Claude & Editor',
      integrationPoints: [
        'Fornecedor principal: Claude (Anthropic Messages API)',
        'Envio de contexto estruturado (Objetivo, Canal, Audiência, Tom)',
        'Editor de comparação Original vs. Assistido',
        'Controlo de versões contínuo em `content_versions`',
      ],
    },
    gallery: {
      title: 'Galeria de Ativos Visuais',
      subtitle: 'Repositório de imagens geradas, metadados de inferência e envio para aprovação',
      icon: <ImageIcon className="w-6 h-6 text-blue-600" />,
      targetPhase: 'Fase 7 & 11 — Galeria & Aprovações',
      integrationPoints: [
        'Listagem de ativos persistidos no Supabase Storage',
        'Filtros por campanha, autor e estado de aprovação',
        'Inspeção detalhada de metadados técnicos de geração',
      ],
    },
    approvals: {
      title: 'Fluxo de Aprovação e Controlo de Qualidade',
      subtitle: 'Fila de revisão para Aprovadores com regra estrita: o criador não aprova o seu próprio conteúdo',
      icon: <CheckCircle2 className="w-6 h-6 text-emerald-600" />,
      targetPhase: 'Fase 11 — Fluxo de Aprovação',
      integrationPoints: [
        'Tabela `approvals` no Supabase com integridade referencial',
        'Validação de autorização no servidor (anti-autoaprovação)',
        'Justificação obrigatória em caso de rejeição',
      ],
    },
    collaboration: {
      title: 'Colaboração e Comentários',
      subtitle: 'Discussão contextual entre Designers, Copywriters e Aprovadores',
      icon: <MessageSquare className="w-6 h-6 text-blue-600" />,
      targetPhase: 'Fase 10 — Colaboração',
      integrationPoints: [
        'Comentários em tópicos vinculados a campanhas e peças',
        'Notificações de menções e tarefas atribuídas',
      ],
    },
    history: {
      title: 'Histórico e Controlo de Versões',
      subtitle: 'Restauração de versões anteriores e rastreabilidade de alterações editoriais',
      icon: <History className="w-6 h-6 text-blue-600" />,
      targetPhase: 'Fase 12 — Histórico de Versões',
      integrationPoints: [
        'Histórico granular de `content_versions` com diff visual',
        'Restauração autorizada para rascunhos de trabalho',
      ],
    },
    governance: {
      title: 'Governança e Registo de Auditoria',
      subtitle: 'Registo imutável de chamadas de IA, decisões de moderação e classificações',
      icon: <ShieldCheck className="w-6 h-6 text-blue-600" />,
      targetPhase: 'Fase 12 & 13 — Auditoria & Moderação',
      integrationPoints: [
        'Tabelas `activity_logs` e `ai_generations`',
        'Registo de fornecedor real, tempo de resposta, tokens e custo estimado',
        'Classificação de risco (Baixo Risco, Revisão Humana, Bloqueio)',
      ],
    },
    'users-permissions': {
      title: 'Utilizadores e Permissões (RBAC)',
      subtitle: 'Gestão de funções (Designer, Copywriter, Approver, Administrator) e atribuição a campanhas',
      icon: <Users className="w-6 h-6 text-blue-600" />,
      targetPhase: 'Fase 4 & 5 — Autenticação & RBAC',
      integrationPoints: [
        'Supabase Auth com credenciais seguras',
        'Tabelas `roles` e `campaign_members`',
        'Políticas RLS no PostgreSQL para isolamento estrito',
      ],
    },
    'costs-roi': {
      title: 'Custos e Retorno de Investimento (ROI)',
      subtitle: 'Acompanhamento do consumo de inferência, tempo poupado e eficiência operacional',
      icon: <TrendingUp className="w-6 h-6 text-emerald-600" />,
      targetPhase: 'Fase 14 — Métricas & Custos',
      integrationPoints: [
        'Tabela `cost_records` agregando chamadas de texto e imagem',
        'Diferenciação clara entre consumo real e estimativas operacionais',
      ],
    },
    settings: {
      title: 'Configurações da Plataforma',
      subtitle: 'Preferências da organização e estado das integrações de IA e Supabase',
      icon: <Settings className="w-6 h-6 text-slate-500" />,
      targetPhase: 'Configurações',
      integrationPoints: [
        'Estado de conexão Supabase, Claude e Stability AI',
        'Preferências de interface e design corporativo',
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
            Testar componentes UI
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigate('dashboard')}>
            Voltar ao painel
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
              Contrato de integração planeado para esta rota
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mb-4 leading-relaxed">
              Esta secção conta com arquitetura visual completa, componentes reativos acessíveis e persistência integrada conforme os contratos do sistema.
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
              Amostra de componentes reutilizáveis (Design System)
            </h3>

            {/* Tabs Component Demo */}
            <div className="mb-6">
              <Tabs
                tabs={[
                  { id: 'tab-1', label: 'Formulários e campos', badge: '3' },
                  { id: 'tab-2', label: 'Estados de feedback', badge: 'Pronto' },
                  { id: 'tab-3', label: 'Carregamento e esqueletos' },
                ]}
                activeTab={activeTab}
                onChange={(t) => setActiveTab(t)}
              />
            </div>

            {activeTab === 'tab-1' && (
              <div className="space-y-4 max-w-xl">
                <Input
                  label="Título do briefing criativo"
                  placeholder="Ex: Campanha de lançamento Q3..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  helperText="Defina um nome conciso e descritivo para o projeto."
                />

                <Select
                  label="Canal principal de distribuição"
                  value={selectValue}
                  onChange={(e) => setSelectValue(e.target.value)}
                  options={[
                    { value: 'opt-1', label: 'Instagram Ads e Reels' },
                    { value: 'opt-2', label: 'LinkedIn Sponsored Content' },
                    { value: 'opt-3', label: 'E-mail marketing promocional' },
                    { value: 'opt-4', label: 'Display e meios programáticos' },
                  ]}
                />

                <Textarea
                  label="Instruções de estilo e restrições de marca"
                  placeholder="Ex: Não utilizar cores fluorescentes. Manter tom profissional e elegante..."
                  rows={3}
                />

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    variant="primary"
                    onClick={() => {
                      setShowToast(true);
                    }}
                  >
                    Mostrar notificação Toast
                  </Button>
                  <Button variant="secondary" onClick={() => setInputValue('')}>
                    Limpar
                  </Button>
                </div>

                {showToast && (
                  <div className="mt-4">
                    <Toast
                      id="demo-toast"
                      type="success"
                      title="Interação de UI registada"
                      message="O componente Toast foi renderizado cumprindo os padrões de acessibilidade."
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
                    title="Nenhuma peça rejeitada"
                    description="Todas as propostas criativas submetidas foram aprovadas ou estão na fila de revisão."
                    actionLabel="Ver fila de aprovações"
                    onAction={() => onNavigate('approvals')}
                  />
                  <ErrorState
                    title="Simulação de erro de validação"
                    message="Exemplo de estado de erro acessível com botão de nova tentativa controlado."
                    onRetry={() => alert('Ação de nova tentativa executada.')}
                  />
                </div>
              </div>
            )}

            {activeTab === 'tab-3' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-500">
                  Estados de carregamento com Skeleton para transições suaves:
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
                  <LoadingState message="A simular processamento em segundo plano..." />
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right 1 Col: Role Context & Permissions info */}
        <div className="space-y-6">
          <Card variant="default" padding="md">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Contexto da função atual
            </h4>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-500 block">Função selecionada (DEV):</span>
                <span className="text-sm font-bold text-blue-700">{currentRole}</span>
              </div>
              <Badge variant="blue" size="sm">
                PRÉ-VISUALIZAÇÃO
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
              O seletor superior permite emular a visualização desta função. Os acessos do menu e as operações ajustam-se dinamicamente de acordo com a matriz de privilégios mínimos (RBAC).
            </p>
          </Card>

          <Card variant="outline" padding="md" className="bg-slate-50 border-slate-200">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Segurança & Governança
            </h4>
            <p className="text-xs text-slate-800 font-medium">
              Controlos Enterprise Ativos
            </p>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              Autenticação Supabase com sessões seguras, tokens JWT e políticas RLS ativas na base de dados.
            </p>
          </Card>
        </div>
      </div>

      {/* Component Tester Modal */}
      <Modal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        title="Validação do Sistema de Design"
        description="Teste interativo de botões, etiquetas e acessibilidade modal."
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button variant="outline" size="sm" onClick={() => setIsTestModalOpen(false)}>
              Fechar
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Check className="w-4 h-4" />}
              onClick={() => setIsTestModalOpen(false)}
            >
              Confirmar validação
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Este modal implementa encerramento com a tecla <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono text-[11px] text-slate-800">ESC</kbd>, clique no fundo escurecido e contraste de nível WCAG AA.
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="success" hasDot>
              Aprovado
            </Badge>
            <Badge variant="warning" hasDot>
              Pendente
            </Badge>
            <Badge variant="error" hasDot>
              Rejeitado
            </Badge>
            <Badge variant="info" hasDot>
              Em revisão
            </Badge>
          </div>
        </div>
      </Modal>
    </div>
  );
};
