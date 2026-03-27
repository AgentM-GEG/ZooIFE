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

interface BrushEditableImageProps extends Konva.ImageConfig {
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
  contentScale,
  ...rest
}, ref) => {

  const imageRef = useRef<Konva.Image>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const [canvasImage] = useState(() => document.createElement("canvas"));

  const pushMaskHistory = useClassificationStore(s => s.pushMaskHistory);
  const undoMask = useClassificationStore(s => s.undoMask);
  const redoMask = useClassificationStore(s => s.redoMask);
  const maskHistory = useClassificationStore(s => s.maskHistory);
  const maskHistoryIndex = useClassificationStore(s => s.maskHistoryIndex);

  //
  // 1️⃣ Load initial image ONCE into persistent canvas
  //
  useEffect(() => {
    if (!image) return;

    const loadSource = (source: any) => {
      canvasImage.width = source.width || source.naturalWidth;
      canvasImage.height = source.height || source.naturalHeight;

      const ctx = canvasImage.getContext("2d")!;
      ctx.clearRect(0, 0, canvasImage.width, canvasImage.height);
      ctx.drawImage(source, 0, 0);
      const snapshot = ctx.getImageData(0, 0, canvasImage.width, canvasImage.height);
      pushMaskHistory(snapshot);

      imageRef.current?.getLayer()?.batchDraw();
    };

    if (image instanceof HTMLImageElement) {
      if (image.complete) loadSource(image);
      else image.onload = () => loadSource(image);
    } else {
      loadSource(image);
    }

  }, [image, canvasImage]);


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
