/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ModerationResult } from '../src/types/imageAsset';

/**
 * MVP Input Moderation Layer (Deterministic Safety Filter).
 * 
 * NOTE (Documentation compliance):
 * This is an MVP deterministic moderation layer evaluating harmful requests,
 * prohibited content, unsafe adult terms, privacy-sensitive keywords, and potentially abusive content.
 * It is clearly documented as MVP moderation and does NOT claim comprehensive AI safety.
 */

// Categorized keyword patterns
const PROHIBITED_PATTERNS: { category: string; regex: RegExp; risk: 'HIGH_RISK' | 'MEDIUM_RISK' }[] = [
  // 1. CSAM, extreme violence, self-harm, illegal acts (HIGH_RISK)
  {
    category: 'violence_gore',
    regex: /\b(gore|decapitation|mutilat|dismember|torture|bloodbath|massacre|terrorist|suicide|self-harm)\b/i,
    risk: 'HIGH_RISK',
  },
  {
    category: 'child_safety',
    regex: /\b(csam|child abuse|underage nude|pedophil|minor nsfw)\b/i,
    risk: 'HIGH_RISK',
  },
  {
    category: 'hate_speech',
    regex: /\b(nazi|swastika|holocaust denial|white supremacy|hate crime|genocide)\b/i,
    risk: 'HIGH_RISK',
  },
  {
    category: 'weapons_explosives',
    regex: /\b(pipe bomb|dirty bomb|anthrax weapon|bioweapon|assassination)\b/i,
    risk: 'HIGH_RISK',
  },
  {
    category: 'explicit_nsfw',
    regex: /\b(hardcore porn|pornography|penetration|explicit sexual|genitalia|undressed minor)\b/i,
    risk: 'HIGH_RISK',
  },

  // 2. Sensitive privacy, non-consensual deepfakes, suspicious PII requests (MEDIUM_RISK)
  {
    category: 'pii_and_credentials',
    regex: /\b(cpf|rg|ssn|social security number|credit card number|senha vazada|confidential passport)\b/i,
    risk: 'MEDIUM_RISK',
  },
  {
    category: 'deepfake_celebrity',
    regex: /\b(deepfake|compromised photo of|fake scandal photo|nude leak)\b/i,
    risk: 'MEDIUM_RISK',
  },
  {
    category: 'controversial_political',
    regex: /\b(propaganda politica ilegal|fake ballot|eleicoes fraudadas)\b/i,
    risk: 'MEDIUM_RISK',
  },
];

/**
 * Evaluates combined prompt & context inputs against the moderation matrix.
 */
export function evaluateInputModeration(
  userPrompt: string,
  additionalInstructions?: string,
  negativePrompt?: string
): ModerationResult {
  const fullText = [userPrompt, additionalInstructions, negativePrompt]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const matchedCategories: string[] = [];
  let highestRisk: 'LOW_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK' = 'LOW_RISK';
  let matchedReason = '';

  for (const pattern of PROHIBITED_PATTERNS) {
    if (pattern.regex.test(fullText)) {
      matchedCategories.push(pattern.category);
      if (pattern.risk === 'HIGH_RISK') {
        highestRisk = 'HIGH_RISK';
        matchedReason = `Conteúdo bloqueado por violação de segurança crítica na categoria [${pattern.category}].`;
        break; // Critical risk immediately halts and blocks
      } else if (highestRisk === 'LOW_RISK') {
        highestRisk = 'MEDIUM_RISK';
        matchedReason = `Conteúdo requer esclarecimento ou revisão manual na categoria [${pattern.category}].`;
      }
    }
  }

  return {
    risk: highestRisk,
    flagged: highestRisk !== 'LOW_RISK',
    reason: matchedReason || undefined,
    matchedCategories: matchedCategories.length > 0 ? matchedCategories : undefined,
    evaluatedTextSnippet: userPrompt.substring(0, 100),
  };
}
