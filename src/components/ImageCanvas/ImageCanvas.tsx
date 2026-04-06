import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Stage, Layer, Group, Image, Line, Circle } from 'react-konva';
import Konva from 'konva';
import type { KonvaEventObject } from "konva/lib/Node"
import { useClassificationStore } from '../../stores/classificationStore';
import { BrushEditableImage } from '../ImageMask/BrushEditableImage';
import { CaesarAnnotationOverlay } from '../CaesarAnnotationOverlay/CaesarAnnotationOverlay';
import type { AnnotationTool } from '../../types/annotations';
import type { BrushProps } from '../../types/tools';
import { useCaesarAnnotationStore } from '../../stores/caesarReductionStore';


interface ImageCanvasProps {
  tool: AnnotationTool;
  brushProps: BrushProps;
  onPointClick?: (x: number, y: number, label: 0 | 1) => void;
  onUndo?: () => void;
  showPoints?: boolean;
}

export function ImageCanvas({ tool, brushProps, onPointClick, onUndo, showPoints = true }: ImageCanvasProps) {
  const {
    imageUrl,
    annotations,
    addAnnotation,
    currentMaskUrl,
    debugImageUrl,
  } = useClassificationStore();

  const caesarReducedAnnotations = useCaesarAnnotationStore(s => s.annotations);
  const [selectedCaesarAnnotation, setSelectedCaesarAnnotation] = useState<string | null>(null);

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [maskImage, setMaskImage] = useState<HTMLImageElement | null>(null);
  const [debugImage, setDebugImageEl] = useState<HTMLImageElement | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<Array<{ x: number; y: number }>>([]);
  const stageRef = useRef<Konva.Stage>(null);
  const contentRef = useRef<Konva.Group>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanMode, setIsPanMode] = useState(false);
  const [suppressNextClick, setSuppressNextClick] = useState(false);
  

  const [tooltip, setTooltip] = useState({
    visible: false,
    x: 0,
    y: 0,
    text: "",
  });

  const STAGE_WIDTH = 1200;
  const STAGE_HEIGHT = 800;
  const toolCursor: string = isPanMode
    ? 'grab'
    : tool === "brush"
      ? brushProps.brushUri ?? 'crosshair'
      : tool === "modifier_brush"
        ? brushProps.predModBrushUri ?? 'crosshair'
        : tool === 'point' || tool === 'freehand'
          ? 'crosshair'
          : 'default';

  const baseScale = image
    ? Math.min(STAGE_WIDTH / image.naturalWidth, STAGE_HEIGHT / image.naturalHeight)
    : 1;
  const contentScale = baseScale * zoom;
  const centerX = (STAGE_WIDTH - (image?.naturalWidth ?? 0) * contentScale) / 2;
  const centerY = (STAGE_HEIGHT - (image?.naturalHeight ?? 0) * contentScale) / 2;
  const groupX = centerX + pan.x;
  const groupY = centerY + pan.y;

  function animateTo(targetZoom: number, targetPan: { x: number; y: number }) {
    const duration = 0.25; // seconds
    const startZoom = zoom;
    const startPan = pan;
    const startTime = performance.now();

    function step(now: number) {
      const t = Math.min((now - startTime) / (duration * 1000), 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // EaseInOutQuad

      setZoom(startZoom + (targetZoom - startZoom) * ease);
      setPan({
        x: startPan.x + (targetPan.x - startPan.x) * ease,
        y: startPan.y + (targetPan.y - startPan.y) * ease,
      });

      if (t < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

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

      if(suppressNextClick){
        // pay attention to the next click event...
        setSuppressNextClick(false);
        // ... but ignore this one
        return
      }

      if (e.evt.button !== 0) return;
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
    [tool, image, addAnnotation, onPointClick, pointerToImage, isPanMode, suppressNextClick]
  );

  // TODO: change this callback name to be more intuitive - it just handles adding a negative
  // SAM point!
  const handleContextMenu = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.evt.preventDefault();
      if (isPanMode) return;
      if (tool !== 'point' || !stageRef.current || !image) return;

      // This stops a right click also being interpreted as a left click
      // and thereby adding a positive and a negative point at the same time
      setSuppressNextClick(true);

      const pos = stageRef.current.getPointerPosition();
      if (!pos) return;
      const { x, y } = pointerToImage(pos);
      addAnnotation({ type: 'point', x, y, label: 0 });
      onPointClick?.(x, y, 0);
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
      addAnnotation({ type: 'brush', strokes: [{ points: [...drawingPoints], radius: 2 * brushProps.brushSize }] });
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

  const zoomFitAnimated = useCallback(() => {
    if (!image) return;

    // Zoom that produces fit-to-screen
    const targetZoom = 1;
    const targetContentScale = baseScale;

    const imageW = image.naturalWidth;
    const imageH = image.naturalHeight;

    // Compute where the image would be centered at that zoom
    const targetCenterX = (STAGE_WIDTH - imageW * targetContentScale) / 2;
    const targetCenterY = (STAGE_HEIGHT - imageH * targetContentScale) / 2;

    // We want groupX === targetCenterX, but:
    // groupX = centerX + pan.x
    // and centerX recomputes automatically from zoom
    //
    // Therefore: to center, pan.x must be 0.
    const targetPan = { x: 0, y: 0 };

    animateTo(targetZoom, targetPan);

  }, [image, baseScale, animateTo]);

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
    const stage = stageRef.current;
    if (!stage) return;

    stage.container().style.cursor = !debugImageUrl ? toolCursor : "default";
  }, [tool, isPanMode, toolCursor, debugImageUrl]);

  useEffect(() => {
    // Disable pan mode whenever the user selects ANY tool
    setIsPanMode(false);
  }, [tool]);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        onUndo?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onUndo]);

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


  const zoomToAnnotation = useCallback(({ x, y, width, height }) => {
    if (!image) return;

    const padding = 40;

    // Calculate required scale in stage coordinates
    const scaleX = (STAGE_WIDTH - 2 * padding) / width;
    const scaleY = (STAGE_HEIGHT - 2 * padding) / height;
    const newContentScale = Math.min(scaleX, scaleY);

    // Convert to your zoom model
    const targetZoom = newContentScale / baseScale;

    const cx = x + width / 2;
    const cy = y + height / 2;

    const targetGroupX = STAGE_WIDTH / 2 - cx * newContentScale;
    const targetGroupY = STAGE_HEIGHT / 2 - cy * newContentScale;

    const newCenterX =
      (STAGE_WIDTH - image.naturalWidth * newContentScale) / 2;
    const newCenterY =
      (STAGE_HEIGHT - image.naturalHeight * newContentScale) / 2;

    const targetPan = {
      x: targetGroupX - newCenterX,
      y: targetGroupY - newCenterY,
    };

    animateTo(targetZoom, targetPan);
  }, [image, baseScale, zoom, pan]);


  const handleCaesarAnnotationClick = (annotation, annotationId) => {
    if (selectedCaesarAnnotation === annotationId) {
      zoomFitAnimated();
      setSelectedCaesarAnnotation(null);
      return;
    }

    setSelectedCaesarAnnotation(annotationId);
    zoomToAnnotation(annotation);
  }

  if (!imageUrl) {
    return (
      <div className="canvas-placeholder" style={placeholderStyle}>
        Load an image to get started
      </div>
    );
  }

  const natW = image?.naturalWidth ?? 0;
  const natH = image?.naturalHeight ?? 0;

  const handleDown = (e: KonvaEventObject<PointerEvent>) => brushProps.predModBrushRef?.current?.pointerDown(e);
  const handleMove = (e: KonvaEventObject<PointerEvent>) => brushProps.predModBrushRef?.current?.pointerMove(e);
  const handleUp = () => brushProps.predModBrushRef?.current?.pointerUp();

  return (
    <div className="image-canvas"> {/*style={{ ...containerStyle, cursor: !debugImageUrl ? toolCursor : 'default' }}>*/}
      {!debugImageUrl && (
        <div style={toolbarStyle}>
          <button type="button" onClick={zoomOut} style={toolbarBtnStyle} title="Zoom out">-</button>
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
          {annotations.length > 0 && (
            <button
              type="button"
              onClick={() => onUndo?.()}
              style={{ ...toolbarBtnStyle, ...undoBtnStyle }}
              title="Undo last point (Ctrl+Z / ⌘Z)"
            >
              Undo
            </button>
          )}
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
          onContextMenu={handleContextMenu}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
          onMouseLeave={handleStageMouseUp}
          onWheel={handleWheel}
          onPointerDown={tool === "modifier_brush" ? handleDown : undefined}
          onPointerMove={tool === "modifier_brush" ? handleMove : undefined}
          onPointerUp={tool === "modifier_brush" ? handleUp : undefined}
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
                listening={isPanMode}
              />
              {(
                <BrushEditableImage
                  image={image}
                  externalMask={maskImage}
                  enableBrush={tool === "modifier_brush"}
                  brushRadius={brushProps.predModBrushSize}
                  brushMode={brushProps.predModBrushMode}
                  width={natW}
                  height={natH}
                  ref={brushProps.predModBrushRef}
                  contentScale={contentScale}
                />
              )}
              {caesarReducedAnnotations && (<CaesarAnnotationOverlay
                annotations={caesarReducedAnnotations}
                toolCursor={toolCursor}
                strokeWidth={2 / contentScale}
                setToolTip={setTooltip}
                onAnnotationClick={(caesarAnnotation, annotationId) => handleCaesarAnnotationClick(caesarAnnotation, annotationId)}
              />)}
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
                      fill={a.label === 0 ? '#e94560' : 'lime'}
                      stroke="white"
                      strokeWidth={1}
                      listening={false}
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
                      listening={false}
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
                          strokeWidth={stroke.radius * 2 / contentScale}
                          lineCap="round"
                          lineJoin="round"
                          listening={false}
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
                  strokeWidth={tool === 'brush' ? brushProps.brushSize * 4 / contentScale : 3}
                  lineCap="round"
                  lineJoin="round"
                />
              )}
            </Group>
          </Layer>
        </Stage>
      )}
      {tooltip.visible && (
        <div
          style={{
            position: "absolute",
            top: tooltip.y,
            left: tooltip.x,
            background: "rgba(0,0,0,0.75)",
            color: "white",
            padding: "4px 8px",
            borderRadius: "4px",
            pointerEvents: "none",      // important
            transform: "translate(-50%, -100%)"
          }}
        >
          {tooltip.text}
        </div>
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
  border: '1px solid',
  borderColor: '#333',
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
const undoBtnStyle: React.CSSProperties = {
  marginLeft: 8,
  color: '#ffa726',
  borderColor: '#ffa726',
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
  border: '3px solid',
  borderColor: '#e94560'
};
