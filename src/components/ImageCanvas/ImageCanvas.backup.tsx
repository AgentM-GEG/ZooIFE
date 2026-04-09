import React, { useRef, useState, useCallback, useEffect, useMemo, useLayoutEffect, memo } from 'react';
import styled, { keyframes } from 'styled-components';
import { theme } from '@/theme/zooniverseTheme';
import { Stage, Layer, Group, Image, Line, Circle } from 'react-konva';
import Konva from 'konva';
import type { KonvaEventObject } from "konva/lib/Node"
import { useClassificationStore } from '@/stores/classificationStore';
import { BrushEditableImage } from '@/components/ImageMask/BrushEditableImage';
import { CaesarAnnotationOverlay } from '@/components/CaesarAnnotationOverlay/CaesarAnnotationOverlay';
import type { AnnotationTool, DrawingAnnotation } from '@/types/annotations';
import type { BrushProps } from './types';
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
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow: visible;
`;

const CanvasWrapper = styled.div`
  width: 100%;
  height: 75vh;

  position: relative;
  overflow: hidden;

  background: ${theme.colors.background.surface};
  border-radius: ${theme.borders.radius.lg};

  display: block;
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
  padding: 8px 16px;
  background: ${theme.colors.primary};
  color: ${theme.colors.secondary};
  border: none;
  border-radius: ${theme.borders.radius.base};
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  cursor: pointer;
  transition: all ${theme.transitions.base};

  &:hover {
    background: ${theme.colors.border};
    opacity: 0.8;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const RedoButton = styled(ToolbarButton)`
  padding: 8px 16px;
  background: ${theme.colors.primary};
  color: ${theme.colors.secondary};
  border: none;
  border-radius: ${theme.borders.radius.base};
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  cursor: pointer;
  transition: all ${theme.transitions.base};

  &:hover {
    background: ${theme.colors.border};
    opacity: 0.8;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const ToolbarLabel = styled.span`
  font-size: ${theme.typography.size.sm};
  color: ${theme.colors.text.secondary};
  min-width: 48px;
  text-align: center;
`;

const Placeholder = styled.div`
  width: 100%;
  height: 85vh;
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
  bottom: ${theme.spacing.lg};
  right: ${theme.spacing.lg};
  max-width: 500px;
  z-index: 10;
  animation: ${(props) => props.$isLeaving ? fadeOut : fadeIn} 0.1s ease-in-out;
`;

const WarningWrapper = styled.div`
  position: relative;
  width: 100%;
`;

const MaskHistoryButtonsContainer = styled.div`
  position: relative;
  display: flex;
  margin-left: auto;
  gap: ${theme.spacing.sm};
  z-index: 20;
  transition: top 0.1s ease-out, right 0.1s ease-out;
`;

const SaveButton = styled.button`
  padding: 8px 16px;
  background: ${theme.colors.primary};
  color: ${theme.colors.secondary};
  border: none;
  border-radius: ${theme.borders.radius.base};
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  cursor: pointer;
  transition: all ${theme.transitions.base};

  &:hover {
    background: ${theme.colors.primary};
    opacity: 0.9;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const BackButton = styled.button`
  padding: 8px 16px;
  background: ${theme.colors.primary};
  color: ${theme.colors.secondary};
  border: none;
  border-radius: ${theme.borders.radius.base};
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  cursor: pointer;
  transition: all ${theme.transitions.base};

  &:hover {
    background: ${theme.colors.border};
    opacity: 0.8;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

// ============ MEMOIZED SUB-COMPONENTS ============

/**
 * Memoized annotation renderer - renders individual annotations without parent re-renders.
 * Only re-renders if the annotation itself changes.
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

/**
 * Memoized toolbar component - only re-renders when its specific props change.
 */
const CanvasToolbar = memo(({
  zoom,
  isPanMode,
  isDebugMode,
  activeAnnotationId,
  disableUndoRedo,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onZoom100,
  onTogglePan,
  onUndo,
  onSave,
  onBack,
}: {
  zoom: number;
  isPanMode: boolean;
  isDebugMode: boolean;
  activeAnnotationId: string | null;
  disableUndoRedo: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onZoom100: () => void;
  onTogglePan: () => void;
  onUndo: () => void;
  onSave: () => void;
  onBack: () => void;
}) => {
  if (isDebugMode) return null;

  return (
    <Toolbar>
      <ToolbarButton type="button" onClick={onZoomOut} title="Zoom out">-</ToolbarButton>
      <ToolbarLabel>{Math.round(zoom * 100)}%</ToolbarLabel>
      <ToolbarButton type="button" onClick={onZoomIn} title="Zoom in">+</ToolbarButton>
      <ToolbarButton type="button" onClick={onZoomFit} title="Fit to view">Fit</ToolbarButton>
      <ToolbarButton type="button" onClick={onZoom100} title="100% (1:1 pixels)">100%</ToolbarButton>
      <ToolbarButton
        type="button"
        $active={isPanMode}
        onClick={onTogglePan}
        title="Pan mode: drag to move image"
      >
        Pan
      </ToolbarButton>
      {activeAnnotationId && (
        <MaskHistoryButtonsContainer>
          <UndoButton
            type="button"
            onClick={onUndo}
            disabled={disableUndoRedo}
            title="Undo last point (Ctrl+Z / ⌘Z)"
          >
            Undo
          </UndoButton>
          <RedoButton
            type="button"
            onClick={onUndo}
            disabled={disableUndoRedo}
            title="Undo last point (Ctrl+Z / ⌘Z)"
          >
            Redo
          </RedoButton>
          <SaveButton
            type="button"
            onClick={onSave}
            title="Save mask for this annotation"
          >
            Save
          </SaveButton>
          <BackButton
            type="button"
            onClick={onBack}
            title="Return to full image view"
          >
            Back
          </BackButton>
        </MaskHistoryButtonsContainer>
      )}
    </Toolbar>
  );
});
CanvasToolbar.displayName = 'CanvasToolbar';




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
  // ============ STORE SUBSCRIPTIONS - Optimized with separate selectors ============
  
  const imageUrl = useClassificationStore(s => s.imageUrl);
  const annotations = useClassificationStore(s => s.annotations);
  const addAnnotation = useClassificationStore(s => s.addAnnotation);
  const currentMaskUrl = useClassificationStore(s => s.currentMaskUrl);
  const debugImageUrl = useClassificationStore(s => s.debugImageUrl);
  const activeAnnotationId = useClassificationStore(s => s.activeAnnotationId);
  const perAnnotationMasks = useClassificationStore(s => s.perAnnotationMasks);
  const setActiveAnnotation = useClassificationStore(s => s.setActiveAnnotation);
  const setPerAnnotationMask = useClassificationStore(s => s.setPerAnnotationMask);
  const setMask = useClassificationStore(s => s.setMask);
  const saveMask = useClassificationStore(s => s.saveMask);

  const caesarReducedAnnotations = useCaesarAnnotationStore(s => s.annotations);
  const selectedCaesarAnnotation = useCaesarAnnotationStore(s => s.selectedAnnotationId);
  const setSelectedCaesarAnnotation = useCaesarAnnotationStore(s => s.setSelectedAnnotationId);

  // ============ LOCAL STATE ============
  
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
  const [isPanMode, setIsPanMode] = useState(false);
  const [suppressNextClick, setSuppressNextClick] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 1200, height: 800 });
  
  // Combined viewport state to reduce re-renders
  const [viewportState, setViewportState] = useState({
    zoom: 1,
    pan: { x: 0, y: 0 },
  });

  const [tooltipState, setTooltipState] = useState({ visible: false, text: '', x: 0, y: 0 });

  // ============ REFS ============
  const stageRef = useRef<Konva.Stage>(null);
  const contentRef = useRef<Konva.Group>(null);
  const isInteractingRef = useRef<boolean>(false);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);

  // ============ COMPUTED VALUES ============
  const { zoom, pan } = viewportState;

  const updateStageSize = useCallback((width: number, height: number) => {
    setStageSize(prev => {
      if (prev.width === width && prev.height === height) {
        return prev;
      }
      return { width, height };
    });
  }, []);

  /**
   * Set canvas wrapper ref callback - initializes stage size from DOM.
   */
  const setCanvasWrapper = useCallback((node: HTMLDivElement | null) => {
    canvasWrapperRef.current = node;
    if (!node) return;
    const { width, height } = node.getBoundingClientRect();
    if (width > 0 && height > 0) {
      updateStageSize(width, height);
    }
  }, [updateStageSize]);


  /**
   * Initialize canvas size from ResizeObserver on mount.
   */
  useLayoutEffect(() => {
    if (!canvasWrapperRef.current) return;
    const { clientWidth, clientHeight } = canvasWrapperRef.current;
    if (clientWidth > 0 && clientHeight > 0) {
      updateStageSize(clientWidth, clientHeight);
    }
  }, [updateStageSize]);

  /**
   * Setup ResizeObserver to track canvas wrapper size changes.
   */
  useEffect(() => {
    if (!canvasWrapperRef.current) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0 && !isInteractingRef.current) {
        updateStageSize(width, height);
      }
    });

    observer.observe(canvasWrapperRef.current);
    return () => observer.disconnect();
  }, [updateStageSize]);

  /**
   * Reset zoom and pan when image loads with new dimensions.
   */
  useEffect(() => {
    if (!image) return;
    if (stageSize.width === 0 || stageSize.height === 0) return;
    setViewportState({ zoom: 1, pan: { x: 0, y: 0 } });
  }, [image, stageSize.width, stageSize.height]);

  const toolCursor: string = isPanMode
    ? 'grab'
    : tool === "brush"
      ? brushProps.brushUri ?? 'crosshair'
      : tool === "modifier_brush"
        ? brushProps.predModBrushUri ?? 'crosshair'
        : tool === 'point' || tool === 'freehand'
          ? 'crosshair'
          : 'default';


  const baseScale = useMemo(() => {
    if (!image || stageSize.width === 0 || stageSize.height === 0) return 1;
    return Math.min(
      stageSize.width / image.naturalWidth,
      stageSize.height / image.naturalHeight
    );
  }, [image, stageSize.width, stageSize.height]);

  // Separate memos for better optimization
  const contentScale = useMemo(() => baseScale * zoom, [baseScale, zoom]);

  const { groupX, groupY } = useMemo(() => {
    if (!image || stageSize.width === 0 || stageSize.height === 0) {
      return { groupX: 0, groupY: 0 };
    }
    const scale = contentScale;
    const centerX = (stageSize.width - image.naturalWidth * scale) / 2;
    const centerY = (stageSize.height - image.naturalHeight * scale) / 2;
    return {
      groupX: centerX + pan.x,
      groupY: centerY + pan.y,
    };
  }, [image, contentScale, pan, stageSize.width, stageSize.height]);


  // ============ CALLBACKS ============

  /**
   * Update canvas wrapper size and track ResizeObserver.
   * Called on component mount and when wrapper ref is set.
   */
  // (updateStageSize is already defined above)

  /**
   * Animate zoom and pan to target values over 250ms using easing.
   * @param targetZoom - Target zoom level
   * @param targetPan - Target pan offset {x, y}
   */
  const animateTo = useCallback((targetZoom: number, targetPan: { x: number; y: number }) => {
    const duration = 0.25;
    const startZoom = zoom;
    const startPan = pan;
    const startTime = performance.now();

    function step(now: number) {
      const t = Math.min((now - startTime) / (duration * 1000), 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      setViewportState({
        zoom: startZoom + (targetZoom - startZoom) * ease,
        pan: {
          x: startPan.x + (targetPan.x - startPan.x) * ease,
          y: startPan.y + (targetPan.y - startPan.y) * ease,
        },
      });

      if (t < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }, [zoom, pan]);

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
  // (Removed from useCallback to avoid dependency cycles - called directly in effect)

  /**
   * Handle stage click for adding point annotations or starting freehand drawing.
   * @param e - Konva mouse event
   */
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (isPanMode) return;

      if (suppressNextClick) {
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

  // Constants for zoom
  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 10;
  const ZOOM_STEP = 1.25;

  /**
   * Increase zoom level by ZOOM_STEP.
   */
  const zoomIn = useCallback(() => {
    setViewportState(prev => ({
      ...prev,
      zoom: Math.min(ZOOM_MAX, prev.zoom * ZOOM_STEP)
    }));
  }, []);

  /**
   * Decrease zoom level by ZOOM_STEP.
   */
  const zoomOut = useCallback(() => {
    setViewportState(prev => ({
      ...prev,
      zoom: Math.max(ZOOM_MIN, prev.zoom / ZOOM_STEP)
    }));
  }, []);

  /**
   * Reset zoom and pan to fit entire image.
   */
  const zoomFit = useCallback(() => {
    setViewportState({ zoom: 1, pan: { x: 0, y: 0 } });
  }, []);

  /**
   * Zoom to 100% (1:1 pixel ratio).
   */
  const zoom100 = useCallback(() => {
    if (!image) return;
    const fitScale = Math.min(stageSize.width / image.naturalWidth, stageSize.height / image.naturalHeight);
    setViewportState({ zoom: 1 / fitScale, pan: { x: 0, y: 0 } });
  }, [image, stageSize]);

  /**
   * Animate zoom and pan to fit entire image with smooth transition.
   */
  const zoomFitAnimated = useCallback(() => {
    if (!image) return;
    animateTo(1, { x: 0, y: 0 });
  }, [image, animateTo]);

  /**
   * Handle mouse wheel zoom events - zoom towards cursor position.
   * @param e - Konva wheel event
   */
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      isInteractingRef.current = true;
      e.evt.preventDefault();
      const scaleBy = 1.08;
      const pos = stageRef.current?.getPointerPosition();
      if (!pos || !image) return;
      const newZoom = e.evt.deltaY < 0 ? zoom * scaleBy : zoom / scaleBy;
      const clampedZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
      const newScale = baseScale * clampedZoom;
      const dx = (pos.x - groupX) / contentScale;
      const dy = (pos.y - groupY) / contentScale;
      const newCenterX = (stageSize.width - image.naturalWidth * newScale) / 2;
      const newCenterY = (stageSize.height - image.naturalHeight * newScale) / 2;
      
      setViewportState({
        zoom: clampedZoom,
        pan: {
          x: pos.x - newCenterX - dx * newScale,
          y: pos.y - newCenterY - dy * newScale,
        }
      });

      requestAnimationFrame(() => {
        isInteractingRef.current = false;
      });
    },
    [zoom, baseScale, contentScale, groupX, groupY, image, stageSize]
  );

  /**
   * Handle content drag move - pan the image when dragging in pan mode.
   * @param e - Konva drag event
   */
  const handleContentDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const newCenterX = (stageSize.width - (image?.naturalWidth ?? 0) * contentScale) / 2;
      const newCenterY = (stageSize.height - (image?.naturalHeight ?? 0) * contentScale) / 2;
      setViewportState(prev => ({
        ...prev,
        pan: { x: node.x() - newCenterX, y: node.y() - newCenterY }
      }));
    },
    [contentScale, image, stageSize]
  );

  /**
   * Update stage cursor based on tool and pan mode.
   */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.container().style.cursor = !debugImageUrl ? toolCursor : "default";
  }, [tool, isPanMode, toolCursor, debugImageUrl]);

  /**
   * Disable pan mode whenever tool changes.
   */
  useEffect(() => {
    setIsPanMode(false);
  }, [tool]);

  /**
   * Setup keyboard undo shortcut (Ctrl+Z / ⌘Z).
   */
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

  /**
   * Load main image from URL - removed handleImageLoad from dependencies to prevent cascading updates.
   */
  useEffect(() => {
    if (!imageUrl) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImage(img);
      // Update store directly without callback dependency
      useClassificationStore.setState({
        imageDimensions: { width: img.naturalWidth, height: img.naturalHeight },
      });
    };
    img.src = imageUrl;
  }, [imageUrl]);


  /**
   * Swap mask display based on active annotation being edited.
   */
  useEffect(() => {
    if (activeAnnotationId) {
      const annotationMaskState = perAnnotationMasks[activeAnnotationId];
      if (annotationMaskState?.maskUrl) {
        setMask(annotationMaskState.maskUrl);
      } else {
        setMask(null);
      }
    }
  }, [activeAnnotationId, perAnnotationMasks, setMask]);

  /**
   * Update per-annotation mask when current mask changes.
   */
  useEffect(() => {
    if (activeAnnotationId && currentMaskUrl) {
      setPerAnnotationMask(activeAnnotationId, currentMaskUrl);
    }
  }, [activeAnnotationId, currentMaskUrl, setPerAnnotationMask]);

  /**
   * Load mask overlay image from URL.
   */
  useEffect(() => {
    if (!currentMaskUrl) {
      setMaskImage(null);
      return;
    }
    const img = new window.Image();
    img.onload = () => setMaskImage(img);
    img.src = currentMaskUrl;
  }, [currentMaskUrl]);

  /**
   * Load debug image from URL.
   */
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
   * Hide warning banner when a Caesar annotation is selected.
   */
  useEffect(() => {
    if (selectedCaesarAnnotation) {
      setWarningFadingOut(true);
      setTimeout(() => {
        setNoRectangleWarning(false);
        setWarningFadingOut(false);
      }, 100);
    }
  }, [selectedCaesarAnnotation]);

  /**
   * Update stage cursor based on tool and pan mode.
   */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.container().style.cursor = !debugImageUrl ? toolCursor : "default";
  }, [tool, isPanMode, toolCursor, debugImageUrl]);

  /**
   * Disable pan mode whenever tool changes.
   */
  useEffect(() => {
    setIsPanMode(false);
  }, [tool]);

  /**
   * Setup keyboard undo shortcut (Ctrl+Z / ⌘Z).
   */
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

  /**
   * Zoom and pan to fit annotation rectangle in view with padding.
   * @param annotation - Rectangle annotation {x, y, width, height}
   */
  const zoomToAnnotation = useCallback(({ x, y, width, height }: { x: number; y: number; width: number; height: number }) => {
    if (!image) return;

    const padding = 40;
    const scaleX = (stageSize.width - 2 * padding) / width;
    const scaleY = (stageSize.height - 2 * padding) / height;
    const newContentScale = Math.min(scaleX, scaleY);
    const targetZoom = newContentScale / baseScale;

    const cx = x + width / 2;
    const cy = y + height / 2;

    const targetGroupX = stageSize.width / 2 - cx * newContentScale;
    const targetGroupY = stageSize.height / 2 - cy * newContentScale;

    const newCenterX = (stageSize.width - image.naturalWidth * newContentScale) / 2;
    const newCenterY = (stageSize.height - image.naturalHeight * newContentScale) / 2;

    const targetPan = {
      x: targetGroupX - newCenterX,
      y: targetGroupY - newCenterY,
    };

    animateTo(targetZoom, targetPan);
  }, [image, baseScale, stageSize, animateTo]);

  /**
   * Handle modifier brush pointer down - delegates to brush ref handler.
   */
  const handleDown = useCallback((e: KonvaEventObject<PointerEvent>) => {
    if (!selectedCaesarAnnotation) {
      setNoRectangleWarning(true);
    }
    brushProps.predModBrushRef?.current?.pointerDown(e);
  }, [selectedCaesarAnnotation, brushProps.predModBrushRef]);

  /**
   * Handle modifier brush pointer move - delegates to brush ref handler.
   */
  const handleMove = useCallback((e: KonvaEventObject<PointerEvent>) => {
    brushProps.predModBrushRef?.current?.pointerMove(e);
  }, [brushProps.predModBrushRef]);

  /**
   * Handle modifier brush pointer up - delegates to brush ref handler.
   */
  const handleUp = useCallback(() => {
    brushProps.predModBrushRef?.current?.pointerUp();
  }, [brushProps.predModBrushRef]);

  /**
   * Handle Caesar overlay annotation click - toggle selection and zoom to annotation.
   * @param annotation - Rectangle annotation {x, y, width, height}
   * @param annotationId - ID of the clicked annotation
   */
  const handleCaesarAnnotationClick = useCallback((annotation: { x: number; y: number; width: number; height: number }, annotationId: string) => {
    if (selectedCaesarAnnotation === annotationId) {
      zoomFitAnimated();
      setSelectedCaesarAnnotation(null);
      setActiveAnnotation(null);
      return;
    }

    setSelectedCaesarAnnotation(annotationId);
    setActiveAnnotation(annotationId);
    zoomToAnnotation(annotation);
  }, [selectedCaesarAnnotation, zoomFitAnimated, setSelectedCaesarAnnotation, setActiveAnnotation, zoomToAnnotation]);

  if (!imageUrl) {
    const { token } = useAuth();
    const placeholderText = token ? "Click 'Next subject' to start classifying" : "Log in to get started";
    return (
      <Placeholder>
        {placeholderText}
      </Placeholder>
    );
  }

  const disableUndoRedo = annotations.length === 0 || !currentMaskUrl;

  const handleSave = () => {
    saveMask(activeAnnotationId || "global");
    zoomFitAnimated();
    setSelectedCaesarAnnotation(null);
  };

  const handleBack = () => {
    setActiveAnnotation(null);
    zoomFitAnimated();
    setSelectedCaesarAnnotation(null);
  };

  return (
    <Container>
      {(noRectangleWarning || warningFadingOut) && (
        <WarningWrapper>
          <WarningBanner $isLeaving={warningFadingOut}>
            ⚠️ You have not selected a bounding box so we assume you are annotating an artifact or contaminant that was completely missed by the machine learning model.
            <SaveButton
              type="button"
              onClick={handleSave}
              title="Save mask for whole image"
            >
              Save
            </SaveButton>
          </WarningBanner>
        </WarningWrapper>
      )}

      <CanvasToolbar
        zoom={zoom}
        isPanMode={isPanMode}
        isDebugMode={!!debugImageUrl}
        activeAnnotationId={activeAnnotationId}
        disableUndoRedo={disableUndoRedo}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomFit={zoomFit}
        onZoom100={zoom100}
        onTogglePan={() => setIsPanMode(p => !p)}
        onUndo={onUndo || (() => {})}
        onSave={handleSave}
        onBack={handleBack}
      />
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
        <div style={{ width: '100%' }}>
          <CanvasWrapper ref={setCanvasWrapper}>
            <Stage
                ref={stageRef}
                width={stageSize.width}
                height={stageSize.height}
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
                        width={image?.naturalWidth ?? 0}
                        height={image?.naturalHeight ?? 0}
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
                        width={image?.naturalWidth ?? 0}
                        height={image?.naturalHeight ?? 0}
                        ref={brushProps.predModBrushRef}
                        contentScale={contentScale}
                      />
                    )}
                    {caesarReducedAnnotations && (
                      <CaesarAnnotationOverlay
                        annotations={caesarReducedAnnotations}
                        toolCursor={toolCursor}
                        strokeWidth={2 / contentScale}
                        setToolTip={setTooltipState}
                        onAnnotationClick={handleCaesarAnnotationClick}
                      />
                    )}
                    {debugImage && (
                      <Image
                        image={debugImage}
                        width={debugImage.naturalWidth ?? 0}
                        height={debugImage.naturalHeight ?? 0}
                        listening={false}
                        opacity={1}
                      />
                    )}
                    {annotations.map((annotation, i) => (
                      <AnnotationRenderer
                        key={annotation.id ?? i}
                        annotation={annotation}
                        index={i}
                        contentScale={contentScale}
                        debugImageUrl={debugImageUrl}
                        showPoints={showPoints}
                      />
                    ))}
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
          </CanvasWrapper>
        </div>
      )}
      {tooltipState.visible && (
        <div
          style={{
            position: "absolute",
            top: tooltipState.y,
            left: tooltipState.x,
            background: "rgba(0,0,0,0.75)",
            color: "white",
            padding: "4px 8px",
            borderRadius: "4px",
            pointerEvents: "none",
            transform: "translate(-50%, -100%)"
          }}
        >
          {tooltipState.text}
        </div>
      )}
    </Container>
  );
}
