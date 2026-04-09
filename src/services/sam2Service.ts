/**
 * SAM2 (Segment Anything 2.0) service
 * Calls locally hosted SAM2 backend (Python server with model checkpoints)
 */

import { transformPoints, type CoordinateFix } from '@/utils/coordinates';

export interface PointPrompt {
  x: number;
  y: number;
  label: 0 | 1; // 1 = foreground, 0 = background
}

export interface Sam2Output {
  image?: { url: string; width?: number; height?: number };
  debug_url?: string;
}

export interface Sam2Options {
  debug?: boolean;
  imageSize?: { width: number; height: number };
  coordinateFix?: CoordinateFix;
  modelId?: string;
}

export const SEGMENT_MODELS = [
  { id: 'sam2-hiera-tiny', label: 'SAM2 Tiny (fastest)' },
  { id: 'sam2-hiera-small', label: 'SAM2 Small' },
  { id: 'sam2-hiera-base-plus', label: 'SAM2 Base+' },
  { id: 'sam2-hiera-large', label: 'SAM2 Large (best)' },
  { id: 'sam1-vit_b', label: 'SAM1 ViT-B' },
  { id: 'sam1-vit_l', label: 'SAM1 ViT-L' },
  { id: 'sam1-vit_h', label: 'SAM1 ViT-H (largest)' },
] as const;

/**
 * Segment image using point prompts.
 * Sends request to local SAM2 server (POST /api/sam2/segment).
 * Accepts image as URL or data URI (data:image/...;base64,...).
 *
 * @param imageUrl - URL or data URI of image to segment
 * @param prompts - Array of point prompts (foreground/background)
 * @param baseUrl - Base URL for SAM2 server ('' for same-origin proxy)
 * @param options - Segmentation options (debug mode, coordinate fixes, model ID)
 * @returns Promise resolving to segmentation output with mask image and optional debug image
 * @throws Error if segmentation request fails
 */
export async function segmentWithPoints(
  imageUrl: string,
  prompts: PointPrompt[],
  baseUrl = '', // Use '' for same-origin proxy to local server
  options: Sam2Options = {}
): Promise<Sam2Output> {
  const { debug = false, imageSize, coordinateFix = 'none', modelId = 'sam2-hiera-large' } = options;

  // Transform prompts using coordinate fix utility
  const transformedPrompts = transformPoints(prompts, imageSize, coordinateFix);

  const url = baseUrl ? `${baseUrl}/api/sam2/segment` : '/api/sam2/segment';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        prompts: transformedPrompts,
        debug,
        model_id: modelId,
      }),
    });

    if (!response.ok) {
      let errorMessage: string;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail ?? errorData.error ?? `HTTP ${response.status}`;
      } catch {
        errorMessage = `HTTP ${response.status}`;
      }
      throw new Error(`SAM2 segmentation failed: ${errorMessage}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`SAM2 segmentation error: ${String(error)}`);
  }
}
