/**
 * Annotation types for drawing tools
 * 
 * These types define all user annotations (marks, drawings, ML suggestions).
 * See docs/TYPES.md for detailed documentation and usage patterns.
 */

/**
 * Drawing tool identifier - determines interaction behavior and rendering
 * 
 * - `point` — Click to mark single point with foreground/background label
 * - `freehand` — Draw freeform polyline (not currently implemented)
 * - `brush` — Paint with configurable brush size and mode
 * - `sam2` — Segment with SAM2 from point/brush prompts
 * - `modifier_brush` — Refine SAM2 masks with +/- strokes
 * 
 * @see DrawingAnnotation for annotation types produced by each tool
 * @see useCanvasHandlers for tool interaction implementation
 */
export type AnnotationTool = 'point' | 'freehand' | 'brush' | 'sam2' | 'modifier_brush';

/**
 * Single point annotation with foreground/background label for SAM2 prompts
 * 
 * @example
 * { type: 'point', x: 150, y: 200, label: 1, id: 'uuid-123' }
 * 
 * - `label: 1` indicates foreground (object of interest)
 * - `label: 0` indicates background (context/reference)
 * - `id` auto-generated as UUID when added to store
 */
export interface PointAnnotation {
  type: 'point';
  x: number;
  y: number;
  label: 0 | 1; // 0 = background, 1 = foreground
  id?: string;
}

/**
 * Connected series of points (polyline) annotation
 * Currently defined but not actively used - kept for future feature expansion
 * 
 * @example
 * {
 *   type: 'polyline',
 *   points: [{x: 10, y: 20}, {x: 30, y: 40}, {x: 50, y: 60}],
 *   id: 'uuid-456'
 * }
 */
export interface PolylineAnnotation {
  type: 'polyline';
  points: Array<{ x: number; y: number }>;
  id?: string;
}

/**
 * Single brush stroke with sampled points and radius
 * Multiple strokes combine to form a BrushAnnotation
 * 
 * @example
 * {
 *   points: [{x: 10, y: 20}, {x: 15, y: 25}, {x: 20, y: 30}],
 *   radius: 10
 * }
 */
export interface BrushStroke {
  points: Array<{ x: number; y: number }>;
  radius: number;
}

/**
 * Brush annotation - collection of individual brush strokes
 * 
 * Used for painting/marking with configurable brush size.
 * Each stroke contains sampled points to reduce data transmission.
 * 
 * @example
 * {
 *   type: 'brush',
 *   strokes: [
 *     { points: [{x: 10, y: 20}, ...], radius: 10 },
 *     { points: [{x: 50, y: 60}, ...], radius: 15 }
 *   ],
 *   id: 'uuid-789'
 * }
 */
export interface BrushAnnotation {
  type: 'brush';
  strokes: BrushStroke[];
  id?: string;
}

/**
 * SAM2 (Segment Anything Model 2) segmentation result
 * 
 * Stores prompts submitted to SAM2 and the resulting mask.
 * Prompts are point coordinates with foreground/background labels.
 * 
 * @example
 * {
 *   type: 'sam2_mask',
 *   maskUrl: 'data:image/png;base64,...',
 *   prompts: [
 *     { x: 150, y: 200, label: 1 }, // foreground point
 *     { x: 50, y: 50, label: 0 }     // background point
 *   ],
 *   id: 'uuid-mask-1'
 * }
 * 
 * @see PointAnnotation for prompt structure
 */
export interface Sam2MaskAnnotation {
  type: 'sam2_mask';
  maskUrl?: string;
  prompts: Array<{ x: number; y: number; label: 0 | 1 }>;
  id?: string;
}

/**
 * Union of all user-drawn annotation types
 * 
 * This is the primary type for storing user interactions.
 * Stored in classificationStore.annotations[] and sent to Panoptes API.
 * 
 * @see classificationStore for how annotations are created and managed
 * @see TYPES.md for detailed documentation
 */
export type DrawingAnnotation =
  | PointAnnotation
  | PolylineAnnotation
  | BrushAnnotation
  | Sam2MaskAnnotation;


/**
 * Machine learning annotation from Capitol Analysis Engine (Caesar)
 * 
 * Represents a single ML-generated suggestion. Read-only for users - displayed
 * as visual overlay for reference. Can be ignored or used to guide user annotations.
 * 
 * Supports multiple tool types:
 * - `rectangle` — Bounding box detection (primary type)
 * - `custom` — Fallback for unknown reducer shapes (forward-compatible)
 * 
 * @example Rectangle annotation
 * {
 *   toolType: "rectangle",
 *   x_center: 200,
 *   y_center: 150,
 *   width: 100,
 *   height: 80,
 *   markId: "caesar-123",
 *   markColour: "#FF0000"
 * }
 * 
 * @see CaesarAnnotations for API response wrapper
 * @see useCaesarAnnotationStore for how these are stored and displayed
 */
export type CaesarAnnotation = {
      toolType: "rectangle";
      x_center: number;
      y_center: number;
      width: number;
      height: number;
      markId: string;
      [key: string]: unknown;
    }
  | {
      toolType: "custom";
      data: unknown; // fallback for unknown reducer shapes
    };


/**
 * Caesar API response wrapper
 * 
 * Matches the expected response structure from Caesar's annotation API.
 * Contains array of annotations to display as overlays.
 * 
 * @example
 * {
 *   data: [
 *     { toolType: "rectangle", x_center: 100, y_center: 150, width: 200, height: 100, markId: "1" },
 *     { toolType: "rectangle", x_center: 300, y_center: 250, width: 150, height: 120, markId: "2" }
 *   ]
 * }
 * 
 * @see caesarService.getAnnotations for API integration
 */
export type CaesarAnnotations = {
  data : CaesarAnnotation[];
}