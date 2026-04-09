import { DEFAULT_RGBA } from './constants';

/**
 * Parse RGBA color string into [R, G, B, A] components.
 * Handles both rgb() and rgba() formats.
 * @param rgba - RGBA color string (e.g., "rgba(0,255,200,0.45)")
 * @returns Tuple of [red, green, blue, alpha] values where RGB are 0-255 and alpha is 0-1
 * @example
 * parseRGBA("rgba(0,255,200,0.45)") // [0, 255, 200, 114]
 */
export function parseRGBA(rgba: string): [number, number, number, number] {
  const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d\.]+)?\)/);
  if (!m) {
    return [
      DEFAULT_RGBA.RED,
      DEFAULT_RGBA.GREEN,
      DEFAULT_RGBA.BLUE,
      Math.floor(DEFAULT_RGBA.ALPHA * 255),
    ];
  }

  return [
    Number(m[1]),
    Number(m[2]),
    Number(m[3]),
    Math.floor((Number(m[4] ?? 1)) * 255),
  ];
}

/**
 * Convert ImageData or HTMLImageElement to ImageData format.
 * Creates a temporary canvas if needed to convert HTMLImageElement.
 * @param source - ImageData or HTMLImageElement to convert
 * @returns ImageData with pixel data and dimensions
 */
export function sourceToImageData(source: ImageData | HTMLImageElement): {
  data: ImageData;
  width: number;
  height: number;
} {
  if (source instanceof ImageData) {
    return {
      data: source,
      width: source.width,
      height: source.height,
    };
  }

  // Convert HTMLImageElement to ImageData
  const w = source.width || source.naturalWidth;
  const h = source.height || source.naturalHeight;

  const temp = document.createElement('canvas');
  temp.width = w;
  temp.height = h;
  const ctx = temp.getContext('2d')!;
  ctx.drawImage(source, 0, 0);

  return {
    data: ctx.getImageData(0, 0, w, h),
    width: w,
    height: h,
  };
}

/**
 * Apply color overlay to mask ImageData with additive blending.
 * Preserves alpha channel, applies RGB color to all pixels.
 * @param targetImageData - ImageData to write color to
 * @param sourceImageData - ImageData with alpha values to preserve
 * @param color - RGBA color tuple [R, G, B, A]
 * @returns Modified ImageData with color applied
 */
export function applyColorToMask(
  targetImageData: ImageData,
  sourceImageData: ImageData,
  color: [number, number, number, number]
): ImageData {
  const [r, g, b] = color;
  const targetData = targetImageData.data;
  const sourceData = sourceImageData.data;

  for (let i = 0; i < targetData.length; i += 4) {
    const sourceAlpha = sourceData[i + 3] || targetData[i + 3];

    targetData[i] = r;
    targetData[i + 1] = g;
    targetData[i + 2] = b;
    targetData[i + 3] = sourceAlpha;
  }

  return targetImageData;
}

/**
 * Normalize alpha channel in ImageData to consistent value.
 * Sets alpha to fixed value (e.g., 0.45 * 255) for all non-transparent pixels.
 * @param imageData - ImageData to normalize
 * @param alphaRatio - Alpha as ratio 0-1 (will be multiplied by 255)
 */
export function normalizeAlpha(imageData: ImageData, alphaRatio: number): void {
  const data = imageData.data;
  const alphaValue = Math.floor(alphaRatio * 255);

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) {
      data[i + 3] = alphaValue;
    }
  }
}
