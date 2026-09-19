/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Image as ImageIcon,
  Layers,
  Filter,
  RefreshCw,
  Search,
  Sparkles,
  Building2,
  Calendar,
  Star,
} from 'lucide-react';
import { ImageAssetModel } from '../../types/imageAsset';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Select } from '../ui/Select';
import { ImageAssetCard } from '../studio/ImageAssetCard';
import { LoadingState } from '../ui/LoadingState';
import { EmptyState } from '../ui/EmptyState';

export interface GalleryViewProps {
  onNavigateToCampaign?: (campaignId: string) => void;
}

export const GalleryView: React.FC<GalleryViewProps> = ({ onNavigateToCampaign }) => {
  const { user, session } = useAuth();
  const [assets, setAssets] = useState<ImageAssetModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-id': user?.id || 'anonymous',
      'x-user-role': user?.role || 'Designer',
      'x-user-email': user?.email || '',
      'x-user-name': user?.displayName || '',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  };

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const url = statusFilter !== 'all' ? `/api/assets?status=${statusFilter}` : '/api/assets';
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets || []);
      }
    } catch {
      // Handled gracefully
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [statusFilter]);

  const handleEvaluate = async (assetId: string, rating: number, feedback: string) => {
    const res = await fetch(`/api/assets/${assetId}/evaluate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ rating, feedback }),
    });

    if (res.ok) {
      const data = await res.json();
      setAssets((prev) =>
        prev.map((a) => (a.id === assetId ? data.asset : a))
      );
    }
  };

  const filteredAssets = assets.filter((asset) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      asset.prompt.toLowerCase().includes(q) ||
      asset.style.toLowerCase().includes(q) ||
      (asset.feedback && asset.feedback.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-100">
            <ImageIcon className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                Galeria Geral de Ativos Criativos
              </h2>
              <Badge variant="blue" size="sm">Fase 7 Ativa</Badge>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Repositório central de ativos visuais gerados através de Stability AI e Fornecedor de Contingência com avaliação editorial humana.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAssets}
            leftIcon={<RefreshCw className="w-4 h-4 text-slate-600" />}
          >
            Atualizar
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar por prompt, estilo ou termos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Filtrar por estado:</span>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-48 text-xs"
            options={[
              { value: 'all', label: 'Todos os estados' },
              { value: 'GENERATED', label: 'Gerados (Em espera)' },
              { value: 'READY_FOR_REVIEW', label: 'Pronto para revisão' },
              { value: 'MODERATION_REVIEW', label: 'Em revisão de moderação' },
            ]}
          />
        </div>
      </div>

      {/* Grid of Image Assets */}
      {loading ? (
        <LoadingState message="A carregar galeria de ativos visuais..." />
      ) : filteredAssets.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssets.map((asset) => (
            <ImageAssetCard
              key={asset.id}
              asset={asset}
              onEvaluate={handleEvaluate}
              canEvaluate={true}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nenhum ativo visual encontrado"
          description={
            searchQuery
              ? 'Não foram encontrados resultados para os termos inseridos.'
              : 'Gere novos ativos a partir do Estúdio de Imagem em qualquer campanha autorizada.'
          }
        />
      )}
    </div>
  );
};
