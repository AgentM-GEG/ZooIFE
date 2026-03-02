/**
 * SAM2 (Segment Anything 2.0) service
 * Calls locally hosted SAM2 backend (Python server with model checkpoints)
 */

export interface PointPrompt {
  x: number;
  y: number;
  label: 0 | 1; // 1 = foreground, 0 = background
}

export interface Sam2Output {
  image?: { url: string; width?: number; height?: number };
  debug_url?: string;
}

/**
 * Segment image using point prompts.
 * Sends request to local SAM2 server (POST /api/sam2/segment).
 * Accepts image as URL or data URI (data:image/...;base64,...).
 */
export type CoordinateFix = 'none' | 'flipX' | 'flipY' | 'flipBoth' | 'swapXY';

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

export async function segmentWithPoints(
  imageUrl: string,
  prompts: PointPrompt[],
  baseUrl = '', // Use '' for same-origin proxy to local server
  options: Sam2Options = {}
): Promise<Sam2Output> {
  const { debug = false, imageSize, coordinateFix = 'none', modelId = 'sam2-hiera-large' } = options;

  const applyFix = (x: number, y: number): { x: number; y: number } => {
    let out = { x, y };
    if (imageSize && coordinateFix !== 'none') {
      const { width, height } = imageSize;
      switch (coordinateFix) {
        case 'flipX':
          out = { x: width - 1 - x, y };
          break;
        case 'flipY':
          out = { x, y: height - 1 - y };
          break;
        case 'flipBoth':
          out = { x: width - 1 - x, y: height - 1 - y };
          break;
        case 'swapXY':
          out = { x: y, y: x };
          break;
        default:
          break;
      }
    }
    return out;
  };

  const resolvedPrompts = prompts.map((p) => {
    const { x, y } = applyFix(p.x, p.y);
    return { x: Math.round(x), y: Math.round(y), label: p.label };
  });

  const url = baseUrl ? `${baseUrl}/api/sam2/segment` : '/api/sam2/segment';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: imageUrl,
      prompts: resolvedPrompts,
      debug,
      model_id: modelId,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? err.error ?? `SAM2 error: ${res.status}`);
  }
  return res.json();
}
