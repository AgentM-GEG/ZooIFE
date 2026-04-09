import { Rect } from 'react-konva';
import type { CaesarAnnotationOverlayProps } from './types';
import {
  DEFAULT_ANNOTATION_STROKE_WIDTH,
  ANNOTATION_HIT_STROKE_MULTIPLIER,
  SELECTED_STROKE_MULTIPLIER,
} from './constants';
import { calculateRectangleGeometry } from './rectangleGeometry';
import { useCaesarAnnotationTooltip } from './useCaesarAnnotationTooltip';
import type { CaesarAnnotation } from '@/types/annotations';

/**
 * Individual annotation rectangle component.
 * Separated to safely call hooks outside of map loops.
 */
function CaesarAnnotationRect({
  annotation,
  strokeWidth,
  onAnnotationClick,
  selectedId,
  toolCursor,
  setToolTip,
}: {
  annotation: Extract<CaesarAnnotation, { toolType: 'rectangle' }>;
  strokeWidth: number;
  onAnnotationClick?: (geometry: any, annotationId: string) => void;
  selectedId?: string;
  toolCursor?: string;
  setToolTip: (state: any) => void;
}) {
  const geometry = calculateRectangleGeometry(
    annotation.x_center,
    annotation.y_center,
    annotation.width,
    annotation.height
  );

  // Hook call is now at top level of a component (safe)
  const tooltipHandlers = useCaesarAnnotationTooltip(
    setToolTip,
    toolCursor,
    annotation.markLabel as string | undefined
  );

  const isSelected = selectedId === annotation.markId;

  return (
    <Rect
      key={annotation.markId}
      x={geometry.x}
      y={geometry.y}
      width={geometry.width}
      height={geometry.height}
      stroke={annotation.markColour as string}
      strokeWidth={isSelected ? strokeWidth * SELECTED_STROKE_MULTIPLIER : strokeWidth}
      listening={true}
      hitStrokeWidth={strokeWidth * ANNOTATION_HIT_STROKE_MULTIPLIER}
      fillEnabled={false}
      onMouseEnter={tooltipHandlers.handleMouseEnter}
      onMouseMove={tooltipHandlers.handleMouseMove}
      onMouseLeave={tooltipHandlers.handleMouseLeave}
      onClick={(e) => {
        e.cancelBubble = true;
        onAnnotationClick?.(geometry, annotation.markId);
      }}
    />
  );
}

/**
 * Overlay component for displaying Caesar machine learning annotations.
 * Renders rectangles from Caesar reductions with tooltips and click handlers.
 * @param props - CaesarAnnotationOverlayProps configuration
 */
export function CaesarAnnotationOverlay({
  annotations,
  strokeWidth = DEFAULT_ANNOTATION_STROKE_WIDTH,
  onAnnotationClick,
  selectedId,
  toolCursor,
  setToolTip,
}: CaesarAnnotationOverlayProps) {
  return (
    <>
      {annotations
        .filter((annotation): annotation is Extract<CaesarAnnotation, { toolType: 'rectangle' }> =>
          annotation.toolType === 'rectangle'
        )
        .map((annotation) => (
          <CaesarAnnotationRect
            key={annotation.markId}
            annotation={annotation}
            strokeWidth={strokeWidth}
            onAnnotationClick={onAnnotationClick}
            selectedId={selectedId}
            toolCursor={toolCursor}
            setToolTip={setToolTip}
          />
        ))}
    </>
  );
}
