/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ImageGenerationProvider,
  SupportedAspectRatio,
  SupportedImageStyle,
  ASPECT_RATIO_DIMENSIONS,
} from '../src/types/imageAsset';

export interface ImageGenerationOptions {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: SupportedAspectRatio;
  style?: SupportedImageStyle;
  seed?: number;
}

export interface ImageGenerationResult {
  success: boolean;
  provider: ImageGenerationProvider;
  model: string;
  imageBuffer?: Buffer;
  mimeType: string;
  dimensions: { width: number; height: number };
  durationMs: number;
  estimatedCost: string;
  error?: string;
  statusCode?: number;
  isBlocked?: boolean;
}

/**
 * Interface that every Image Provider must satisfy.
 */
export interface ImageProviderInterface {
  name: ImageGenerationProvider;
  modelName: string;
  isAvailable(): boolean;
  generate(options: ImageGenerationOptions): Promise<ImageGenerationResult>;
}

/**
 * Stability AI Provider
 * 
 * Uses Stability AI's Stable Image Ultra or SD 3.5 via the modern API endpoints:
 * https://api.stability.ai/v2beta/stable-image/generate/core
 * or https://api.stability.ai/v2beta/stable-image/generate/sd3
 * 
 * Authentication: STABILITY_API_KEY Bearer token.
 * Output: multipart form request returning PNG image/webp buffer.
 */
export class StabilityAIProvider implements ImageProviderInterface {
  name: ImageGenerationProvider = 'stability_ai';
  modelName = 'stable-image-core'; // Modern supported Stability AI endpoint
  private apiKey: string | null;

  constructor() {
    this.apiKey = process.env.STABILITY_API_KEY?.trim() || null;
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey !== 'sk-...' && this.apiKey.length > 10);
  }

  async generate(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    const startTime = Date.now();

    if (!this.isAvailable()) {
      return {
        success: false,
        provider: 'stability_ai',
        model: this.modelName,
        mimeType: 'image/png',
        dimensions: ASPECT_RATIO_DIMENSIONS[options.aspectRatio || '1:1'],
        durationMs: 0,
        estimatedCost: 'COST_UNKNOWN',
        isBlocked: true,
        error:
          'STABILITY_API_KEY não configurada no servidor. Geração de imagem real está no estado BLOCKED.',
      };
    }

    try {
      // Build multipart form data for Stability AI v2beta REST API
      const formData = new FormData();
      formData.append('prompt', options.prompt);
      formData.append('aspect_ratio', options.aspectRatio || '1:1');
      formData.append('output_format', 'png');

      if (options.negativePrompt) {
        formData.append('negative_prompt', options.negativePrompt);
      }
      if (options.seed !== undefined) {
        formData.append('seed', String(options.seed));
      }

      // Modern endpoint: /v2beta/stable-image/generate/core
      const response = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'image/*',
        },
        body: formData,
      });

      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        let errMessage = `Stability AI API error: ${response.status} ${response.statusText}`;
        try {
          const errJson = await response.json();
          if (errJson.errors && Array.isArray(errJson.errors)) {
            errMessage = errJson.errors.join('; ');
          } else if (errJson.message) {
            errMessage = errJson.message;
          }
        } catch {
          // ignore non-json error responses
        }

        console.error(`[StabilityAIProvider] API Error (${response.status}):`, errMessage);

        return {
          success: false,
          provider: 'stability_ai',
          model: this.modelName,
          mimeType: 'image/png',
          dimensions: ASPECT_RATIO_DIMENSIONS[options.aspectRatio || '1:1'],
          durationMs,
          estimatedCost: 'COST_UNKNOWN',
          statusCode: response.status,
          error: errMessage,
        };
      }

      const arrayBuffer = await response.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);

      // Stable Image Core standard cost is $0.03 (approx 3 credits)
      return {
        success: true,
        provider: 'stability_ai',
        model: this.modelName,
        imageBuffer,
        mimeType: 'image/png',
        dimensions: ASPECT_RATIO_DIMENSIONS[options.aspectRatio || '1:1'],
        durationMs,
        estimatedCost: '0.030 USD',
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : 'Falha na requisição de rede com Stability AI';
      console.error('[StabilityAIProvider] Network/Runtime Exception:', errorMsg);

      return {
        success: false,
        provider: 'stability_ai',
        model: this.modelName,
        mimeType: 'image/png',
        dimensions: ASPECT_RATIO_DIMENSIONS[options.aspectRatio || '1:1'],
        durationMs,
        estimatedCost: 'COST_UNKNOWN',
        error: errorMsg,
      };
    }
  }
}

/**
 * Fallback Image Provider (Optional)
 * 
 * Only activated when explicitly enabled via configuration.
 * Never silently claims to be Stability AI.
 * Creates a high-fidelity visual prototype asset when external providers are offline.
 */
export class FallbackImageProvider implements ImageProviderInterface {
  name: ImageGenerationProvider = 'fallback_provider';
  modelName = 'creative-ai-canvas-fallback-v1';

  isAvailable(): boolean {
    return true;
  }

  async generate(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    const startTime = Date.now();
    const dims = ASPECT_RATIO_DIMENSIONS[options.aspectRatio || '1:1'];

    // Generate clean SVG visual asset encoded to PNG/SVG buffer
    const svgContent = `
      <svg width="${dims.width}" height="${dims.height}" viewBox="0 0 ${dims.width} ${dims.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0f172a" />
            <stop offset="50%" stop-color="#1e1b4b" />
            <stop offset="100%" stop-color="#090d16" />
          </linearGradient>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#25334d" stroke-width="0.8" stroke-opacity="0.3"/>
          </pattern>
        </defs>
        
        <rect width="100%" height="100%" fill="url(#bgGrad)" />
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        <!-- Ambient decorative shapes -->
        <circle cx="${dims.width * 0.75}" cy="${dims.height * 0.25}" r="220" fill="#6366f1" opacity="0.15" filter="blur(60px)" />
        <circle cx="${dims.width * 0.25}" cy="${dims.height * 0.8}" r="260" fill="#a855f7" opacity="0.12" filter="blur(80px)" />
        
        <!-- Central Card Frame -->
        <rect x="${dims.width * 0.08}" y="${dims.height * 0.08}" width="${dims.width * 0.84}" height="${dims.height * 0.84}" rx="24" fill="#0f1523" fill-opacity="0.85" stroke="#314161" stroke-width="2" />
        
        <!-- Typography -->
        <text x="${dims.width * 0.12}" y="${dims.height * 0.22}" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="700" fill="#818cf8" letter-spacing="2">
          CREATIVE AI — ASSET VISUAL FALLBACK
        </text>
        
        <text x="${dims.width * 0.12}" y="${dims.height * 0.32}" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="800" fill="#f8fafc">
          ${options.style || 'Creative Style'} • ${options.aspectRatio || '1:1'}
        </text>
        
        <!-- Prompt quote section -->
        <rect x="${dims.width * 0.12}" y="${dims.height * 0.38}" width="${dims.width * 0.76}" height="${dims.height * 0.38}" rx="14" fill="#161e31" stroke="#202b42" stroke-width="1.5" />
        
        <text x="${dims.width * 0.15}" y="${dims.height * 0.46}" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="600" fill="#94a3b8">
          Direção Criativa:
        </text>
        
        <foreignObject x="${dims.width * 0.15}" y="${dims.height * 0.49}" width="${dims.width * 0.7}" height="${dims.height * 0.23}">
          <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: system-ui, sans-serif; font-size: 19px; color: #cbd5e1; line-height: 1.5; word-break: break-word;">
            ${options.prompt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
          </div>
        </foreignObject>
        
        <!-- Footer info -->
        <text x="${dims.width * 0.12}" y="${dims.height * 0.86}" font-family="system-ui, -apple-system, sans-serif" font-size="16" fill="#64748b">
          Provedor: FallbackImageProvider (Simulação de contingência explícita) • Resolução: ${dims.width}x${dims.height}
        </text>
      </svg>
    `.trim();

    const imageBuffer = Buffer.from(svgContent, 'utf-8');

    return {
      success: true,
      provider: 'fallback_provider',
      model: this.modelName,
      imageBuffer,
      mimeType: 'image/svg+xml',
      dimensions: dims,
      durationMs: Date.now() - startTime,
      estimatedCost: '0.000 USD (Fallback)',
    };
  }
}

/**
 * Image Generation Service:
 * Orchestrates Stability AI provider selection, fallback handling,
 * and transparent auditability of the actual provider/model used.
 */
export class ImageGenerationService {
  private primaryProvider: StabilityAIProvider;
  private fallbackProvider: FallbackImageProvider;

  constructor() {
    this.primaryProvider = new StabilityAIProvider();
    this.fallbackProvider = new FallbackImageProvider();
  }

  isStabilityConfigured(): boolean {
    return this.primaryProvider.isAvailable();
  }

  async generateImage(
    options: ImageGenerationOptions,
    allowFallback = false
  ): Promise<ImageGenerationResult> {
    // 1. If Stability AI is available, attempt primary generation
    if (this.primaryProvider.isAvailable()) {
      const result = await this.primaryProvider.generate(options);
      if (result.success || !allowFallback) {
        return result;
      }
      console.warn('[ImageGenerationService] Stability AI failed, evaluating fallback allowance...');
    }

    // 2. If Stability AI is not configured or failed, check explicit fallback permission
    if (allowFallback) {
      console.info('[ImageGenerationService] Utilizing explicitly configured FallbackImageProvider.');
      return this.fallbackProvider.generate(options);
    }

    // 3. Otherwise return strict BLOCKED status
    return {
      success: false,
      provider: 'stability_ai',
      model: this.primaryProvider.modelName,
      mimeType: 'image/png',
      dimensions: ASPECT_RATIO_DIMENSIONS[options.aspectRatio || '1:1'],
      durationMs: 0,
      estimatedCost: 'COST_UNKNOWN',
      isBlocked: true,
      error:
        'STABILITY_API_KEY não configurada no servidor. A geração real com Stability AI está BLOCKED.',
    };
  }
}

export const imageGenerationService = new ImageGenerationService();
