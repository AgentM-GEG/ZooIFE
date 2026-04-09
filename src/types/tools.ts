/**
 * Shared tool and canvas infrastructure types
 * 
 * Types for brush interaction modes and canvas imperative interfaces.
 * Used across multiple components (App, ToolPalette, ImageCanvas, ImageMask).
 */

import type { KonvaEventObject } from "konva/lib/Node";

/**
 * Brush mode determines how strokes are applied to the mask
 * 
 * - `"add"` — Adds/paints onto the mask
 * - `"subtract"` — Removes from mask using erasing
 * 
 * Used throughout the brush interaction system:
 * - ToolPalette: User selects mode
 * - ImageCanvas: Passes mode to brush handlers
 * - ImageMask/BrushEditableImage: Applies mode to canvas operations
 * 
 * @example
 * const mode: BrushMode = "add"; // painting
 * const eraseMode: BrushMode = "subtract"; // erasing
 */
export type BrushMode = "add" | "subtract";

/**
 * Imperative handle for brush/canvas operations
 * 
 * Allows parent components to programmatically control drawing, undo/redo
 * without managing internal canvas state directly.
 * 
 * Used by:
 * - App.tsx: Main app holds the ref
 * - ImageCanvas/types.ts: Referenced in derived types
 * - ToolPalette: Calls undo/redo when user clicks buttons
 * - ImageMask/BrushEditableImage: Implements this interface
 * 
 * @example
 * const brushRef = useRef<BrushEditableImageHandle>(null);
 * 
 * // From parent component
 * const handleUndo = () => brushRef.current?.undo();
 * const handleRedo = () => brushRef.current?.redo();
 * 
 * // Pointer events flow through
 * const handlePointerDown = (e) => brushRef.current?.pointerDown(e);
 */
export interface BrushEditableImageHandle {
  pointerDown: (e: KonvaEventObject<PointerEvent>) => void;
  pointerMove: (e: KonvaEventObject<PointerEvent>) => void;
  pointerUp: () => void;
  undo: () => void;
  redo: () => void;
}