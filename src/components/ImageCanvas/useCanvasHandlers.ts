import { useCallback } from 'react';
import Konva from 'konva';
import type { AnnotationTool, DrawingAnnotation } from '@/types/annotations';
import type { BrushProps } from './types';

interface UseCanvasHandlersProps {
  tool: AnnotationTool;
  brushProps: BrushProps;
  image: HTMLImageElement | null;
  isPanMode: boolean;
  suppressNextClick: boolean;
  setSuppressNextClick: (value: boolean) => void;
  selectedCaesarAnnotation: string | null;
  drawingPoints: Array<{ x: number; y: number }>;
  setDrawingPoints: (points: Array<{ x: number; y: number }>) => void;
  zoom: number;
  baseScale: number;
  contentScale: number;
  groupX: number;
  groupY: number;
  stageSize: { width: number; height: number };
  stageRef: React.RefObject<Konva.Stage>;
  isInteractingRef: React.MutableRefObject<boolean>;
  addAnnotation: (annotation: DrawingAnnotation) => void;
  onPointClick?: (x: number, y: number, label: 0 | 1) => void;
  setNoRectangleWarning: (value: boolean) => void;
  setViewportState: (state: { zoom: number; pan: { x: number; y: number } }) => void;
  animateTo: (zoom: number, pan: { x: number; y: number }) => void;
}

/**
 * Hook for managing all canvas event handlers and zoom control functions.
 *
 * Handles:
 * - Mouse events (click, context menu, move, up)
 * - Wheel zoom events
 * - Drag/pan events
 * - Zoom control functions (zoom in/out, fit, 100%)
 * - Pointer-to-image coordinate conversion
 *
 * @returns Object containing all event handlers and zoom controls
 */
export function useCanvasHandlers(props: UseCanvasHandlersProps) {
  const {
    tool,
    brushProps,
    image,
    isPanMode,
    suppressNextClick,
    setSuppressNextClick,
    selectedCaesarAnnotation,
    drawingPoints,
    setDrawingPoints,
    zoom,
    baseScale,
    contentScale,
    groupX,
    groupY,
    stageSize,
    stageRef,
    isInteractingRef,
    addAnnotation,
    onPointClick,
    setNoRectangleWarning,
    setViewportState,
    animateTo,
  } = props;

  // Constants for zoom
  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 10;
  const ZOOM_STEP = 1.25;

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
   * Handle stage click for adding point annotations or starting freehand drawing.
   * @param e - Konva mouse event
   */
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (isPanMode) return;

      if (suppressNextClick) {
        setSuppressNextClick(false);
        return;
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
        setDrawingPoints([...drawingPoints, { x, y }]);
      }
    },
    [tool, image, addAnnotation, onPointClick, pointerToImage, isPanMode, suppressNextClick, selectedCaesarAnnotation, drawingPoints, setDrawingPoints, stageRef, setNoRectangleWarning]
  );

  /**
   * Handle right-click context menu - add negative SAM point (background).
   * @param e - Konva mouse event
   */
  const handleContextMenu = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.evt.preventDefault();
      if (isPanMode) return;
      if (tool !== 'point' || !stageRef.current || !image) return;

      setSuppressNextClick(true);

      const pos = stageRef.current.getPointerPosition();
      if (!pos) return;
      const { x, y } = pointerToImage(pos);
      addAnnotation({ type: 'point', x, y, label: 0 });
      onPointClick?.(x, y, 0);
    },
    [tool, image, addAnnotation, onPointClick, pointerToImage, isPanMode, stageRef, setSuppressNextClick]
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
      setDrawingPoints([...drawingPoints, { x, y }]);
    },
    [tool, image, pointerToImage, isPanMode, drawingPoints, setDrawingPoints, stageRef]
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
  }, [tool, drawingPoints, addAnnotation, isPanMode, brushProps.brushSize, setDrawingPoints]);

  /**
   * Increase zoom level by ZOOM_STEP.
   */
  const zoomIn = useCallback(() => {
    setViewportState({
      zoom: Math.min(ZOOM_MAX, zoom * ZOOM_STEP),
      pan: { x: 0, y: 0 },
    });
  }, [zoom, setViewportState]);

  /**
   * Decrease zoom level by ZOOM_STEP.
   */
  const zoomOut = useCallback(() => {
    setViewportState({
      zoom: Math.max(ZOOM_MIN, zoom / ZOOM_STEP),
      pan: { x: 0, y: 0 },
    });
  }, [zoom, setViewportState]);

  /**
   * Reset zoom and pan to fit entire image.
   */
  const zoomFit = useCallback(() => {
    setViewportState({ zoom: 1, pan: { x: 0, y: 0 } });
  }, [setViewportState]);

  /**
   * Zoom to 100% (1:1 pixel ratio).
   */
  const zoom100 = useCallback(() => {
    if (!image) return;
    const fitScale = Math.min(stageSize.width / image.naturalWidth, stageSize.height / image.naturalHeight);
    setViewportState({ zoom: 1 / fitScale, pan: { x: 0, y: 0 } });
  }, [image, stageSize, setViewportState]);

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
    [zoom, baseScale, contentScale, groupX, groupY, image, stageSize, setViewportState, stageRef, isInteractingRef]
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
      setViewportState({
        zoom,
        pan: { x: node.x() - newCenterX, y: node.y() - newCenterY }
      });
    },
    [contentScale, image, stageSize, zoom, setViewportState]
  );

  return {
    pointerToImage,
    handleStageClick,
    handleContextMenu,
    handleStageMouseMove,
    handleStageMouseUp,
    handleWheel,
    handleContentDragMove,
    zoomIn,
    zoomOut,
    zoomFit,
    zoom100,
    zoomFitAnimated,
  };
}
