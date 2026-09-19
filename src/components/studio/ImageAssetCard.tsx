/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Star,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink,
  Shield,
  Info,
  Clock,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { ImageAssetModel } from '../../types/imageAsset';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Textarea } from '../ui/Textarea';

export interface ImageAssetCardProps {
  asset: ImageAssetModel;
  onEvaluate?: (assetId: string, rating: number, feedback: string) => Promise<void>;
  onSelectForCampaign?: (asset: ImageAssetModel) => void;
  canEvaluate?: boolean;
}

export const ImageAssetCard: React.FC<ImageAssetCardProps> = ({
  asset,
  onEvaluate,
  onSelectForCampaign,
  canEvaluate = true,
}) => {
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedRating, setSelectedRating] = useState(asset.rating || 0);
  const [feedback, setFeedback] = useState(asset.feedback || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'READY_FOR_REVIEW':
        return <Badge variant="success" size="sm">Pronto para revisão</Badge>;
      case 'MODERATION_REVIEW':
        return <Badge variant="warning" size="sm">Revisão de segurança</Badge>;
      case 'MODERATION_BLOCKED':
        return <Badge variant="error" size="sm">Bloqueado</Badge>;
      case 'GENERATED':
      default:
        return <Badge variant="info" size="sm">Gerado</Badge>;
    }
  };

  const getProviderBadge = (provider: string) => {
    if (provider === 'stability_ai') {
      return <Badge variant="blue" size="sm">Stability AI (SD3.5)</Badge>;
    }
    return <Badge variant="neutral" size="sm">Fornecedor de contingência (Fallback)</Badge>;
  };

  const handleSaveEvaluation = async () => {
    if (selectedRating < 1 || !onEvaluate) return;
    setIsSubmitting(true);
    try {
      await onEvaluate(asset.id, selectedRating, feedback);
      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
        setIsEvaluating(false);
      }, 1500);
    } catch {
      // Handled by parent toast/notifier
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="group rounded-2xl bg-white border border-slate-200 overflow-hidden flex flex-col hover:border-blue-400 transition-all duration-200 shadow-sm">
      {/* Image Preview Area */}
      <div className="relative aspect-square w-full bg-slate-100 overflow-hidden flex items-center justify-center">
        {asset.public_url ? (
          <img
            src={asset.public_url}
            alt={asset.prompt}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="text-center p-6 text-slate-400 flex flex-col items-center">
            <Sparkles className="w-8 h-8 text-slate-400 mb-2" />
            <span className="text-xs">Visual não disponível</span>
          </div>
        )}

        {/* Top Floating Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <div className="flex gap-1.5 flex-wrap">
            {getStatusBadge(asset.status)}
            {getProviderBadge(asset.provider)}
          </div>
          <div className="bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-mono text-slate-700 border border-slate-200 shadow-sm">
            {asset.aspect_ratio}
          </div>
        </div>

        {/* Evaluation Rating Star Badge (if rated) */}
        {asset.rating && !isEvaluating && (
          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-amber-200 text-xs font-medium text-amber-700 shadow-sm">
            <div className="flex text-amber-500">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-3.5 h-3.5 ${
                    i < asset.rating! ? 'fill-amber-400 text-amber-500' : 'text-slate-300'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-bold text-slate-800">({asset.rating}/5)</span>
          </div>
        )}
      </div>

      {/* Card Content & Metadata */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          {/* Prompt excerpt */}
          <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed" title={asset.prompt}>
            <span className="font-semibold text-blue-700">Prompt: </span>
            {asset.prompt}
          </p>

          {/* Technical Specs Pill row */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-500">
            <span className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
              <Layers className="w-3 h-3 text-blue-600" />
              {asset.style}
            </span>
            <span className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
              <Clock className="w-3 h-3 text-slate-500" />
              {asset.generation_duration_ms ? `${(asset.generation_duration_ms / 1000).toFixed(1)}s` : '3.0s'}
            </span>
            <span className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
              <DollarSign className="w-3 h-3 text-emerald-600" />
              {asset.estimated_cost || '0.030 USD'}
            </span>
          </div>

          {/* Feedback note if present */}
          {asset.feedback && !isEvaluating && (
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 italic">
              "{asset.feedback}"
            </div>
          )}

          {/* Moderation Notes if present */}
          {asset.moderation_notes && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
              <span>{asset.moderation_notes}</span>
            </div>
          )}
        </div>

        {/* Interactive Evaluation Form or Actions */}
        {isEvaluating ? (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900">Avaliação criativa:</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className="p-1 hover:scale-110 transition-transform focus:outline-none"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setSelectedRating(star)}
                  >
                    <Star
                      className={`w-4 h-4 ${
                        star <= (hoverRating || selectedRating)
                          ? 'fill-amber-400 text-amber-500'
                          : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Comentário sobre fidelidade ao briefing, estética ou sugestões de refinamento..."
              rows={2}
              className="text-xs"
            />

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEvaluating(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveEvaluation}
                disabled={selectedRating < 1 || isSubmitting}
                isLoading={isSubmitting}
              >
                {submitSuccess ? 'Guardado!' : 'Guardar classificação'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500 font-mono">
              {new Date(asset.created_at).toLocaleDateString('pt-PT')}
            </span>

            <div className="flex items-center gap-1.5">
              {canEvaluate && (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Star className="w-3.5 h-3.5 text-amber-500" />}
                  onClick={() => setIsEvaluating(true)}
                >
                  {asset.rating ? 'Reavaliar' : 'Classificar'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
