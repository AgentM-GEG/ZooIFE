/**
 * Cursor color constants for brush tools.
 * Chosen for visibility on greyscale images.
 */
export const BRUSH_CURSOR_COLORS = {
  /**
   * Primary brush cursor color - bright lime green.
   * Highly visible on greyscale and color images.
   * Matches the annotation stroke color for consistency.
   */
  PRIMARY: '#32ff00',
  
  /**
   * Modifier brush cursor color - cyan/light blue.
   * Used to distinguish the prediction modifier brush from primary brush.
   * Provides good contrast on both dark and light backgrounds.
   */
  MODIFIER: '#00ffff',
} as const;

/**
 * Cursor styling constants.
 */
export const BRUSH_CURSOR_STYLES = {
  /**
   * Border width in pixels for the cursor circle.
   */
  BORDER_WIDTH: 1,
  
  /**
   * Z-index for cursor overlay to appear above canvas and other elements.
   */
  Z_INDEX: 9999,
  
  /**
   * Shadow effect for cursor outline visibility on bright areas.
   * Creates a subtle dark outline around the circle.
   */
  BOX_SHADOW: 'none',
} as const;
