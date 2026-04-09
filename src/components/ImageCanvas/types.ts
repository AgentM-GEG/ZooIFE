import { RefObject } from 'react';
import type { AnnotationTool } from '@/types/annotations';
import type { BrushEditableImageHandle } from '@/types/tools';

/**
 * Brush tool configuration
 * 
 * Shared configuration for brush painting across canvas and tool palette.
 * Controls brush size, mode (normal/positive/negative for SAM2), and canvas reference.
 * 
 * Properties:
 * - `brushSize` — Main brush radius in pixels
 * - `predModBrushSize` — SAM2 prompt/modifier brush size
 * - `predModBrushMode` — SAM2 mode: "positive" | "negative"
 * - `predModBrushRef` — Reference to BrushEditableImage for direct canvas access
 * 
 * @example
 * {
 *   brushSize: 15,
 *   predModBrushSize: 10,
 *   predModBrushMode: "positive",
 *   predModBrushRef: canvasRef
 * }
 * 
 * @see ImageCanvas for component that uses this
 * @see ToolPalette for component that modifies this
 */
export interface BrushProps {
    brushSize: number;
    predModBrushSize: number;
    predModBrushMode: string;
    predModBrushRef: RefObject<BrushEditableImageHandle> | null;
}

export interface ImageCanvasProps {
  tool: AnnotationTool;
  brushProps: BrushProps;
  onPointClick?: (x: number, y: number, label: 0 | 1) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  showPoints?: boolean;
}

export interface ViewportState {
  zoom: number;
  pan: { x: number; y: number };
}

export interface TooltipState {
  visible: boolean;
  text: string;
  x: number;
  y: number;
}

export interface StageSize {
  width: number;
  height: number;
}
