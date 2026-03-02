import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Stage, Layer, Image, Line, Circle } from 'react-konva';
import Konva from 'konva';
import { useClassificationStore } from '../../stores/classificationStore';
import type { AnnotationTool } from '../../types/annotations';

interface ImageCanvasProps {
  tool: AnnotationTool;
  onPointClick?: (x: number, y: number, label: 0 | 1) => void;
}

export function ImageCanvas({ tool, onPointClick }: ImageCanvasProps) {
  const {
    imageUrl,
    annotations,
    addAnnotation,
    removeAnnotation,
    currentMaskUrl,
    debugImageUrl,
  } = useClassificationStore();
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [maskImage, setMaskImage] = useState<HTMLImageElement | null>(null);
  const [debugImage, setDebugImageEl] = useState<HTMLImageElement | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<Array<{ x: number; y: number }>>([]);
  const stageRef = useRef<Konva.Stage>(null);

  const handleImageLoad = useCallback((img: HTMLImageElement) => {
    useClassificationStore.setState({
      imageDimensions: { width: img.naturalWidth, height: img.naturalHeight },
    });
  }, []);

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const target = e.target as { getClassName?: () => string };
      if (target?.getClassName && ['Circle', 'Line'].includes(target.getClassName()))
        return; // Clicked on annotation - don't add new point
      if (!stageRef.current || !image) return;
      const stage = stageRef.current;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      const scaleX = stage.width() / image.naturalWidth;
      const scaleY = stage.height() / image.naturalHeight;
      const scale = Math.min(scaleX, scaleY);
      const offsetX = (stage.width() - image.naturalWidth * scale) / 2;
      const offsetY = (stage.height() - image.naturalHeight * scale) / 2;
      const x = (pos.x - offsetX) / scale;
      const y = (pos.y - offsetY) / scale;

      if (tool === 'point') {
        addAnnotation({ type: 'point', x, y, label: 1 });
        onPointClick?.(x, y, 1);
      } else if (tool === 'freehand') {
        setDrawingPoints((prev) => [...prev, { x, y }]);
      }
    },
    [tool, image, addAnnotation, onPointClick]
  );

  const handleStageMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (tool !== 'freehand') return;
      const isDrawing = e.evt.buttons === 1;
      if (!isDrawing || !stageRef.current || !image) return;
      const stage = stageRef.current;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      const scaleX = stage.width() / image.naturalWidth;
      const scaleY = stage.height() / image.naturalHeight;
      const scale = Math.min(scaleX, scaleY);
      const offsetX = (stage.width() - image.naturalWidth * scale) / 2;
      const offsetY = (stage.height() - image.naturalHeight * scale) / 2;
      const x = (pos.x - offsetX) / scale;
      const y = (pos.y - offsetY) / scale;
      setDrawingPoints((prev) => [...prev, { x, y }]);
    },
    [tool, image]
  );

  const handleStageMouseUp = useCallback(() => {
    if (tool === 'freehand' && drawingPoints.length > 1) {
      addAnnotation({ type: 'polyline', points: [...drawingPoints] });
      setDrawingPoints([]);
    }
  }, [tool, drawingPoints, addAnnotation]);

  useEffect(() => {
    if (!imageUrl) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImage(img);
      handleImageLoad(img);
    };
    img.src = imageUrl;
  }, [imageUrl, handleImageLoad]);

  useEffect(() => {
    if (!currentMaskUrl) {
      setMaskImage(null);
      return;
    }
    const img = new window.Image();
    img.onload = () => setMaskImage(img);
    img.src = currentMaskUrl;
  }, [currentMaskUrl]);

  useEffect(() => {
    if (!debugImageUrl) {
      setDebugImageEl(null);
      return;
    }
    const img = new window.Image();
    img.onload = () => setDebugImageEl(img);
    img.src = debugImageUrl;
  }, [debugImageUrl]);

  if (!imageUrl) {
    return (
      <div className="canvas-placeholder" style={placeholderStyle}>
        Load an image to get started
      </div>
    );
  }

  const canvasWidth = 800;
  const canvasHeight = 600;
  const scale = Math.min(
    canvasWidth / (image?.naturalWidth ?? 1),
    canvasHeight / (image?.naturalHeight ?? 1)
  );
  const imgWidth = (image?.naturalWidth ?? 0) * scale;
  const imgHeight = (image?.naturalHeight ?? 0) * scale;
  const offsetX = (canvasWidth - imgWidth) / 2;
  const offsetY = (canvasHeight - imgHeight) / 2;

  return (
    <div className="image-canvas" style={containerStyle}>
      <Stage
        ref={stageRef}
        width={canvasWidth}
        height={canvasHeight}
        onClick={handleStageClick}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onMouseLeave={handleStageMouseUp}
      >
        <Layer>
          <Image
            image={image}
            width={imgWidth}
            height={imgHeight}
            x={offsetX}
            y={offsetY}
            listening={false}
          />
          {maskImage && (
            <Image
              image={maskImage}
              width={imgWidth}
              height={imgHeight}
              x={offsetX}
              y={offsetY}
              listening={false}
            />
          )}
          {debugImage && (
            <Image
              image={debugImage}
              width={imgWidth}
              height={imgHeight}
              x={offsetX}
              y={offsetY}
              listening={false}
              opacity={0.85}
            />
          )}
          {annotations.map((a, i) => {
            if (a.type === 'point')
              return (
                <Circle
                  key={a.id ?? i}
                  x={offsetX + a.x * scale}
                  y={offsetY + a.y * scale}
                  radius={8}
                  fill="lime"
                  stroke="white"
                  strokeWidth={2}
                  listening
                  onClick={(e) => e.cancelBubble = true}
                  onTap={(e) => e.cancelBubble = true}
                  onContextMenu={(e) => {
                    e.evt.preventDefault();
                    if (a.id) removeAnnotation(a.id);
                  }}
                  hitStrokeWidth={10}
                />
              );
            if (a.type === 'polyline' && a.points.length > 1)
              return (
                <Line
                  key={a.id ?? i}
                  points={a.points.flatMap((p) => [offsetX + p.x * scale, offsetY + p.y * scale])}
                  stroke="lime"
                  strokeWidth={3}
                  lineCap="round"
                  lineJoin="round"
                  listening
                  hitStrokeWidth={12}
                  onClick={(e) => e.cancelBubble = true}
                  onTap={(e) => e.cancelBubble = true}
                  onContextMenu={(e) => {
                    e.evt.preventDefault();
                    if (a.id) removeAnnotation(a.id);
                  }}
                />
              );
            return null;
          })}
          {drawingPoints.length > 1 && (
            <Line
              points={drawingPoints.flatMap((p) => [offsetX + p.x * scale, offsetY + p.y * scale])}
              stroke="cyan"
              strokeWidth={3}
              lineCap="round"
              lineJoin="round"
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
}

const placeholderStyle: React.CSSProperties = {
  width: 800,
  height: 600,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#1a1a2e',
  color: '#888',
  borderRadius: 8,
};

const containerStyle: React.CSSProperties = {
  background: '#16213e',
  borderRadius: 8,
  padding: 16,
};
