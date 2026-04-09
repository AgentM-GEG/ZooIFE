import React, { memo } from 'react';
import { Circle, Line } from 'react-konva';
import type { DrawingAnnotation } from '@/types/annotations';

/**
 * Memoized annotation renderer - renders individual annotations without parent re-renders.
 * Only re-renders if the annotation itself changes.
 *
 * @param annotation - The annotation data to render (point, polyline, or brush)
 * @param index - Index of annotation in the list
 * @param contentScale - Current scale of canvas content for proper brush stroke width
 * @param debugImageUrl - URL of debug image (when present, points are hidden)
 * @param showPoints - Whether to display point annotations
 * @returns Konva shape(s) for the annotation or null
 */
const AnnotationRenderer = memo(({ annotation, index, contentScale, debugImageUrl, showPoints }: {
  annotation: DrawingAnnotation;
  index: number;
  contentScale: number;
  debugImageUrl: string | null;
  showPoints: boolean;
}) => {
  if (annotation.type === 'point' && !debugImageUrl && showPoints) {
    return (
      <Circle
        key={annotation.id ?? index}
        x={annotation.x}
        y={annotation.y}
        radius={4}
        fill={annotation.label === 0 ? '#e94560' : 'lime'}
        stroke="white"
        strokeWidth={1}
        listening={false}
      />
    );
  }
  
  if (annotation.type === 'polyline' && annotation.points.length > 1) {
    return (
      <Line
        key={annotation.id ?? index}
        points={annotation.points.flatMap((p) => [p.x, p.y])}
        stroke="lime"
        strokeWidth={3}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />
    );
  }
  
  if (annotation.type === 'brush') {
    return (
      <React.Fragment key={annotation.id ?? index}>
        {annotation.strokes.map((stroke, si) => (
          <Line
            key={si}
            points={stroke.points.flatMap((p) => [p.x, p.y])}
            stroke="lime"
            strokeWidth={stroke.radius * 2 / contentScale}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        ))}
      </React.Fragment>
    );
  }
  
  return null;
});
AnnotationRenderer.displayName = 'AnnotationRenderer';

export default AnnotationRenderer;
