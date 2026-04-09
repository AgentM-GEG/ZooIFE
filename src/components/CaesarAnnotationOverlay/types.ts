import type { CaesarAnnotation } from '@/types/annotations';
import type { Dispatch, SetStateAction } from 'react';

/**
 * Tooltip display state
 * 
 * Manages visibility and position of floating tooltips.
 * Position is in screen space (pixels), not image space.
 * 
 * @example
 * {
 *   visible: true,
 *   x: 150,
 *   y: 200,
 *   text: "rectangle detection"
 * }
 * 
 * @see useCaesarAnnotationTooltip for tooltip logic
 * @see CaesarAnnotationOverlay for usage
 */
export interface TooltipState {
  visible: boolean;
  x: number;    // screen-space X (pixels)
  y: number;    // screen-space Y (pixels)
  text: string;
}

/**
 * Props for CaesarAnnotationOverlay component
 */
export interface CaesarAnnotationOverlayProps {
  /** Array of Caesar ML annotations to display */
  annotations: CaesarAnnotation[];
  /** Stroke color (can be overridden per annotation via markColour) (default: from annotation) */
  stroke?: string;
  /** Stroke width in pixels (default: 1, doubles for selected annotation) */
  strokeWidth?: number;
  /** Callback when annotation box is clicked */
  onAnnotationClick?: (
    annotation: { x: number; y: number; width: number; height: number },
    annotationId: string
  ) => void;
  /** ID of currently selected annotation for highlight */
  selectedId?: string;
  /** Cursor for non-hovering state (default: "default") */
  toolCursor?: string;
  /** Tooltip state setter */
  setToolTip: Dispatch<SetStateAction<TooltipState>>;
}

/**
 * Rectangle annotation geometry
 */
export interface AnnotationRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
