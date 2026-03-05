import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Stage, Layer, Group, Image, Line, Circle } from 'react-konva';
import Konva from 'konva';
import { useClassificationStore } from '../../stores/classificationStore';
import type { AnnotationTool } from '../../types/annotations';

interface ImageCanvasProps {
  tool: AnnotationTool;
  onPointClick?: (x: number, y: number, label: 0 | 1) => void;
  showPoints?: boolean;
}

export function ImageCanvas({ tool, onPointClick, showPoints = true }: ImageCanvasProps) {
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
  const contentRef = useRef<Konva.Group>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanMode, setIsPanMode] = useState(false);

  const STAGE_WIDTH = 1200;
  const STAGE_HEIGHT = 800;
  const BRUSH_RADIUS = 10;
  const toolCursor = isPanMode ? 'grab' : tool === 'point' || tool === 'freehand' || tool === 'brush' ? 'crosshair' : 'default';

  const baseScale = image
    ? Math.min(STAGE_WIDTH / image.naturalWidth, STAGE_HEIGHT / image.naturalHeight)
    : 1;
  const contentScale = baseScale * zoom;
  const centerX = (STAGE_WIDTH - (image?.naturalWidth ?? 0) * contentScale) / 2;
  const centerY = (STAGE_HEIGHT - (image?.naturalHeight ?? 0) * contentScale) / 2;
  const groupX = centerX + pan.x;
  const groupY = centerY + pan.y;

  const pointerToImage = useCallback(
    (pos: { x: number; y: number }) => ({
      x: (pos.x - groupX) / contentScale,
      y: (pos.y - groupY) / contentScale,
    }),
    [groupX, groupY, contentScale]
  );

  const handleImageLoad = useCallback((img: HTMLImageElement) => {
    useClassificationStore.setState({
      imageDimensions: { width: img.naturalWidth, height: img.naturalHeight },
    });
  }, []);

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (isPanMode) return;
      const target = e.target as { getClassName?: () => string };
      if (target?.getClassName && ['Circle', 'Line'].includes(target.getClassName()))
        return;
      if (!stageRef.current || !image) return;
      const pos = stageRef.current.getPointerPosition();
      if (!pos) return;
      const { x, y } = pointerToImage(pos);

      if (tool === 'point') {
        addAnnotation({ type: 'point', x, y, label: 1 });
        onPointClick?.(x, y, 1);
      } else if (tool === 'freehand' || tool === 'brush') {
        setDrawingPoints((prev) => [...prev, { x, y }]);
      }
    },
    [tool, image, addAnnotation, onPointClick, pointerToImage, isPanMode]
  );

  const handleStageMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (isPanMode) return;
      if (tool !== 'freehand' && tool !== 'brush') return;
      const isDrawing = e.evt.buttons === 1;
      if (!isDrawing || !stageRef.current || !image) return;
      const pos = stageRef.current.getPointerPosition();
      if (!pos) return;
      const { x, y } = pointerToImage(pos);
      setDrawingPoints((prev) => [...prev, { x, y }]);
    },
    [tool, image, pointerToImage, isPanMode]
  );

  const handleStageMouseUp = useCallback(() => {
    if (isPanMode) return;
    if (tool === 'freehand' && drawingPoints.length > 1) {
      addAnnotation({ type: 'polyline', points: [...drawingPoints] });
      setDrawingPoints([]);
    } else if (tool === 'brush' && drawingPoints.length > 1) {
      addAnnotation({ type: 'brush', strokes: [{ points: [...drawingPoints], radius: BRUSH_RADIUS }] });
      setDrawingPoints([]);
    } else if ((tool === 'freehand' || tool === 'brush') && drawingPoints.length <= 1) {
      setDrawingPoints([]);
    }
  }, [tool, drawingPoints, addAnnotation, isPanMode]);

  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 4;
  const ZOOM_STEP = 1.25;

  const zoomIn = useCallback(() => setZoom((z) => Math.min(ZOOM_MAX, z * ZOOM_STEP)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(ZOOM_MIN, z / ZOOM_STEP)), []);
  const zoomFit = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);
  const zoom100 = useCallback(() => {
    if (!image) return;
    const fitScale = Math.min(STAGE_WIDTH / image.naturalWidth, STAGE_HEIGHT / image.naturalHeight);
    setZoom(1 / fitScale);
    setPan({ x: 0, y: 0 });
  }, [image]);

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const scaleBy = 1.08;
      const pos = stageRef.current?.getPointerPosition();
      if (!pos || !image) return;
      const newZoom = e.evt.deltaY < 0 ? zoom * scaleBy : zoom / scaleBy;
      const clampedZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
      const newScale = baseScale * clampedZoom;
      const dx = (pos.x - groupX) / contentScale;
      const dy = (pos.y - groupY) / contentScale;
      const newCenterX = (STAGE_WIDTH - image.naturalWidth * newScale) / 2;
      const newCenterY = (STAGE_HEIGHT - image.naturalHeight * newScale) / 2;
      setZoom(clampedZoom);
      setPan({
        x: pos.x - newCenterX - dx * newScale,
        y: pos.y - newCenterY - dy * newScale,
      });
    },
    [zoom, baseScale, contentScale, groupX, groupY, image]
  );

  const handleContentDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const newCenterX = (STAGE_WIDTH - (image?.naturalWidth ?? 0) * contentScale) / 2;
      const newCenterY = (STAGE_HEIGHT - (image?.naturalHeight ?? 0) * contentScale) / 2;
      setPan({ x: node.x() - newCenterX, y: node.y() - newCenterY });
    },
    [contentScale, image]
  );

  useEffect(() => {
    if (!imageUrl) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImage(img);
      setZoom(1);
      setPan({ x: 0, y: 0 });
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

  const natW = image?.naturalWidth ?? 0;
  const natH = image?.naturalHeight ?? 0;

  return (
    <div className="image-canvas" style={{ ...containerStyle, cursor: !debugImageUrl ? toolCursor : 'default' }}>
      {!debugImageUrl && (
        <div style={toolbarStyle}>
          <button type="button" onClick={zoomOut} style={toolbarBtnStyle} title="Zoom out">−</button>
          <span style={toolbarLabelStyle}>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={zoomIn} style={toolbarBtnStyle} title="Zoom in">+</button>
          <button type="button" onClick={zoomFit} style={toolbarBtnStyle} title="Fit to view">Fit</button>
          <button type="button" onClick={zoom100} style={toolbarBtnStyle} title="100% (1:1 pixels)">100%</button>
          <button
            type="button"
            onClick={() => setIsPanMode((p) => !p)}
            style={{ ...toolbarBtnStyle, ...(isPanMode ? toolbarBtnActiveStyle : {}) }}
            title="Pan mode: drag to move image"
          >
            Pan
          </button>
        </div>
      )}
      {debugImageUrl && (
        <>
          <div style={debugBannerStyle}>
            Debug: Red marker shows where server received your click
          </div>
          <img
            src={debugImageUrl}
            alt="Debug: server received point location"
            style={debugImgStyle}
          />
        </>
      )}
      {!debugImageUrl && (
      <Stage
        ref={stageRef}
        width={STAGE_WIDTH}
        height={STAGE_HEIGHT}
        onClick={handleStageClick}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onMouseLeave={handleStageMouseUp}
        onWheel={handleWheel}
      >
        <Layer>
          <Group
            ref={contentRef}
            x={groupX}
            y={groupY}
            scaleX={contentScale}
            scaleY={contentScale}
            draggable={isPanMode}
            onDragMove={handleContentDragMove}
          >
            <Image
              image={image}
              width={natW}
              height={natH}
              listening={false}
            />
            {maskImage && (
              <Image
                image={maskImage}
                width={natW}
                height={natH}
                listening={false}
              />
            )}
            {debugImage && (
              <Image
                image={debugImage}
                width={natW}
                height={natH}
                listening={false}
                opacity={1}
              />
            )}
            {annotations.map((a, i) => {
              if (a.type === 'point' && !debugImageUrl && showPoints)
                return (
                  <Circle
                    key={a.id ?? i}
                    x={a.x}
                    y={a.y}
                    radius={4}
                    fill="lime"
                    stroke="white"
                    strokeWidth={1}
                    listening
                    onClick={(e) => e.cancelBubble = true}
                    onTap={(e) => e.cancelBubble = true}
                    onContextMenu={(e) => {
                      e.evt.preventDefault();
                      if (a.id) removeAnnotation(a.id);
                    }}
                    hitStrokeWidth={8}
                  />
                );
              if (a.type === 'polyline' && a.points.length > 1)
                return (
                  <Line
                    key={a.id ?? i}
                    points={a.points.flatMap((p) => [p.x, p.y])}
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
              if (a.type === 'brush')
                return (
                  <React.Fragment key={a.id ?? i}>
                    {a.strokes.map((stroke, si) => (
                      <Line
                        key={si}
                        points={stroke.points.flatMap((p) => [p.x, p.y])}
                        stroke="lime"
                        strokeWidth={stroke.radius * 2}
                        lineCap="round"
                        lineJoin="round"
                        listening
                        hitStrokeWidth={Math.max(12, stroke.radius * 2)}
                        onClick={(e) => e.cancelBubble = true}
                        onTap={(e) => e.cancelBubble = true}
                        onContextMenu={(e) => {
                          e.evt.preventDefault();
                          if (a.id) removeAnnotation(a.id);
                        }}
                      />
                    ))}
                  </React.Fragment>
                );
              return null;
            })}
            {drawingPoints.length > 1 && (
              <Line
                points={drawingPoints.flatMap((p) => [p.x, p.y])}
                stroke={tool === 'brush' ? 'lime' : 'cyan'}
                strokeWidth={tool === 'brush' ? BRUSH_RADIUS * 2 : 3}
                lineCap="round"
                lineJoin="round"
              />
            )}
          </Group>
        </Layer>
      </Stage>
      )}
    </div>
  );
}

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 12,
};
const toolbarBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  border: '1px solid #333',
  borderRadius: 6,
  background: '#16213e',
  color: '#eee',
  cursor: 'pointer',
  fontSize: 14,
};
const toolbarLabelStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#888',
  minWidth: 48,
  textAlign: 'center' as const,
};
const toolbarBtnActiveStyle: React.CSSProperties = {
  background: '#0f3460',
  borderColor: '#e94560',
};
const placeholderStyle: React.CSSProperties = {
  width: 1200,
  height: 800,
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
  display: 'inline-block',
};
const debugBannerStyle: React.CSSProperties = {
  background: '#e94560',
  color: 'white',
  padding: '6px 12px',
  borderRadius: 6,
  marginBottom: 12,
  fontSize: 14,
};
const debugImgStyle: React.CSSProperties = {
  maxWidth: '100%',
  maxHeight: 600,
  borderRadius: 8,
  border: '3px solid #e94560',
};
