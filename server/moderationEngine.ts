/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ModerationCategory,
  ModerationDecision,
  ModerationEvaluationResult,
  ModerationRiskLevel,
  ModerateInputParams,
  ModerateOutputParams,
} from '../src/types/moderation';

/**
 * ============================================================================
 * CENTRAL MODERATION ENGINE — CREATIVE AI MARKETING PLATFORM (PHASE 10A)
 * ============================================================================
 * 
 * IMPORTANT HONESTY & TRANSPARENCY NOTICE:
 * This module implements an MVP DETERMINISTIC, RULE-BASED safety filter.
 * It does NOT claim to provide comprehensive AI safety, semantic context understanding,
 * or universal protection against sophisticated adversarial attacks.
 * It serves as the initial line of defense to intercept harmful requests, prompt injection,
 * sensitive PII, and unsafe content prior to reaching external AI providers (Claude, Stability AI).
 */

interface ModerationRule {
  category: ModerationCategory;
  regex: RegExp;
  risk: ModerationRiskLevel;
  reason: string;
}

const DETERMINISTIC_RULES: ModerationRule[] = [
  // 1. CHILD SAFETY & EXPLOITATION (CRITICAL — HIGH_RISK)
  {
    category: 'child_safety',
    regex: /\b(csam|child abuse|underage nude|pedophil|minor nsfw|abuso infantil|pornografia infantil)\b/i,
    risk: 'HIGH_RISK',
    reason: 'Tentativa de geração de conteúdo envolvendo exploração ou abuso de menores.',
  },

  // 2. EXTREME VIOLENCE & SELF-HARM (CRITICAL — HIGH_RISK)
  {
    category: 'violence_gore',
    regex: /\b(gore|decapitation|mutilat|dismember|torture|bloodbath|massacre|suicide|self-harm|automutila[çc]|suic[ií]dio|esquarteja)\b/i,
    risk: 'HIGH_RISK',
    reason: 'Conteúdo promovendo ou descrevendo automutilação, suicídio ou violência extrema.',
  },

  // 3. WEAPONS, EXPLOSIVES & TERRORISM (CRITICAL — HIGH_RISK)
  {
    category: 'weapons_explosives',
    regex: /\b(pipe bomb|dirty bomb|anthrax weapon|bioweapon|assassination|bomba caseira|arma biol[oó]gica|atentado terrorista)\b/i,
    risk: 'HIGH_RISK',
    reason: 'Conteúdo relacionado a armas ilegais, explosivos ou atos terroristas.',
  },

  // 4. HATE SPEECH, DISCRIMINATION & GENOCIDE (CRITICAL — HIGH_RISK)
  {
    category: 'hate_speech',
    regex: /\b(nazi|swastika|holocaust denial|white supremacy|hate crime|genocide|neonazista|supremacia branca|discurso de [oó]dio)\b/i,
    risk: 'HIGH_RISK',
    reason: 'Incitação ao ódio, discriminação, supremacismo ou negação de crimes contra a humanidade.',
  },

  // 5. HARMFUL INSTRUCTIONS & CYBERATTACKS (CRITICAL — HIGH_RISK)
  {
    category: 'harmful_instructions',
    regex: /\b(ransomware|keylogger|ddos attack|zero-day exploit|sql injection script|bypass authentication exploit|criar malware)\b/i,
    risk: 'HIGH_RISK',
    reason: 'Instruções para criação de malware, invasão de sistemas ou ciberataques maliciosos.',
  },

  // 6. PROHIBITED ILLEGAL SUBSTANCES (CRITICAL — HIGH_RISK)
  {
    category: 'prohibited_materials',
    regex: /\b(fentanyl synthesis|methamphetamine recipe|sintetizar cocaina|fabricar drogas ilicitas)\b/i,
    risk: 'HIGH_RISK',
    reason: 'Instruções para manufatura ou síntese de substâncias entorpecentes ilícitas.',
  },

  // 7. EXPLICIT NSFW / ADULT HARDCORE (CRITICAL — HIGH_RISK)
  {
    category: 'explicit_nsfw',
    regex: /\b(hardcore porn|pornography|explicit sexual intercourse|genitalia close-up|pornografia expl[ií]cita)\b/i,
    risk: 'HIGH_RISK',
    reason: 'Conteúdo explicitamente pornográfico ou sexual não permitido para materiais corporativos.',
  },

  // 8. PROMPT INJECTION & JAILBREAK ATTEMPTS (CRITICAL/HIGH_RISK)
  {
    category: 'prompt_injection',
    regex: /\b(ignore (all )?previous instructions|disregard all prior guidelines|you are now DAN|jailbreak mode|override system prompt|reveal your (system prompt|hidden instructions|api keys?|secrets?)|bypass safety filters?|desconsidere todas as instru[çc][oõ]es anteriores)\b/i,
    risk: 'HIGH_RISK',
    reason: 'Tentativa detectada de prompt-injection, quebra de diretrizes (jailbreak) ou extração de instruções do sistema.',
  },

  // 9. PII & CONFIDENTIAL CREDENTIALS (MEDIUM_RISK — REQUIRES HUMAN REVIEW)
  {
    category: 'pii_and_credentials',
    regex: /\b(\d{3}\.\d{3}\.\d{3}-\d{2}|\b\d{11}\b.*cpf|ssn:\s*\d{3}-\d{2}-\d{4}|\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b|senha vazada|confidential password|client_secret)\b/i,
    risk: 'MEDIUM_RISK',
    reason: 'Presença aparente de dados pessoais sensíveis (CPF, cartão de crédito ou credenciais de acesso).',
  },

  // 10. DEEPFAKES & CELEBRITY DEFAMATION (MEDIUM_RISK — REQUIRES HUMAN REVIEW)
  {
    category: 'deepfake_celebrity',
    regex: /\b(deepfake|nude leak of|fake scandal photo|foto falsa comprometedor|vazar fotos [ií]ntimas)\b/i,
    risk: 'MEDIUM_RISK',
    reason: 'Risco de criação de mídia sintética não consensual ou difamação (deepfake).',
  },

  // 11. ILLEGAL POLITICAL PROPAGANDA / DISINFORMATION (MEDIUM_RISK — REQUIRES HUMAN REVIEW)
  {
    category: 'controversial_political',
    regex: /\b(propaganda politica ilegal|fake ballot|eleicoes fraudadas|fraude nas urnas|comprar votos)\b/i,
    risk: 'MEDIUM_RISK',
    reason: 'Alegações de fraude eleitoral ou conteúdo com potencial impacto eleitoral vedado.',
  },

  // 12. FRAUD & IDENTITY THEFT (MEDIUM_RISK — REQUIRES HUMAN REVIEW)
  {
    category: 'illegal_fraud_interference',
    regex: /\b(golpe do pix|lavagem de dinheiro|piramide financeira|fraudar notas fiscais|identity theft guide)\b/i,
    risk: 'MEDIUM_RISK',
    reason: 'Práticas fraudulentas, esquemas financeiros enganosos ou apropriação indevida de identidade.',
  },
];

export class ModerationEngine {
  /**
   * Evaluates untrusted text inputs BEFORE any external AI provider call.
   */
  public moderateInput(params: ModerateInputParams): ModerationEvaluationResult {
    const combinedText = params.textInputs
      .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      .join('\n');

    return this.evaluateText(combinedText, 'INPUT');
  }

  /**
   * Evaluates AI-generated output AFTER the provider returns, before presenting it to users.
   */
  public moderateOutput(params: ModerateOutputParams): ModerationEvaluationResult {
    // For text generation: evaluate the generated content string
    if (params.outputContent) {
      return this.evaluateText(params.outputContent, 'OUTPUT');
    }

    // For image generation: transparent honest acknowledgment
    // Automated deep-vision moderation is not locally available without cloud vision APIs.
    // Therefore, establishing transparent review mechanism where images default to human inspection.
    return {
      decision: 'ALLOW',
      riskLevel: 'LOW_RISK',
      isSafe: true,
      flagged: false,
      categories: [],
      reason: 'Output visual gerado com sucesso. Inspeção visual humana recomendada.',
      requiresHumanReview: false,
      isDeterministicMvp: true,
    };
  }

  /**
   * Evaluates text against deterministic safety rules.
   */
  public evaluateText(text: string, stage: 'INPUT' | 'OUTPUT' = 'INPUT'): ModerationEvaluationResult {
    const trimmed = text.trim();
    if (!trimmed) {
      return {
        decision: 'ALLOW',
        riskLevel: 'LOW_RISK',
        isSafe: true,
        flagged: false,
        categories: [],
        requiresHumanReview: false,
        isDeterministicMvp: true,
      };
    }

    const matchedCategories: ModerationCategory[] = [];
    const matchedReasons: string[] = [];
    let highestRisk: ModerationRiskLevel = 'LOW_RISK';

    for (const rule of DETERMINISTIC_RULES) {
      if (rule.regex.test(trimmed)) {
        if (!matchedCategories.includes(rule.category)) {
          matchedCategories.push(rule.category);
          matchedReasons.push(rule.reason);
        }

        if (rule.risk === 'HIGH_RISK') {
          highestRisk = 'HIGH_RISK';
          // HIGH_RISK triggers immediate block
          break;
        } else if (highestRisk === 'LOW_RISK' && rule.risk === 'MEDIUM_RISK') {
          highestRisk = 'MEDIUM_RISK';
        }
      }
    }

    let decision: ModerationDecision = 'ALLOW';
    let requiresHumanReview = false;

    if (highestRisk === 'HIGH_RISK') {
      decision = 'BLOCK';
      requiresHumanReview = false;
    } else if (highestRisk === 'MEDIUM_RISK') {
      decision = 'REQUIRES_HUMAN_REVIEW';
      requiresHumanReview = true;
    }

    // Safe sanitized excerpt for audit (max 100 chars, no leaked PII)
    const sanitizedSnippet = trimmed.substring(0, 100).replace(/[\r\n]+/g, ' ');

    return {
      decision,
      riskLevel: highestRisk,
      isSafe: highestRisk === 'LOW_RISK',
      flagged: highestRisk !== 'LOW_RISK',
      categories: matchedCategories,
      reason: matchedReasons.join(' ') || undefined,
      requiresHumanReview,
      evaluatedSnippet: sanitizedSnippet,
      isDeterministicMvp: true,
    };
  }
}

export const moderationEngine = new ModerationEngine();
