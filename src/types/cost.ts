/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CalculationStatus = 'KNOWN' | 'ESTIMATED' | 'COST_UNKNOWN';

export type TokenUsageStatus = 'KNOWN' | 'ESTIMATED' | 'TOKEN_USAGE_UNKNOWN';

export type AIOperationStatus = 'SUCCESS' | 'BLOCKED' | 'FAILED' | 'UNKNOWN';

export type AIModerationAuditStatus =
  | 'LOW_RISK'
  | 'MEDIUM_RISK'
  | 'HIGH_RISK'
  | 'REQUIRES_HUMAN_REVIEW'
  | 'UNKNOWN';

export interface PricingModelConfig {
  id: string;
  provider: string;
  model: string;
  type: 'token_based' | 'unit_based';
  currency: 'USD';
  inputCostPer1kTokens?: number;
  outputCostPer1kTokens?: number;
  costPerUnit?: number;
  requiresLiveCredential?: boolean;
  notes?: string;
  lastUpdated: string;
}

export interface CostCalculationInput {
  provider: string;
  model: string;
  operation: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    tokensEstimated?: boolean;
    imagesCount?: number;
    resolution?: string;
    isFallback?: boolean;
    hasLiveCredential?: boolean;
  };
  metadata?: Record<string, any>;
}

export interface CostCalculationResult {
  estimated_cost: number | null;
  currency: 'USD' | null;
  calculation_status: CalculationStatus;
  pricing_model_id?: string;
  explanation?: string;
}

export interface CostSummaryMetrics {
  totalKnownCostUSD: number;
  totalEstimatedCostUSD: number;
  unknownCostOperationsCount: number;
  hasPartialCostWarning: boolean;
  partialCostNotice: string;
  costByProvider: Record<
    string,
    {
      knownUSD: number;
      estimatedUSD: number;
      unknownCount: number;
      totalOperations: number;
    }
  >;
  costByCampaign: Array<{
    campaignId: string;
    campaignName: string;
    knownCostUSD: number;
    estimatedCostUSD: number;
    unknownOperationsCount: number;
    hasPartialCostWarning: boolean;
    operationsBreakdown: Array<{
      provider: string;
      operation: string;
      costUSD: number | null;
      costStatus: CalculationStatus;
      count: number;
    }>;
  }>;
  costByUser: Array<{
    userId: string;
    userName: string;
    userRole: string;
    totalGenerations: number;
    textOperations: number;
    imageOperations: number;
    knownCostUSD: number;
    estimatedCostUSD: number;
    unknownCostOperationsCount: number;
  }>;
}

export interface ROIFrameworkMetrics {
  status: 'ROI_DATA_NOT_AVAILABLE';
  reason: string;
  availableInputs: {
    aiOperationalKnownCostUSD: number;
    aiOperationalEstimatedCostUSD: number;
    productionWorkflowTimeTotalMs: number;
    totalAiOperations: number;
  };
  unavailableInputs: string[];
  disclaimer: string;
}
