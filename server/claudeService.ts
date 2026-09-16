/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  ClaudeGenerationResult,
  ContentOperation,
  StructuredCampaignTextContext,
  ContentChannel,
} from '../src/types/content';
import { buildClaudePrompt } from './claudePromptBuilder';

export class ClaudeTextService {
  private client: Anthropic | null = null;
  private readonly defaultModel = 'claude-3-5-sonnet-20241022';

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey && apiKey.trim() && !apiKey.startsWith('sk-ant-api...')) {
      this.client = new Anthropic({ apiKey: apiKey.trim() });
    }
  }

  /**
   * Returns whether Anthropic Claude is configured with a real API key.
   */
  public isConfigured(): boolean {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    return Boolean(apiKey && apiKey.trim() && !apiKey.startsWith('sk-ant-api...'));
  }

  /**
   * Generates or transforms marketing content using official Anthropic Claude API.
   * Strictly enforces:
   * - If ANTHROPIC_API_KEY is missing -> BLOCKED
   * - No simulation or fake Claude responses
   * - No silent provider replacement
   * - Captures exact tokens or reports TOKEN_USAGE_UNKNOWN
   * - Reports exact cost or COST_UNKNOWN
   */
  public async processContent(params: {
    operation: ContentOperation;
    context: StructuredCampaignTextContext;
    channel?: ContentChannel;
    sourceContent?: string;
    userInstructions?: string;
    targetAudienceOverride?: string;
    toneOverride?: string;
    languageOverride?: string;
  }): Promise<ClaudeGenerationResult> {
    const { operation, context, channel, sourceContent, userInstructions } = params;

    // Check configuration
    if (!this.isConfigured()) {
      return {
        success: false,
        provider: 'anthropic',
        model: this.defaultModel,
        operation,
        status: 'BLOCKED',
        tokensInput: 'TOKEN_USAGE_UNKNOWN',
        tokensOutput: 'TOKEN_USAGE_UNKNOWN',
        estimatedCost: 'COST_UNKNOWN',
        errorMessage:
          'ANTHROPIC_API_KEY is unavailable. Claude provider is BLOCKED. Simulation or fake AI responses are strictly disallowed.',
        statusCode: 503,
      };
    }

    // Lazy initialization of client if key was loaded later
    if (!this.client) {
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!.trim() });
    }

    const { systemPrompt, userPrompt } = buildClaudePrompt({
      operation,
      context,
      channel,
      sourceContent,
      userInstructions,
      targetAudienceOverride: params.targetAudienceOverride,
      toneOverride: params.toneOverride,
      languageOverride: params.languageOverride,
    });

    const startTime = Date.now();

    try {
      // Call official Anthropic SDK
      const response = await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const durationMs = Date.now() - startTime;

      // Extract generated text from response blocks
      let generatedText = '';
      for (const block of response.content) {
        if (block.type === 'text') {
          generatedText += block.text;
        }
      }

      // Exact token usage if reported by Anthropic API
      const inputTokens = response.usage?.input_tokens ?? 'TOKEN_USAGE_UNKNOWN';
      const outputTokens = response.usage?.output_tokens ?? 'TOKEN_USAGE_UNKNOWN';

      // Cost calculation only if token counts are exact numbers
      let costString = 'COST_UNKNOWN';
      if (typeof inputTokens === 'number' && typeof outputTokens === 'number') {
        // Claude 3.5 Sonnet pricing: $3 / million input, $15 / million output
        const cost = (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15;
        costString = `$${cost.toFixed(5)} USD`;
      }

      // If variations operation, extract array
      let variations: string[] | undefined;
      if (operation === 'variations') {
        const parts = generatedText
          .split(/\n(?=\d+\.\s)/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (parts.length > 1) {
          variations = parts;
        }
      }

      return {
        success: true,
        provider: 'anthropic',
        model: this.defaultModel,
        operation,
        generatedContent: generatedText.trim(),
        variations,
        durationMs,
        tokensInput: inputTokens,
        tokensOutput: outputTokens,
        estimatedCost: costString,
        status: 'COMPLETED',
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const anyErr = err as any;

      let status: 'RATE_LIMITED' | 'TIMEOUT' | 'VALIDATION_ERROR' | 'CONTROLLED_ERROR' = 'CONTROLLED_ERROR';
      let statusCode = 500;
      let errorMessage = 'An error occurred while communicating with Anthropic Claude.';

      if (anyErr?.status === 429) {
        status = 'RATE_LIMITED';
        statusCode = 429;
        errorMessage = 'Anthropic Claude rate limit exceeded. Please try again shortly.';
      } else if (anyErr?.code === 'ETIMEDOUT' || anyErr?.message?.includes('timeout')) {
        status = 'TIMEOUT';
        statusCode = 504;
        errorMessage = 'Request to Anthropic Claude timed out.';
      } else if (anyErr?.status === 400) {
        status = 'VALIDATION_ERROR';
        statusCode = 400;
        errorMessage = anyErr?.message || 'Invalid request payload sent to Anthropic API.';
      } else if (anyErr?.message) {
        errorMessage = anyErr.message;
      }

      return {
        success: false,
        provider: 'anthropic',
        model: this.defaultModel,
        operation,
        durationMs,
        tokensInput: 'TOKEN_USAGE_UNKNOWN',
        tokensOutput: 'TOKEN_USAGE_UNKNOWN',
        estimatedCost: 'COST_UNKNOWN',
        status,
        errorMessage,
        statusCode,
      };
    }
  }
}

export const claudeService = new ClaudeTextService();
