/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FileText,
  Sparkles,
  Save,
  Clock,
  Globe,
  Tag,
  Eye,
  Check,
  AlertTriangle,
  Send,
  Layers,
} from 'lucide-react';
import { CampaignModel, UpdateCampaignPayload, CampaignStatus } from '../../types/campaign';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';

export interface CampaignBriefingTabProps {
  campaign: CampaignModel;
  canEdit: boolean;
  onUpdate: (updates: UpdateCampaignPayload) => Promise<{ success: boolean; error?: string }>;
}

const TONE_OPTIONS = [
  { value: 'Profissional e Persuasivo', label: 'Profissional e Persuasivo (Padrão B2B)' },
  { value: 'Inspirador e Próximo', label: 'Inspirador e Próximo (Lifestyle e Bem-estar)' },
  { value: 'Enérgico e Dinâmico', label: 'Enérgico e Dinâmico (Retalho e Tecnologia)' },
  { value: 'Técnico e Fiável', label: 'Técnico e Fiável (Finanças e Infraestrutura)' },
  { value: 'Descontraído e Jovem', label: 'Descontraído e Jovem (Geração Z)' },
  { value: 'Sofisticado e Exclusivo', label: 'Sofisticado e Exclusivo (Premium e Luxo)' },
];

const CHANNEL_OPTIONS = [
  'Instagram',
  'LinkedIn',
  'TikTok',
  'YouTube',
  'Google Ads',
  'Facebook',
  'Twitter / X',
  'Email Marketing',
  'Meios Exteriores (OOH)',
  'Portal de Notícias',
];

export const CampaignBriefingTab: React.FC<CampaignBriefingTabProps> = ({
  campaign,
  canEdit,
  onUpdate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [name, setName] = useState(campaign.name);
  const [client, setClient] = useState(campaign.client || '');
  const [productOrService, setProductOrService] = useState(campaign.product_or_service || '');
  const [objective, setObjective] = useState(campaign.campaign_objective || '');
  const [targetAudience, setTargetAudience] = useState(campaign.target_audience || '');
  const [keyMessage, setKeyMessage] = useState(campaign.key_message || '');
  const [toneOfVoice, setToneOfVoice] = useState(campaign.tone_of_voice || 'Profissional e Persuasivo');
  const [language, setLanguage] = useState(campaign.language || 'pt-PT');
  const [channels, setChannels] = useState<string[]>(
    Array.isArray(campaign.channels) ? campaign.channels : ['Instagram', 'LinkedIn']
  );
  const [visualDirection, setVisualDirection] = useState(campaign.visual_direction || '');
  const [creativeConstraints, setCreativeConstraints] = useState(campaign.creative_constraints || '');

  const toggleChannel = (ch: string) => {
    setChannels((prev) => (prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]));
  };

  const handleSave = async () => {
    setMessage(null);
    if (!name.trim()) {
      setMessage({ type: 'error', text: 'O nome da campanha é obrigatório.' });
      return;
    }
    if (!objective.trim()) {
      setMessage({ type: 'error', text: 'O objetivo da campanha é obrigatório.' });
      return;
    }

    setLoading(true);
    try {
      const res = await onUpdate({
        name: name.trim(),
        client: client.trim() || 'Geral',
        product_or_service: productOrService.trim() || undefined,
        campaign_objective: objective.trim(),
        target_audience: targetAudience.trim() || undefined,
        key_message: keyMessage.trim() || undefined,
        tone_of_voice: toneOfVoice,
        language: language.trim() || 'pt-PT',
        channels: channels.length > 0 ? channels : ['Instagram', 'LinkedIn'],
        visual_direction: visualDirection.trim() || undefined,
        creative_constraints: creativeConstraints.trim() || undefined,
      });

      if (res.success) {
        setMessage({ type: 'success', text: 'Briefing e diretrizes atualizados com sucesso.' });
        setIsEditing(false);
      } else {
        setMessage({ type: 'error', text: res.error || 'Erro ao guardar as modificações.' });
      }
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao guardar.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar with mode toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">
              Briefing e Matriz de Contexto Criativo
            </h3>
            <Badge variant="blue" size="sm">
              Contexto Pronto para IA
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Estrutura unificada que contextualizará modelos de linguagem (Claude) e difusão visual.
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setName(campaign.name);
                    setClient(campaign.client || '');
                    setProductOrService(campaign.product_or_service || '');
                    setObjective(campaign.campaign_objective || '');
                    setTargetAudience(campaign.target_audience || '');
                    setKeyMessage(campaign.key_message || '');
                    setToneOfVoice(campaign.tone_of_voice || 'Profissional e Persuasivo');
                    setLanguage(campaign.language || 'pt-PT');
                    setChannels(campaign.channels || ['Instagram', 'LinkedIn']);
                    setVisualDirection(campaign.visual_direction || '');
                    setCreativeConstraints(campaign.creative_constraints || '');
                    setIsEditing(false);
                    setMessage(null);
                  }}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  isLoading={loading}
                  leftIcon={<Save className="w-4 h-4" />}
                  onClick={handleSave}
                >
                  Guardar Briefing
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<FileText className="w-4 h-4" />}
                onClick={() => setIsEditing(true)}
              >
                Editar Briefing
              </Button>
            )}
          </div>
        )}
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl border text-xs sm:text-sm flex items-center gap-2.5 ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Editing Mode */}
      {isEditing ? (
        <div className="space-y-6">
          <Card padding="md" className="space-y-4">
            <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              Identificação e Produto
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nome da Campanha *"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                label="Cliente / Marca *"
                value={client}
                onChange={(e) => setClient(e.target.value)}
              />
            </div>
            <Input
              label="Produto ou Serviço"
              value={productOrService}
              onChange={(e) => setProductOrService(e.target.value)}
            />
          </Card>

          <Card padding="md" className="space-y-4">
            <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              Estratégia e Mensagem
            </h4>
            <Textarea
              label="Objetivo Principal *"
              rows={3}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Textarea
                label="Público-Alvo"
                rows={2}
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
              />
              <Textarea
                label="Mensagem-Chave"
                rows={2}
                value={keyMessage}
                onChange={(e) => setKeyMessage(e.target.value)}
              />
            </div>
          </Card>

          <Card padding="md" className="space-y-4">
            <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              Tom e Canais
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Tom de Voz"
                options={TONE_OPTIONS}
                value={toneOfVoice}
                onChange={(e) => setToneOfVoice(e.target.value)}
              />
              <Input
                label="Idioma"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 block mb-2">Canais de Ativação</label>
              <div className="flex flex-wrap gap-2">
                {CHANNEL_OPTIONS.map((ch) => {
                  const isSelected = channels.includes(ch);
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => toggleChannel(ch)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-blue-600" />}
                      {ch}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          <Card padding="md" className="space-y-4">
            <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              Diretrizes e Restrições Visuais
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Textarea
                label="Direção Visual e Estilo"
                rows={3}
                value={visualDirection}
                onChange={(e) => setVisualDirection(e.target.value)}
              />
              <Textarea
                label="Restrições Criativas"
                rows={3}
                value={creativeConstraints}
                onChange={(e) => setCreativeConstraints(e.target.value)}
              />
            </div>
          </Card>
        </div>
      ) : (
        /* Read-Only Structured View */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Briefing 2 Columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Objective Card */}
            <Card padding="md">
              <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider block mb-2">
                Objetivo do Negócio e Campanha
              </span>
              <p className="text-sm sm:text-base text-slate-800 leading-relaxed font-normal">
                {campaign.campaign_objective || 'Nenhum objetivo especificado.'}
              </p>
            </Card>

            {/* Target Audience & Key Message */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card padding="md">
                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider block mb-2">
                  Público-Alvo
                </span>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {campaign.target_audience || 'Geral / Não especificado.'}
                </p>
              </Card>

              <Card padding="md">
                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider block mb-2">
                  Mensagem-Chave
                </span>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {campaign.key_message || 'Foco no posicionamento de marca.'}
                </p>
              </Card>
            </div>

            {/* Creative Directives */}
            <Card padding="md" className="space-y-4">
              <div>
                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider block mb-1.5">
                  Direção Visual e Estética
                </span>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {campaign.visual_direction ||
                    'Seguir identidade visual padrão do cliente e diretrizes de marca.'}
                </p>
              </div>

              {campaign.creative_constraints && (
                <div className="pt-3 border-t border-slate-200">
                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Restrições e Negative Constraints
                  </span>
                  <p className="text-xs sm:text-sm text-amber-800 leading-relaxed">
                    {campaign.creative_constraints}
                  </p>
                </div>
              )}
            </Card>
          </div>

          {/* Right Column: AI Specs & Distribution */}
          <div className="space-y-6">
            {/* Tone & Language Card */}
            <Card padding="md" className="space-y-4">
              <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider block">
                Parâmetros Editoriais
              </span>

              <div>
                <span className="text-[11px] text-slate-500 block">Tom de Voz</span>
                <span className="text-xs sm:text-sm font-medium text-slate-800 block mt-0.5">
                  {campaign.tone_of_voice || 'Profissional e Persuasivo'}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-slate-500 block">Idioma Principal</span>
                <span className="text-xs sm:text-sm font-medium text-slate-800 block mt-0.5">
                  {campaign.language || 'pt-PT'}
                </span>
              </div>

              {campaign.product_or_service && (
                <div>
                  <span className="text-[11px] text-slate-500 block">Produto / Serviço</span>
                  <span className="text-xs sm:text-sm font-medium text-slate-800 block mt-0.5">
                    {campaign.product_or_service}
                  </span>
                </div>
              )}
            </Card>

            {/* Channels Card */}
            <Card padding="md" className="space-y-3">
              <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider block">
                Canais de Ativação
              </span>
              <div className="flex flex-wrap gap-1.5">
                {campaign.channels && campaign.channels.length > 0 ? (
                  campaign.channels.map((channel) => (
                    <span
                      key={channel}
                      className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs text-slate-700"
                    >
                      {channel}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">Nenhum canal selecionado</span>
                )}
              </div>
            </Card>

            {/* AI Contract Preview Box */}
            <Card padding="md" className="bg-blue-50/60 border-blue-200 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold text-blue-800">
                  Integração com Claude e SD
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Este briefing está pronto para ser consumido automaticamente pelo gerador de textos (Claude) e pelo estúdio de imagens.
              </p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
