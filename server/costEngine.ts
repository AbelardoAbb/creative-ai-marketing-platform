/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CalculationStatus,
  CostCalculationInput,
  CostCalculationResult,
  PricingModelConfig,
} from '../src/types/cost';

/**
 * Enterprise Pricing Catalog
 * Decoupled from core business logic so pricing rules, tiers, and provider updates
 * can be maintained without altering execution pipelines.
 */
export const DEFAULT_PRICING_CATALOG: PricingModelConfig[] = [
  {
    id: 'pricing-anthropic-claude-3-5-sonnet',
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    type: 'token_based',
    currency: 'USD',
    inputCostPer1kTokens: 0.003, // $3.00 per million input tokens
    outputCostPer1kTokens: 0.015, // $15.00 per million output tokens
    requiresLiveCredential: true,
    notes: 'Preço oficial Anthropic Claude 3.5 Sonnet (Outubro 2024)',
    lastUpdated: '2026-09-15',
  },
  {
    id: 'pricing-anthropic-claude-3-haiku',
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    type: 'token_based',
    currency: 'USD',
    inputCostPer1kTokens: 0.00025,
    outputCostPer1kTokens: 0.00125,
    requiresLiveCredential: true,
    notes: 'Preço oficial Anthropic Claude 3 Haiku',
    lastUpdated: '2026-09-15',
  },
  {
    id: 'pricing-stability-image-core',
    provider: 'stability_ai',
    model: 'stable-image-core',
    type: 'unit_based',
    currency: 'USD',
    costPerUnit: 0.03, // $0.03 per generated output
    requiresLiveCredential: true,
    notes: 'Preço oficial Stability AI Stable Image Core (3 créditos = $0.03)',
    lastUpdated: '2026-09-15',
  },
  {
    id: 'pricing-stability-image-ultra',
    provider: 'stability_ai',
    model: 'stable-image-ultra',
    type: 'unit_based',
    currency: 'USD',
    costPerUnit: 0.08,
    requiresLiveCredential: true,
    notes: 'Preço oficial Stability AI Stable Image Ultra (8 créditos = $0.08)',
    lastUpdated: '2026-09-15',
  },
  {
    id: 'pricing-stability-sd3',
    provider: 'stability_ai',
    model: 'sd3-large',
    type: 'unit_based',
    currency: 'USD',
    costPerUnit: 0.065,
    requiresLiveCredential: true,
    notes: 'Preço oficial Stability AI Stable Diffusion 3.5 Large (6.5 créditos)',
    lastUpdated: '2026-09-15',
  },
];

export class CostEngine {
  private pricingCatalog: Map<string, PricingModelConfig> = new Map();

  constructor(initialCatalog: PricingModelConfig[] = DEFAULT_PRICING_CATALOG) {
    initialCatalog.forEach((p) => {
      this.pricingCatalog.set(this.buildCatalogKey(p.provider, p.model), p);
    });
  }

  private buildCatalogKey(provider: string, model: string): string {
    return `${provider.toLowerCase()}::${model.toLowerCase()}`;
  }

  public getPricingCatalog(): PricingModelConfig[] {
    return Array.from(this.pricingCatalog.values());
  }

  public registerPricingModel(config: PricingModelConfig): void {
    this.pricingCatalog.set(this.buildCatalogKey(config.provider, config.model), config);
  }

  /**
   * Central cost calculation function.
   * Adheres strictly to:
   * 1. Never fabricate metrics.
   * 2. When information is unavailable, returns null cost and calculation_status: 'COST_UNKNOWN'.
   * 3. If fallback provider or missing live credentials, returns 'COST_UNKNOWN'.
   * 4. If token counts or unit counts are present and pricing is configured, computes cost and returns 'KNOWN' or 'ESTIMATED'.
   */
  public calculateCost(input: CostCalculationInput): CostCalculationResult {
    const { provider, model, usage, metadata } = input;

    // 1. Fallback / Prototype check
    // Phase 10B Requirement 24: If real Stability AI generation has not yet been executed with valid credentials,
    // record COST_UNKNOWN until actual provider usage/pricing can be reliably established.
    if (
      provider === 'fallback_provider' ||
      usage?.isFallback === true ||
      (usage?.hasLiveCredential === false && provider === 'stability_ai')
    ) {
      return {
        estimated_cost: null,
        currency: 'USD',
        calculation_status: 'COST_UNKNOWN',
        explanation: 'Geração local em ambiente de prototipagem/fallback sem consumo de créditos de faturamento de produção.',
      };
    }

    // 2. Lookup pricing configuration
    const pricingConfig = this.pricingCatalog.get(this.buildCatalogKey(provider, model));
    if (!pricingConfig) {
      return {
        estimated_cost: null,
        currency: 'USD',
        calculation_status: 'COST_UNKNOWN',
        explanation: `Modelo '${model}' do provedor '${provider}' não possui tabela de preços configurada no sistema.`,
      };
    }

    // 3. Token-based calculation (e.g. Anthropic Claude, text models)
    if (pricingConfig.type === 'token_based') {
      const inputTokens = usage?.inputTokens;
      const outputTokens = usage?.outputTokens;

      // If tokens are unknown, null, or undefined, do not fabricate!
      if (inputTokens === undefined || outputTokens === undefined || inputTokens === null || outputTokens === null) {
        return {
          estimated_cost: null,
          currency: 'USD',
          calculation_status: 'COST_UNKNOWN',
          pricing_model_id: pricingConfig.id,
          explanation: 'Contagem de tokens não reportada pelo provedor ou requisição retida antes da conclusão da inferência.',
        };
      }

      const inCostPer1k = pricingConfig.inputCostPer1kTokens || 0;
      const outCostPer1k = pricingConfig.outputCostPer1kTokens || 0;

      const cost = (inputTokens / 1000) * inCostPer1k + (outputTokens / 1000) * outCostPer1k;
      const roundedCost = Math.round(cost * 1000000) / 1000000;

      // Check if tokens were actual or estimated
      const isEstimated = usage?.tokensEstimated === true || metadata?.tokensEstimated === true;

      return {
        estimated_cost: roundedCost,
        currency: 'USD',
        calculation_status: isEstimated ? 'ESTIMATED' : 'KNOWN',
        pricing_model_id: pricingConfig.id,
        explanation: `Cálculo baseado em ${inputTokens} tokens de entrada ($${inCostPer1k}/1k) e ${outputTokens} tokens de saída ($${outCostPer1k}/1k).`,
      };
    }

    // 4. Unit-based calculation (e.g. Stability AI image generation)
    if (pricingConfig.type === 'unit_based') {
      const units = usage?.imagesCount !== undefined && usage?.imagesCount !== null ? usage.imagesCount : 1;

      if (pricingConfig.requiresLiveCredential && usage?.hasLiveCredential === false) {
        return {
          estimated_cost: null,
          currency: 'USD',
          calculation_status: 'COST_UNKNOWN',
          pricing_model_id: pricingConfig.id,
          explanation: 'Operação sem credencial de produção ativa; custo de créditos não faturável.',
        };
      }

      const costPerUnit = pricingConfig.costPerUnit || 0;
      const totalCost = Math.round(units * costPerUnit * 1000) / 1000;

      return {
        estimated_cost: totalCost,
        currency: 'USD',
        calculation_status: 'KNOWN',
        pricing_model_id: pricingConfig.id,
        explanation: `Cálculo de inferência visual para ${units} imagem(ns) a $${costPerUnit} por unidade.`,
      };
    }

    return {
      estimated_cost: null,
      currency: 'USD',
      calculation_status: 'COST_UNKNOWN',
      explanation: 'Estrutura de precificação não suportada.',
    };
  }
}

export const costEngine = new CostEngine();
