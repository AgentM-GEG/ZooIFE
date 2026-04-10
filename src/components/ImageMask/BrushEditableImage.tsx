import { forwardRef, useImperativeHandle, useRef, useEffect, useState } from "react";
import { Image as KonvaImage } from "react-konva";
import type Konva from "konva";
import type { BrushEditableImageHandle } from "@/types/tools";
import type { BrushEditableImageProps } from "./types";
import { BRUSH_DEFAULTS, DRAWING_CONFIG } from "./constants";
import { parseRGBA, sourceToImageData, applyColorToMask, normalizeAlpha } from "./brushUtils";
import { useMaskHistory } from "./useMaskHistory";
import { useClassificationStore } from "@/stores/classificationStore";

/**
 * Brush-editable image component for interactive mask drawing and editing.
 * Provides pointer event handling for brush strokes with undo/redo support.
 * Renders as a Konva Image with custom drawing capabilities.
 * @param props - BrushEditableImageProps configuration
 * @param ref - Imperative handle for brush operations (pointerDown, pointerMove, pointerUp, undo, redo)
 */
export const BrushEditableImage = forwardRef<
  BrushEditableImageHandle,
  BrushEditableImageProps
>(({
  enableBrush = BRUSH_DEFAULTS.ENABLE_BRUSH,
  brushRadius = BRUSH_DEFAULTS.BRUSH_RADIUS,
  brushMode = BRUSH_DEFAULTS.BRUSH_MODE,
  addColor = BRUSH_DEFAULTS.ADD_COLOR,
  image,
  externalMask,
  contentScale,
  ...rest
}, ref) => {


  const imageRef = useRef<Konva.Image>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  
  const [canvasImage] = useState(() => document.createElement("canvas"));

  const {
    handlePushMaskHistory,
    handleUndoMask,
    handleRedoMask,
    handleUpdateMaskDisplay,
  } = useMaskHistory();


  /**
   * Ensure a mask exists in history for add mode brush operations.
   * Creates an empty transparent mask if needed.
   */
  const ensureMaskExists = () => {
    if (brushMode !== "add") return;

    const store = useClassificationStore.getState();
    const annotationId = store.activeAnnotationId || '-1';
    const activeMaskState = store.perAnnotationMasks[annotationId];

    const hasMask = activeMaskState && activeMaskState.history.length > 0;

    if (hasMask) return;

    const ctx = canvasImage.getContext("2d")!;
    ctx.clearRect(0, 0, canvasImage.width, canvasImage.height);
  };

  useEffect(() => {
    if (!externalMask) {
      // Clear the canvas when there's no external mask (e.g., historyIndex = -1)
      const ctx = canvasImage.getContext("2d")!;
      ctx.clearRect(0, 0, canvasImage.width, canvasImage.height);
      imageRef.current?.getLayer()?.batchDraw();
      return;
    }

    const ctx = canvasImage.getContext("2d")!;

    // Convert externalMask to ImageData and get dimensions
    const { data: extData, width: w, height: h } = sourceToImageData(externalMask);

    // Resize canvas to match external mask
    canvasImage.width = w;
    canvasImage.height = h;

    // Apply addColor to external mask and display it
    const colorTuple = parseRGBA(addColor);
    const merged = ctx.createImageData(w, h);
    applyColorToMask(merged, extData, colorTuple);

    ctx.putImageData(merged, 0, 0);

    // NOTE: We do NOT push to history here. The externalMask is a display update
    // (e.g., from undo/redo or switching annotations). Only user-initiated drawing
    // (pointerUp) should create history entries.

    imageRef.current?.getLayer()?.batchDraw();
  }, [externalMask]);



  useEffect(() => {
    if (!image) return;

    const w = image.width || image.naturalWidth;
    const h = image.height || image.naturalHeight;

    if (!w || !h) return;

    canvasImage.width = w;
    canvasImage.height = h;

    const ctx = canvasImage.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);

    imageRef.current?.getLayer()?.batchDraw();
  }, [image]);


  /**
   * Draw brush stroke at pointer position.
   * Applies brush or eraser effect based on brushMode.
   * @param _e - Pointer event from Konva
   */
  const drawAtPointer = (_e: any) => {
    const ctx = canvasImage.getContext("2d")!;
    const imgNode = imageRef.current;
    if (!imgNode) return;

    const pos = imgNode.getRelativePointerPosition();
    if (!pos) return;

    if (brushMode === "add") {
      ctx.globalCompositeOperation = DRAWING_CONFIG.ADD_COMPOSITE;
      ctx.strokeStyle = addColor;
    } else {
      ctx.globalCompositeOperation = DRAWING_CONFIG.ERASE_COMPOSITE;
      ctx.strokeStyle = DRAWING_CONFIG.ERASE_STROKE_COLOR;
    }

    const scale = contentScale ?? 1;
    ctx.lineWidth = DRAWING_CONFIG.LINE_WIDTH_MULTIPLIER * brushRadius / scale;
    ctx.lineCap = DRAWING_CONFIG.LINE_CAP;
    ctx.lineJoin = DRAWING_CONFIG.LINE_JOIN;

    if (!lastPosRef.current) {
      lastPosRef.current = pos;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastPosRef.current = pos;
    }

    if (isDrawingRef.current) {
      const imgData = ctx.getImageData(0, 0, canvasImage.width, canvasImage.height);
      normalizeAlpha(imgData, DRAWING_CONFIG.STROKE_ALPHA);
      ctx.putImageData(imgData, 0, 0);
    }

    imageRef.current?.getLayer()?.batchDraw();
  };



  useImperativeHandle(ref, () => ({
    pointerDown: (e) => {
      if (!enableBrush) return;

      if (e.evt.buttons === 1 && !isDrawingRef.current) {
        ensureMaskExists();
        isDrawingRef.current = true;

        drawAtPointer(e);
      }
    },
    pointerMove: (e) => {
      if (!isDrawingRef.current) return;
      drawAtPointer(e);
    },
    pointerUp: () => {
      if (isDrawingRef.current) {
        const ctx = canvasImage.getContext("2d")!;
        const snapshot = ctx.getImageData(0, 0, canvasImage.width, canvasImage.height);
        handlePushMaskHistory(snapshot);
        
        // Update mask display after pushing to history
        const maskUrl = canvasImage.toDataURL('image/png');
        handleUpdateMaskDisplay(maskUrl);
      }

      isDrawingRef.current = false;
      lastPosRef.current = null;
    },
    undo: () => {
      const ctx = canvasImage.getContext("2d")!;
      const restored = handleUndoMask();
      if (!restored) return;
      ctx.putImageData(restored, 0, 0);
      imageRef.current?.getLayer()?.batchDraw();
    },
    redo: () => {
      const ctx = canvasImage.getContext("2d")!;
      const restored = handleRedoMask();
      if (!restored) return;
      ctx.putImageData(restored, 0, 0);
      imageRef.current?.getLayer()?.batchDraw();
    },
  }));


  return (
    <KonvaImage
      ref={imageRef}
      image={canvasImage}
      {...rest}
    />
  );
});
