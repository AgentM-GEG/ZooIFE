/**
 * Default stroke width for Caesar annotation rectangles (pixels)
 */
export const DEFAULT_ANNOTATION_STROKE_WIDTH = 1;

/**
 * Hit stroke multiplier for click detection
 * Larger value makes boxes easier to click (invisible padding)
 */
export const ANNOTATION_HIT_STROKE_MULTIPLIER = 5;

/**
 * Stroke width multiplier for selected annotation
 * Highlights selected box with thicker border
 */
export const SELECTED_STROKE_MULTIPLIER = 2;

/**
 * SVG cursor for zoom in (magnifying glass with +)
 */
const ZOOM_IN_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='32' height='32'%3E%3Cpolygon points='0,0 7,2 2,7' fill='black'/%3E%3Ccircle cx='10' cy='10' r='8' fill='none' stroke='black' stroke-width='2'/%3E%3Cline x1='16' y1='16' x2='24' y2='24' stroke='black' stroke-width='2'/%3E%3Cline x1='10' y1='6' x2='10' y2='14' stroke='black' stroke-width='1.5' stroke-linecap='round'/%3E%3Cline x1='6' y1='10' x2='14' y2='10' stroke='black' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E`;

/**
 * SVG cursor for zoom out (magnifying glass with -)
 */
const ZOOM_OUT_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='32' height='32'%3E%3Cpolygon points='0,0 7,2 2,7' fill='black'/%3E%3Ccircle cx='10' cy='10' r='8' fill='none' stroke='black' stroke-width='2'/%3E%3Cline x1='16' y1='16' x2='24' y2='24' stroke='black' stroke-width='2'/%3E%3Cline x1='6' y1='10' x2='14' y2='10' stroke='black' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E`;

/**
 * Get the appropriate cursor based on zoom direction
 * @param isZoomingOut - Whether clicking will zoom out (selection exists)
 * @returns CSS cursor string with hotspot coordinates
 */
export function getAnnotationCursor(isZoomingOut: boolean): string {
  const svgUrl = isZoomingOut ? ZOOM_OUT_SVG : ZOOM_IN_SVG;
  return `url("${svgUrl}") 0 0, auto`;
}

/**
 * Default cursor for non-hovering state
 */
export const ANNOTATION_DEFAULT_CURSOR = 'default';
