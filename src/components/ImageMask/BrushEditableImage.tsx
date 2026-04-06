import { forwardRef, useImperativeHandle, useRef, useEffect, useState } from "react";
import { Image as KonvaImage } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useClassificationStore } from "../../stores/classificationStore"

type BrushMode = "add" | "subtract";

export interface BrushEditableImageHandle {
  pointerDown: (e: KonvaEventObject<PointerEvent>) => void;
  pointerMove: (e: KonvaEventObject<PointerEvent>) => void;
  pointerUp: () => void;
  undo: () => void;
  redo: () => void;
}

interface BrushEditableImageProps
  extends Omit<Konva.ImageConfig, "image"> {

  image?: HTMLImageElement | null;
  externalMask?: ImageData | HTMLImageElement | null;
  enableBrush?: boolean;
  brushRadius?: number;
  brushMode?: BrushMode;
  addColor?: string;
  contentScale?: number;
}

export const BrushEditableImage = forwardRef<
  BrushEditableImageHandle,
  BrushEditableImageProps
>(({
  enableBrush = false,
  brushRadius = 20,
  brushMode = "add",
  addColor = "rgba(0,255,200,0.45)",
  image,
  externalMask,
  contentScale,
  ...rest
}, ref) => {


  const imageRef = useRef<Konva.Image>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  

  const [canvasImage] = useState(() => document.createElement("canvas"));

  const { pushMaskHistory, undoMask, redoMask, maskHistory, maskHistoryIndex } =
    useClassificationStore(s => ({
      pushMaskHistory: s.pushMaskHistory,
      undoMask: s.undoMask,
      redoMask: s.redoMask,
      maskHistory: s.maskHistory,
      maskHistoryIndex: s.maskHistoryIndex,
    }));


  const parseRGBA = (rgba: string): [number, number, number, number] => {
    const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d\.]+)?\)/);
    if (!m) return [0, 255, 0, 0.45]; // fallback

    return [
      Number(m[1]),
      Number(m[2]),
      Number(m[3]),
      Math.floor((Number(m[4] ?? 1)) * 255)
    ];
  }

  const ensureMaskExists = () => {
    if (brushMode !== "add") return;

    const store = useClassificationStore.getState();
    const hasMask = store.maskHistory.length > 0;

    if (hasMask) return;

    // Create a fully transparent mask with the correct size
    const ctx = canvasImage.getContext("2d")!;
    ctx.clearRect(0, 0, canvasImage.width, canvasImage.height);

    // const emptyMask = ctx.getImageData(0, 0, canvasImage.width, canvasImage.height);
    // pushMaskHistory(emptyMask);
  };

  useEffect(() => {
    if (!externalMask) return;

    const ctx = canvasImage.getContext("2d")!;

    //
    // ✅ Extract existing mask BEFORE resizing
    //
    let currentMask: ImageData | null = null;
    if (canvasImage.width > 0 && canvasImage.height > 0) {
      currentMask = ctx.getImageData(0, 0, canvasImage.width, canvasImage.height);
      pushMaskHistory(currentMask);
    }

    //
    // ✅ Convert externalMask (ImageData | HTMLImageElement) into ImageData
    //
    let extData: ImageData;
    let w: number;
    let h: number;

    if (externalMask instanceof ImageData) {
      extData = externalMask;
      w = externalMask.width;
      h = externalMask.height;
    } else {
      w = externalMask.width || externalMask.naturalWidth;
      h = externalMask.height || externalMask.naturalHeight;

      const temp = document.createElement("canvas");
      temp.width = w;
      temp.height = h;
      const tctx = temp.getContext("2d")!;
      tctx.drawImage(externalMask, 0, 0);
      extData = tctx.getImageData(0, 0, w, h);
    }

    //
    // ✅ Resize canvas AFTER extracting existing mask
    //
    canvasImage.width = w;
    canvasImage.height = h;

    // If sizes mismatch, treat existing mask as empty
    if (!currentMask || currentMask.width !== w || currentMask.height !== h) {
      currentMask = ctx.createImageData(w, h);
    }

    //
    // ✅ Apply addColor to external mask
    //
    const [r, g, b, a0] = parseRGBA(addColor);

    const merged = ctx.createImageData(w, h);

    for (let i = 0; i < merged.data.length; i += 4) {
      const alpha = extData.data[i + 3] || currentMask.data[i + 3];

      merged.data[i] = r;
      merged.data[i + 1] = g;
      merged.data[i + 2] = b;
      merged.data[i + 3] = alpha;
    }

    ctx.putImageData(merged, 0, 0);
    
    pushMaskHistory(merged);

    imageRef.current?.getLayer()?.batchDraw();
  }, [externalMask]);



  //
  // 1️⃣ Load initial image ONCE into persistent canvas
  //
  useEffect(() => {
    if (!image) return;

    const w = image.width || image.naturalWidth;
    const h = image.height || image.naturalHeight;

    if (!w || !h) return;

    canvasImage.width = w;
    canvasImage.height = h;

    // ⚠️ DO NOT draw base image into canvasImage.
    const ctx = canvasImage.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);

    imageRef.current?.getLayer()?.batchDraw();
  }, [image]);


  //
  // 2️⃣ Brush drawing modifies the persistent canvas
  //
  const drawAtPointer = (e: KonvaEventObject<PointerEvent>) => {
    const ctx = canvasImage.getContext("2d")!;
    const imgNode = imageRef.current;
    if (!imgNode) return;

    // Get LOCAL (image-space) pointer location
    const pos = imgNode.getRelativePointerPosition();
    if (!pos) return;

    if (brushMode === "add") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = addColor;
    } else {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)"; // stroke color irrelevant in erase mode
    }

    const scale = contentScale ?? 1;

    ctx.lineWidth = 4 * brushRadius / scale;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // If this is the first point, just move to it
    if (!lastPosRef.current) {
      lastPosRef.current = pos;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pos.x, pos.y); // a dot
      ctx.stroke();
    } else {
      // Draw a line from previous point to this point
      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastPosRef.current = pos;
    }

    if (isDrawingRef.current) {
      // rewrite alpha

      const imgData = ctx.getImageData(0, 0, canvasImage.width, canvasImage.height);
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) {
          data[i + 3] = Math.floor(255 * 0.45); // set alpha channel 
        }
      }

      ctx.putImageData(imgData, 0, 0);
    }
    imageRef.current?.getLayer()?.batchDraw();
  };



  //
  // 3️⃣ Imperative brush API
  //
  useImperativeHandle(ref, () => ({
    pointerDown: e => {
      if (!enableBrush) return;

      // must be a real left-button PRESS, not synthetic or hover
      if (e.evt.buttons === 1 && !isDrawingRef.current) {
        ensureMaskExists();
        isDrawingRef.current = true;

        const ctx = canvasImage.getContext("2d")!;
        const snapshot = ctx.getImageData(0, 0, canvasImage.width, canvasImage.height);
        pushMaskHistory(snapshot);

        drawAtPointer(e);
      }
    },
    pointerMove: e => {
      if (!isDrawingRef.current) return;
      drawAtPointer(e);
    },
    pointerUp: () => {
      if (isDrawingRef.current) {
        const ctx = canvasImage.getContext("2d")!;
        const snapshot = ctx.getImageData(0, 0, canvasImage.width, canvasImage.height);
        pushMaskHistory(snapshot);
      }

      isDrawingRef.current = false;
      lastPosRef.current = null;
    },
    undo: () => {
      const ctx = canvasImage.getContext("2d")!;
      console.log("Undo on canvas 1", [maskHistory, maskHistoryIndex]);
      const restored = undoMask();
      console.log("Undo on canvas 2", [maskHistory, maskHistoryIndex]);
      if (!restored) return;
      ctx.putImageData(restored, 0, 0);
      imageRef.current?.getLayer()?.batchDraw();
    },
    redo: () => {
      const ctx = canvasImage.getContext("2d")!;
      console.log("Redo on canvas 1", [maskHistory, maskHistoryIndex]);
      const restored = redoMask();
      console.log("Redo on canvas 2", [maskHistory, maskHistoryIndex, restored]);
      if (!restored) return;
      ctx.putImageData(restored, 0, 0);
      imageRef.current?.getLayer()?.batchDraw();
    }
  }));


  //
  // 4️⃣ Render — always use the SAME canvas instance
  //
  return (
    <KonvaImage
      ref={imageRef}
      image={canvasImage}  // <--- stable canvas always
      {...rest}
    />
  );
});
