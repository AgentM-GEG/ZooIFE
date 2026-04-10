import { Rect } from 'react-konva';
import { useState, useRef, useEffect } from 'react';
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
  hoveredRectId,
  toolCursor,
  setToolTip,
  onMouseEnterRect,
  onMouseLeaveRect,
}: {
  annotation: Extract<CaesarAnnotation, { toolType: 'rectangle' }>;
  strokeWidth: number;
  onAnnotationClick?: (geometry: any, annotationId: string) => void;
  selectedId?: string;
  hoveredRectId?: string;
  toolCursor?: string;
  setToolTip: (state: any) => void;
  onMouseEnterRect?: (annotationId: string) => void;
  onMouseLeaveRect?: () => void;
}) {
  const geometry = calculateRectangleGeometry(
    annotation.x_center,
    annotation.y_center,
    annotation.width,
    annotation.height
  );

  const rectRef = useRef(null);
  const prevOpacityRef = useRef<number | null>(null);

  const isSelected = selectedId === annotation.markId;
  const isHovered = hoveredRectId === annotation.markId;
  
  // Opacity logic:
  // - No selection + something hovered + not this rect: fade to 0.5
  // - No selection (+ nothing hovered OR this is hovered) OR selected/hovered: visible (opacity=1)
  // - Selection exists + not selected/hovered: faded (opacity=0.5)
  let targetOpacity: number;
  if (selectedId === undefined && hoveredRectId !== undefined && !isHovered) {
    // No selection, something is hovered, but not this rect
    targetOpacity = 0.5;
  } else if (selectedId === undefined || isSelected || isHovered) {
    // No selection, OR selected/hovered with or without selection
    targetOpacity = 1;
  } else {
    // Selection exists and this rect is not selected/hovered
    targetOpacity = 0.5;
  }

  // Animate opacity changes (both fade in and fade out) over 0.1 seconds
  useEffect(() => {
    if (rectRef.current && prevOpacityRef.current !== null) {
      const prevOpacity = prevOpacityRef.current;
      if (targetOpacity !== prevOpacity) {
        // Animate opacity change over 0.1 seconds
        (rectRef.current as any).to({ opacity: targetOpacity, duration: 0.1 });
      }
    }
    prevOpacityRef.current = targetOpacity;
  }, [targetOpacity]);

  // Hook call is now at top level of a component (safe)
  const tooltipHandlers = useCaesarAnnotationTooltip(
    setToolTip,
    toolCursor,
    annotation.markLabel as string | undefined,
    isSelected
  );

  return (
    <Rect
      ref={rectRef}
      key={annotation.markId}
      x={geometry.x}
      y={geometry.y}
      width={geometry.width}
      height={geometry.height}
      stroke={annotation.markColour as string}
      strokeWidth={isSelected ? strokeWidth * SELECTED_STROKE_MULTIPLIER : strokeWidth}
      opacity={targetOpacity}
      listening={true}
      hitStrokeWidth={strokeWidth * ANNOTATION_HIT_STROKE_MULTIPLIER}
      fillEnabled={false}
      onMouseEnter={(e) => {
        tooltipHandlers.handleMouseEnter(e);
        onMouseEnterRect?.(annotation.markId);
      }}
      onMouseMove={tooltipHandlers.handleMouseMove}
      onMouseLeave={(e) => {
        tooltipHandlers.handleMouseLeave(e);
        onMouseLeaveRect?.();
      }}
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
  onMouseEnterRect,
  onMouseLeaveRect,
}: CaesarAnnotationOverlayProps) {
  const [hoveredRectId, setHoveredRectId] = useState<string | undefined>();

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
            hoveredRectId={hoveredRectId}
            toolCursor={toolCursor}
            setToolTip={setToolTip}
            onMouseEnterRect={(annotationId) => {
              setHoveredRectId(annotationId);
              onMouseEnterRect?.();
            }}
            onMouseLeaveRect={() => {
              setHoveredRectId(undefined);
              onMouseLeaveRect?.();
            }}
          />
        ))}
    </>
  );
}
