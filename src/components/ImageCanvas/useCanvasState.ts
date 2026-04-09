import { useCallback, useEffect, useLayoutEffect, useRef, useMemo, useState } from 'react';
import Konva from 'konva';
import type { ViewportState, StageSize } from './types';
import { useClassificationStore } from '@/stores/classificationStore';

/**
 * Hook for managing canvas viewport state (zoom, pan), stage sizing, and image loading.
 *
 * Handles:
 * - Viewport state management (zoom level and pan offset)
 * - Stage size tracking with ResizeObserver
 * - Image/mask/debug image loading and caching
 * - Canvas dimension calculations and content scaling
 *
 * @param imageUrl - URL of main image to display
 * @param maskUrl - URL of mask overlay image
 * @param debugImageUrl - URL of debug image (when present, hides annotations)
 * @returns Object containing viewport state, sizing, images, refs, and scale calculations
 */
export function useCanvasState(
  imageUrl: string | null,
  maskUrl: string | null,
  debugImageUrl: string | null
) {
  // ============ LOCAL STATE ============
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [maskImage, setMaskImage] = useState<HTMLImageElement | null>(null);
  const [debugImage, setDebugImageEl] = useState<HTMLImageElement | null>(null);
  const [stageSize, setStageSize] = useState<StageSize>({ width: 1200, height: 800 });

  // Combined viewport state to reduce re-renders
  const [viewportState, setViewportState] = useState<ViewportState>({
    zoom: 1,
    pan: { x: 0, y: 0 },
  });

  // ============ REFS ============
  const stageRef = useRef<Konva.Stage>(null);
  const contentRef = useRef<Konva.Group>(null);
  const isInteractingRef = useRef<boolean>(false);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);

  // ============ COMPUTED VALUES ============
  const { zoom, pan } = viewportState;

  /**
   * Update stage size with deduplication to prevent unnecessary re-renders.
   */
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

  /**
   * Calculate base scale to fit image in stage (before zoom).
   */
  const baseScale = useMemo(() => {
    if (!image || stageSize.width === 0 || stageSize.height === 0) return 1;
    return Math.min(
      stageSize.width / image.naturalWidth,
      stageSize.height / image.naturalHeight
    );
  }, [image, stageSize.width, stageSize.height]);

  /**
   * Calculate content scale (base scale * zoom).
   */
  const contentScale = useMemo(() => baseScale * zoom, [baseScale, zoom]);

  /**
   * Calculate group position to center content and apply pan offset.
   */
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
   * Load main image from URL.
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
   * Load mask overlay image from URL.
   */
  useEffect(() => {
    if (!maskUrl) {
      setMaskImage(null);
      return;
    }
    const img = new window.Image();
    img.onload = () => setMaskImage(img);
    img.src = maskUrl;
  }, [maskUrl]);

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

  return {
    // State
    viewportState,
    setViewportState,
    stageSize,
    image,
    maskImage,
    debugImage,
    
    // Refs
    stageRef,
    contentRef,
    canvasWrapperRef,
    isInteractingRef,
    
    // Callbacks
    setCanvasWrapper,
    updateStageSize,
    animateTo,
    
    // Computed values
    zoom,
    pan,
    baseScale,
    contentScale,
    groupX,
    groupY,
  };
}
