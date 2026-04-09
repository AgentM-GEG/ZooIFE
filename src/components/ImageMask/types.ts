import type Konva from "konva";
import type { BrushMode } from "@/types/tools";

/**
 * Props for BrushEditableImage component.
 * Extends Konva.ImageConfig but replaces 'image' prop with canvas-based drawing.
 * 
 * For brush interaction types (BrushMode, BrushEditableImageHandle), see @/types/tools
 */
export interface BrushEditableImageProps
  extends Omit<Konva.ImageConfig, "image"> {
  /** Source image to display (optional, for reference) */
  image?: HTMLImageElement | null;
  /** External mask to apply (ImageData or HTMLImageElement, optional) */
  externalMask?: ImageData | HTMLImageElement | null;
  /** Enable brush drawing mode (default: false) */
  enableBrush?: boolean;
  /** Brush radius in pixels (default: 20) */
  brushRadius?: number;
  /** Brush mode: add (paint) or subtract (erase) (default: "add") */
  brushMode?: BrushMode;
  /** RGBA color for add mode strokes (default: "rgba(0,255,200,0.45)") */
  addColor?: string;
  /** Content scale factor for brush calculations (default: 1) */
  contentScale?: number;
}
