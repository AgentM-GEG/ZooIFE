/**
 * SAM2 coordinate transformation utilities
 * Handles various coordinate system conversions for image segmentation
 */

export type CoordinateFix = 'none' | 'flipX' | 'flipY' | 'flipBoth' | 'swapXY';

/**
 * Image dimensions for coordinate calculations
 */
export interface ImageSize {
  width: number;
  height: number;
}

/**
 * Point coordinate
 */
export interface Coordinate {
  x: number;
  y: number;
}

/**
 * Apply coordinate transformation to a single point.
 * Used for correcting coordinate systems between client and SAM2 backend.
 *
 * Transformations:
 * - 'none': No change
 * - 'flipX': Mirror horizontally (x' = width - 1 - x)
 * - 'flipY': Mirror vertically (y' = height - 1 - y)
 * - 'flipBoth': Mirror both axes
 * - 'swapXY': Swap X and Y coordinates
 *
 * @param coordinate - Point to transform
 * @param imageSize - Image dimensions
 * @param fix - Transformation type
 * @returns Transformed coordinate
 */
export function transformCoordinate(
  coordinate: Coordinate,
  imageSize: ImageSize | undefined,
  fix: CoordinateFix
): Coordinate {
  // No transformation needed
  if (fix === 'none' || !imageSize) {
    return coordinate;
  }

  const { x, y } = coordinate;
  const { width, height } = imageSize;

  switch (fix) {
    case 'flipX':
      return { x: width - 1 - x, y };

    case 'flipY':
      return { x, y: height - 1 - y };

    case 'flipBoth':
      return { x: width - 1 - x, y: height - 1 - y };

    case 'swapXY':
      return { x: y, y: x };

    default:
      return coordinate;
  }
}

/**
 * Transform multiple point prompts at once.
 * Rounds coordinates to nearest integer for pixel accuracy.
 *
 * @template T - Point type with numeric x, y properties and label
 * @param points - Array of points to transform
 * @param imageSize - Image dimensions
 * @param fix - Transformation type
 * @returns Array of transformed and rounded points
 */
export function transformPoints<T extends { x: number; y: number }>(
  points: T[],
  imageSize: ImageSize | undefined,
  fix: CoordinateFix
): Array<T & { x: number; y: number }> {
  return points.map(point => {
    const transformed = transformCoordinate(
      { x: point.x, y: point.y },
      imageSize,
      fix
    );
    return {
      ...point,
      x: Math.round(transformed.x),
      y: Math.round(transformed.y),
    };
  });
}

/**
 * Get a human-readable description of a coordinate transformation.
 * @param fix - Transformation type
 * @returns Description string
 */
export function describeTransform(fix: CoordinateFix): string {
  const descriptions: Record<CoordinateFix, string> = {
    none: 'No transformation',
    flipX: 'Flip horizontally (mirror X)',
    flipY: 'Flip vertically (mirror Y)',
    flipBoth: 'Flip both axes (180° rotation)',
    swapXY: 'Swap X and Y coordinates',
  };
  return descriptions[fix];
}
