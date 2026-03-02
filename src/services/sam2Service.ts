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
}

/**
 * Segment image using point prompts.
 * Sends request to local SAM2 server (POST /api/sam2/segment).
 * Accepts image as URL or data URI (data:image/...;base64,...).
 */
export async function segmentWithPoints(
  imageUrl: string,
  prompts: PointPrompt[],
  baseUrl = '' // Use '' for same-origin proxy to local server
): Promise<Sam2Output> {
  const url = baseUrl ? `${baseUrl}/api/sam2/segment` : '/api/sam2/segment';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: imageUrl,
      prompts: prompts.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), label: p.label })),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? err.error ?? `SAM2 error: ${res.status}`);
  }
  return res.json();
}
