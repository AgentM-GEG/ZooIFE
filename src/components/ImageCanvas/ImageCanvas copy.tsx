import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import styled, { keyframes } from 'styled-components';
import { theme } from '@/theme/zooniverseTheme';
import { Stage, Layer, Group, Image, Line, Circle } from 'react-konva';
import Konva from 'konva';
import type { KonvaEventObject } from "konva/lib/Node"
import { useClassificationStore } from '@/stores/classificationStore';
import { BrushEditableImage } from '@/components/ImageMask/BrushEditableImage';
import { CaesarAnnotationOverlay } from '@/components/CaesarAnnotationOverlay/CaesarAnnotationOverlay';
import type { AnnotationTool } from '@/types/annotations';
import type { BrushProps } from '@/types/tools';
import { useCaesarAnnotationStore } from '@/stores/caesarReductionStore';
import { useAuth } from '@/auth/AuthContext';

// Styled Components
const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

const fadeOut = keyframes`
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
`;

const Container = styled.div`
  background: ${theme.colors.secondary};
  border-radius: ${theme.borders.radius.lg};
  padding: ${theme.spacing.lg};
  display: inline-block;
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  margin-bottom: ${theme.spacing.md};
`;

const ToolbarButton = styled.button<{ $active?: boolean }>`
  padding: 6px 12px;
  border: 1px solid ${(props) => props.$active ? theme.colors.primary : theme.colors.border};
  border-radius: ${theme.borders.radius.base};
  background: ${(props) => props.$active ? theme.colors.primary : theme.colors.secondary};
  color: ${(props) => props.$active ? theme.colors.secondary : theme.colors.text.inverse};
  cursor: pointer;
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  transition: all ${theme.transitions.base};

  &:hover:not(:disabled) {
    background: ${theme.colors.primary};
    color: ${theme.colors.secondary};
    border-color: ${theme.colors.primary};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const UndoButton = styled(ToolbarButton)`
  margin-left: ${theme.spacing.sm};
  color: ${theme.colors.warning};
  border-color: ${theme.colors.warning};

  &:hover:not(:disabled) {
    background: ${theme.colors.warning};
    color: ${theme.colors.text.inverse};
  }

  &:disabled {
    color: ${theme.colors.warning};
    opacity: 0.5;
  }
`;

const ToolbarLabel = styled.span`
  font-size: ${theme.typography.size.sm};
  color: ${theme.colors.text.secondary};
  min-width: 48px;
  text-align: center;
`;

const Placeholder = styled.div`
  width: 1200px;
  height: 800px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${theme.colors.background.surface};
  border-radius: ${theme.borders.radius.lg};
  color: ${theme.colors.text.secondary};
  font-size: ${theme.typography.size.base};
`;

const DebugBanner = styled.div`
  background: ${theme.colors.error};
  color: ${theme.colors.text.inverse};
  padding: 6px 12px;
  border-radius: ${theme.borders.radius.base};
  margin-bottom: ${theme.spacing.md};
  font-size: ${theme.typography.size.sm};
`;

const DebugImage = styled.img`
  max-width: 100%;
  max-height: 600px;
  border-radius: ${theme.borders.radius.lg};
  border: 3px solid ${theme.colors.error};
`;

const WarningBanner = styled.div<{ $isLeaving?: boolean }>`
  background: ${theme.colors.error};
  color: ${theme.colors.text.inverse};
  padding: 12px 16px;
  border-radius: ${theme.borders.radius.base};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  position: absolute;
  top: ${theme.spacing.lg};
  right: ${theme.spacing.lg};
  max-width: 500px;
  z-index: 10;
  transform: translateX(-20px);
  animation: ${(props) => props.$isLeaving ? fadeOut : fadeIn} 0.1s ease-in-out;
`;

const WarningWrapper = styled.div`
  position: relative;
  width: 100%;
`;


interface ImageCanvasProps {
  tool: AnnotationTool;
  brushProps: BrushProps;
  onPointClick?: (x: number, y: number, label: 0 | 1) => void;
  onUndo?: () => void;
  showPoints?: boolean;
}

/**
 * Main canvas component for image display and annotation tools.
 * Handles point annotations, freehand drawing, SAM2 segmentation, and brush editing.
 * Uses Konva for rendering and transformation.
 * @param props - ImageCanvasProps configuration
 */
export function ImageCanvas({ tool, brushProps, onPointClick, onUndo, showPoints = true }: ImageCanvasProps) {
  const {
    imageUrl,
    annotations,
    addAnnotation,
    currentMaskUrl,
    debugImageUrl,
  } = useClassificationStore(s => ({
    imageUrl: s.imageUrl,
    annotations: s.annotations,
    addAnnotation: s.addAnnotation,
    currentMaskUrl: s.currentMaskUrl,
    debugImageUrl: s.debugImageUrl,
  }));

  const caesarReducedAnnotations = useCaesarAnnotationStore(s => s.annotations);
  const selectedCaesarAnnotation = useCaesarAnnotationStore(s => s.selectedAnnotationId);
  const setSelectedCaesarAnnotation = useCaesarAnnotationStore(s => s.setSelectedAnnotationId);
  const [noRectangleWarning, setNoRectangleWarning] = useState(false);
  const [warningFadingOut, setWarningFadingOut] = useState(false);

  // Hide warning when a Caesar annotation is selected
  useEffect(() => {
    if (selectedCaesarAnnotation) {
      setWarningFadingOut(true);
      setTimeout(() => {
        setNoRectangleWarning(false);
        setWarningFadingOut(false);
      }, 100);
    }
  }, [selectedCaesarAnnotation]);

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

  const { baseScale, contentScale, groupX, groupY } = useMemo(() => {
    const baseScale = image
      ? Math.min(STAGE_WIDTH / image.naturalWidth, STAGE_HEIGHT / image.naturalHeight)
      : 1;
    const contentScale = baseScale * zoom;
    const centerX = (STAGE_WIDTH - (image?.naturalWidth ?? 0) * contentScale) / 2;
    const centerY = (STAGE_HEIGHT - (image?.naturalHeight ?? 0) * contentScale) / 2;
    const groupX = centerX + pan.x;
    const groupY = centerY + pan.y;
    return { baseScale, contentScale, groupX, groupY };
  }, [image, zoom, pan]);

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

  /**
   * Convert pointer position in stage coordinates to image coordinates.
   * @param pos - Position in stage {x, y}
   * @returns Position in image {x, y}
   */
  const pointerToImage = useCallback(
    (pos: { x: number; y: number }) => ({
      x: (pos.x - groupX) / contentScale,
      y: (pos.y - groupY) / contentScale,
    }),
    [groupX, groupY, contentScale]
  );

  /**
   * Handle image load - update store with natural dimensions.
   * @param img - Loaded HTMLImageElement
   */
  const handleImageLoad = useCallback((img: HTMLImageElement) => {
    useClassificationStore.setState({
      imageDimensions: { width: img.naturalWidth, height: img.naturalHeight },
    });
  }, []);

  /**
   * Handle stage click for adding point annotations or starting freehand drawing.
   * @param e - Konva mouse event
   */
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

      if (tool === 'point' && !selectedCaesarAnnotation) {
        setNoRectangleWarning(true);
      }

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
    [tool, image, addAnnotation, onPointClick, pointerToImage, isPanMode, suppressNextClick, selectedCaesarAnnotation]
  );

  /**
   * Handle right-click context menu - add negative SAM point (background).
   * @param e - Konva mouse event
   */
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

  /**
   * Handle stage mouse move - update drawing points for freehand/brush tools.
   * @param e - Konva mouse event
   */
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

  /**
   * Handle stage mouse up - finalize drawing annotation when mouse released.
   */
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

  /**
   * Increase zoom level.
   */
  const zoomIn = useCallback(() => setZoom((z) => Math.min(ZOOM_MAX, z * ZOOM_STEP)), []);

  /**
   * Decrease zoom level.
   */
  const zoomOut = useCallback(() => setZoom((z) => Math.max(ZOOM_MIN, z / ZOOM_STEP)), []);

  /**
   * Reset zoom and pan to fit entire image.
   */
  const zoomFit = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  /**
   * Zoom to 100% (1:1 pixel ratio).
   */
  const zoom100 = useCallback(() => {
    if (!image) return;
    const fitScale = Math.min(STAGE_WIDTH / image.naturalWidth, STAGE_HEIGHT / image.naturalHeight);
    setZoom(1 / fitScale);
    setPan({ x: 0, y: 0 });

  }, [image]);

  /**
   * Animate zoom and pan to fit entire image with animation.
   */
  const zoomFitAnimated = useCallback(() => {
    if (!image) return;

    // Zoom that produces fit-to-screen
    const targetZoom = 1;

    // We want groupX === targetCenterX, but:
    // groupX = centerX + pan.x
    // and centerX recomputes automatically from zoom
    //
    // Therefore: to center, pan.x must be 0.
    const targetPan = { x: 0, y: 0 };

    animateTo(targetZoom, targetPan);

  }, [image, baseScale, animateTo]);

  /**
   * Handle mouse wheel zoom events.
   * @param e - Konva wheel event
   */
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

  /**
   * Handle content drag move - pan the image.
   * @param e - Konva drag event
   */
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


  /**
   * Zoom and pan to fit annotation rectangle in view.
   * @param annotation - Rectangle annotation {x, y, width, height}
   */
  const zoomToAnnotation = useCallback(({ x, y, width, height }: { x: number; y: number; width: number; height: number }) => {
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


  /**
   * Handle Caesar overlay annotation click - toggle selection and zoom to annotation.
   * @param annotation - Rectangle annotation {x, y, width, height}
   * @param annotationId - ID of the clicked annotation
   */
  const handleCaesarAnnotationClick = (annotation: { x: number; y: number; width: number; height: number }, annotationId: string): void => {
    if (selectedCaesarAnnotation === annotationId) {
      zoomFitAnimated();
      setSelectedCaesarAnnotation(null);
      return;
    }

    setSelectedCaesarAnnotation(annotationId);
    zoomToAnnotation(annotation);
  }

  if (!imageUrl) {
    const { token } = useAuth();
    const placeholderText = token ? "Click 'Next subject' to start classifying" : "Log in to get started";
    return (
      <Placeholder>
        {placeholderText}
      </Placeholder>
    );
  }

  const natW = image?.naturalWidth ?? 0;
  const natH = image?.naturalHeight ?? 0;

  const handleDown = (e: KonvaEventObject<PointerEvent>) => {
    if (!selectedCaesarAnnotation) {
      setNoRectangleWarning(true);
    }
    brushProps.predModBrushRef?.current?.pointerDown(e);
  };
  const handleMove = (e: KonvaEventObject<PointerEvent>) => brushProps.predModBrushRef?.current?.pointerMove(e);
  const handleUp = () => brushProps.predModBrushRef?.current?.pointerUp();

  return (
    <Container>
      {(noRectangleWarning || warningFadingOut) && (
        <WarningWrapper>
          <WarningBanner $isLeaving={warningFadingOut}>
            ⚠️ You have not selected a bounding box so we assume you are annotating an artifact or contaminant that was completely missed by the machine learning model.
          </WarningBanner>
        </WarningWrapper>
      )}
      {!debugImageUrl && (
        <Toolbar>
          <ToolbarButton type="button" onClick={zoomOut} title="Zoom out">-</ToolbarButton>
          <ToolbarLabel>{Math.round(zoom * 100)}%</ToolbarLabel>
          <ToolbarButton type="button" onClick={zoomIn} title="Zoom in">+</ToolbarButton>
          <ToolbarButton type="button" onClick={zoomFit} title="Fit to view">Fit</ToolbarButton>
          <ToolbarButton type="button" onClick={zoom100} title="100% (1:1 pixels)">100%</ToolbarButton>
          <ToolbarButton
            type="button"
            $active={isPanMode}
            onClick={() => setIsPanMode((p) => !p)}
            title="Pan mode: drag to move image"
          >
            Pan
          </ToolbarButton>
          <UndoButton
            type="button"
            onClick={() => onUndo?.()}
            disabled={annotations.length === 0 || !currentMaskUrl}
            title="Undo last point (Ctrl+Z / ⌘Z)"
          >
            Undo
          </UndoButton>
        </Toolbar>
      )}
      {debugImageUrl && (
        <>
          <DebugBanner>
            Debug: Red marker shows where server received your click
          </DebugBanner>
          <DebugImage
            src={debugImageUrl}
            alt="Debug: server received point location"
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
              {image && (
                <Image
                  image={image}
                  width={natW}
                  height={natH}
                  listening={isPanMode}
                />
              )}
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
                onAnnotationClick={handleCaesarAnnotationClick}
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
    </Container>
  );
}
