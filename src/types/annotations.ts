/**
 * Annotation types for drawing tools
 */

export type AnnotationTool = 'point' | 'freehand' | 'brush' | 'sam2' | 'modifier_brush';

export interface PointAnnotation {
  type: 'point';
  x: number;
  y: number;
  label: 0 | 1; // 0 = background, 1 = foreground
  id?: string;
}

export interface PolylineAnnotation {
  type: 'polyline';
  points: Array<{ x: number; y: number }>;
  id?: string;
}

export interface BrushStroke {
  points: Array<{ x: number; y: number }>;
  radius: number;
}

export interface BrushAnnotation {
  type: 'brush';
  strokes: BrushStroke[];
  id?: string;
}

export interface Sam2MaskAnnotation {
  type: 'sam2_mask';
  maskUrl?: string;
  prompts: Array<{ x: number; y: number; label: 0 | 1 }>;
  id?: string;
}

export type DrawingAnnotation =
  | PointAnnotation
  | PolylineAnnotation
  | BrushAnnotation
  | Sam2MaskAnnotation;
