import type { AnnotationTool } from '@/types/annotations';
import type { BrushProps } from '../ImageCanvas/types';

export interface ToolPaletteProps {
  tool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  brushProps: BrushProps;
  onBrushSizeChange: (brushSize: number) => void;
  onPredModBrushModeChange: (brushMode: string) => void;
  modelId: string;
  onModelChange: (id: string) => void;
  showPoints: boolean;
  onShowPointsChange: (v: boolean) => void;
  onPredModBrushSizeChange: (brushSize: number) => void;
  coordinateFix: 'none' | 'flipX' | 'flipY' | 'flipBoth' | 'swapXY';
  onCoordinateFixChange: (fix: 'none' | 'flipX' | 'flipY' | 'flipBoth' | 'swapXY') => void;
  debugCoords: boolean;
  onDebugCoordsChange: (v: boolean) => void;
}

export interface ToolOption {
  id: AnnotationTool;
  label: string;
}
