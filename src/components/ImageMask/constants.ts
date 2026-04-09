import type { BrushMode } from '@/types/tools';

/**
 * Default props for BrushEditableImage component
 */
export const BRUSH_DEFAULTS = {
  /** Brush mode: add (paint) or subtract (erase) */
  BRUSH_MODE: 'add' as BrushMode,
  /** Brush radius in pixels */
  BRUSH_RADIUS: 20,
  /** Enable brush drawing mode */
  ENABLE_BRUSH: false,
  /** RGBA color for add mode strokes (cyan with 45% alpha) */
  ADD_COLOR: 'rgba(0,255,200,0.45)',
} as const;

/**
 * Drawing configuration constants
 */
export const DRAWING_CONFIG = {
  /** Alpha value for mask strokes (0-255, represents ~45%) */
  STROKE_ALPHA: 0.45,
  /** Line width multiplier: lineWidth = 4 * brushRadius / scale */
  LINE_WIDTH_MULTIPLIER: 4,
  /** Composite operation for erase mode strokes */
  ERASE_COMPOSITE: 'destination-out' as const,
  /** Composite operation for add mode strokes */
  ADD_COMPOSITE: 'source-over' as const,
  /** Stroke color for erase mode (unused, composite op does the work) */
  ERASE_STROKE_COLOR: 'rgba(0,0,0,1)',
  /** Line cap style for smooth stroke ends */
  LINE_CAP: 'round' as const,
  /** Line join style for smooth stroke corners */
  LINE_JOIN: 'round' as const,
} as const;

/**
 * RGBA parsing defaults (fallback if parsing fails)
 */
export const DEFAULT_RGBA = {
  RED: 0,
  GREEN: 255,
  BLUE: 0,
  ALPHA: 0.45,
} as const;
