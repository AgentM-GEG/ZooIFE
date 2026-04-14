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
 * Positions the tooltip's upper-left corner at the lower-right corner of the magnifying glass cursor.
 * The magnifying glass cursor is 32x32px with hotspot at (0, 0).
 * Adds a small screen-space offset from the cursor corner.
 * @param stagePointerX - X position in Konva stage coordinate system (cursor hotspot)
 * @param stagePointerY - Y position in Konva stage coordinate system (cursor hotspot)
 * @param containerRect - Bounding rectangle of canvas container
 * @returns Absolute screen coordinates for tooltip upper-left corner
 */
export function getTooltipPosition(
  stagePointerX: number,
  stagePointerY: number,
  containerRect: DOMRect
): { x: number; y: number } {
  // Magnifying glass cursor is 32x32px, hotspot at (0, 0)
  // Position tooltip at lower-right corner of cursor - small offset
  const cursorSize = 32;
  const offsetX = -5; // pixels from cursor corner (negative to pull closer)
  const offsetY = -5; // pixels from cursor corner (negative to pull closer)
  
  return {
    x: containerRect.left + stagePointerX + cursorSize + offsetX,
    y: containerRect.top + stagePointerY + cursorSize + offsetY,
  };
}
