/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sparkles, AlertCircle, X, Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { CreateCampaignPayload } from '../../types/campaign';

export interface CampaignCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateCampaignPayload) => Promise<{ success: boolean; error?: string }>;
}

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

const TONE_OPTIONS = [
  { value: 'Profissional e Persuasivo', label: 'Profissional e Persuasivo (Padrão B2B)' },
  { value: 'Inspirador e Próximo', label: 'Inspirador e Próximo (Lifestyle e Bem-estar)' },
  { value: 'Enérgico e Dinâmico', label: 'Enérgico e Dinâmico (Retalho e Tecnologia)' },
  { value: 'Técnico e Fiável', label: 'Técnico e Fiável (Finanças e Infraestrutura)' },
  { value: 'Descontraído e Jovem', label: 'Descontraído e Jovem (Geração Z)' },
  { value: 'Sofisticado e Exclusivo', label: 'Sofisticado e Exclusivo (Premium e Luxo)' },
];

export const CampaignCreateModal: React.FC<CampaignCreateModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [productOrService, setProductOrService] = useState('');
  const [objective, setObjective] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [keyMessage, setKeyMessage] = useState('');
  const [toneOfVoice, setToneOfVoice] = useState('Profissional e Persuasivo');
  const [language, setLanguage] = useState('pt-PT');
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['Instagram', 'LinkedIn']);
  const [visualDirection, setVisualDirection] = useState('');
  const [creativeConstraints, setCreativeConstraints] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleChannel = (channel: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('O nome da campanha é obrigatório.');
      return;
    }
    if (!objective.trim()) {
      setError('O objetivo principal da campanha é obrigatório.');
      return;
    }

    setLoading(true);
    try {
      const payload: CreateCampaignPayload = {
        name: name.trim(),
        client: client.trim() || 'Geral',
        product_or_service: productOrService.trim() || undefined,
        campaign_objective: objective.trim(),
        target_audience: targetAudience.trim() || undefined,
        key_message: keyMessage.trim() || undefined,
        tone_of_voice: toneOfVoice,
        language: language.trim() || 'pt-PT',
        channels: selectedChannels.length > 0 ? selectedChannels : ['Instagram', 'LinkedIn'],
        visual_direction: visualDirection.trim() || undefined,
        creative_constraints: creativeConstraints.trim() || undefined,
      };

      const result = await onSubmit(payload);
      if (result.success) {
        onClose();
      } else {
        setError(result.error || 'Erro ao criar a campanha.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar a campanha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl my-8 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-100 text-blue-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Nova Campanha e Briefing</h3>
              <p className="text-xs text-slate-500">
                Configure os metadados e diretrizes criativas que impulsionarão a geração de IA.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Scrollable Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-red-700 text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Identificação & Cliente */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              1. Identificação da Campanha
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nome da Campanha *"
                placeholder="Ex: Primavera Sustentável 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                label="Cliente / Marca *"
                placeholder="Ex: EcoVibe Cosméticos"
                value={client}
                onChange={(e) => setClient(e.target.value)}
              />
            </div>
            <Input
              label="Produto ou Serviço em Foco"
              placeholder="Ex: Linha Bio-Active Skincare Hidratante"
              value={productOrService}
              onChange={(e) => setProductOrService(e.target.value)}
            />
          </div>

          {/* Section 2: Estratégia & Briefing */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              2. Estratégia e Objetivos de Negócio
            </h4>
            <Textarea
              label="Objetivo Principal da Campanha *"
              placeholder="Ex: Gerar 15.000 inscrições para lista de espera e posicionar a marca como pioneira em embalagens compostáveis."
              rows={3}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Textarea
                label="Público-Alvo e Demografia"
                placeholder="Ex: Mulheres e homens de 22 a 40 anos, perfil sustentável e consumidor consciente."
                rows={2}
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
              />
              <Textarea
                label="Mensagem-Chave (Key Message)"
                placeholder="Ex: Cuidado genuíno da sua pele e respeito absoluto pelo planeta."
                rows={2}
                value={keyMessage}
                onChange={(e) => setKeyMessage(e.target.value)}
              />
            </div>
          </div>

          {/* Section 3: Voz, Tom & Canais */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              3. Tom de Voz e Canais de Distribuição
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Tom de Voz Primário"
                options={TONE_OPTIONS}
                value={toneOfVoice}
                onChange={(e) => setToneOfVoice(e.target.value)}
              />
              <Input
                label="Idioma Principal"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="pt-PT"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 block mb-2">
                Canais de Ativação
              </label>
              <div className="flex flex-wrap gap-2">
                {CHANNEL_OPTIONS.map((ch) => {
                  const isSelected = selectedChannels.includes(ch);
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
          </div>

          {/* Section 4: Diretrizes Criativas & Restrições */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              4. Diretrizes Visuais e Restrições de Marca
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Textarea
                label="Direção Visual e Estilo"
                placeholder="Ex: Fotografia com luz solar natural matinal, tons botânicos, acabamento mate e sem brilhos artificiais."
                rows={2}
                value={visualDirection}
                onChange={(e) => setVisualDirection(e.target.value)}
              />
              <Textarea
                label="Restrições Criativas (Negative Constraints)"
                placeholder="Ex: Não utilizar animais em cativeiro, não incluir embalagens de plástico nas cenas. Destacar certificação biológica."
                rows={2}
                value={creativeConstraints}
                onChange={(e) => setCreativeConstraints(e.target.value)}
              />
            </div>
          </div>

          {/* Footer Action Bar */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={loading}
              leftIcon={<Sparkles className="w-4 h-4" />}
            >
              Criar Campanha e Briefing
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
