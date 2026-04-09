import type { AnnotationRect } from './types';

/**
 * Calculate rectangle position and dimensions from center-based coordinates.
 * Converts from Caesar format (x_center, y_center, width, height) to top-left format.
 * @param xCenter - Center X coordinate
 * @param yCenter - Center Y coordinate
 * @param width - Rectangle width
 * @param height - Rectangle height
 * @returns Rectangle with top-left x, y and dimensions
 */
export function calculateRectangleGeometry(
  xCenter: number,
  yCenter: number,
  width: number,
  height: number
): AnnotationRect {
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  return {
    x: xCenter - halfWidth,
    y: yCenter - halfHeight,
    width,
    height,
  };
}

/**
 * Get tooltip position relative to browser window.
 * Takes Konva stage pointer position and converts to absolute screen coordinates.
 * @param stagePointerX - X position in Konva stage coordinate system
 * @param stagePointerY - Y position in Konva stage coordinate system
 * @param containerRect - Bounding rectangle of canvas container
 * @returns Absolute screen coordinates for tooltip
 */
export function getTooltipPosition(
  stagePointerX: number,
  stagePointerY: number,
  containerRect: DOMRect
): { x: number; y: number } {
  return {
    x: containerRect.left + stagePointerX,
    y: containerRect.top + stagePointerY,
  };
}
