import { RefObject } from "react";
import { BrushEditableImageHandle } from "../components/ImageMask/BrushEditableImage";

export interface BrushProps {
    brushSize: number;
    brushUri: string;
    predModBrushSize: number;
    predModBrushUri: string;
    predModBrushMode: string;
    predModBrushRef: RefObject<BrushEditableImageHandle> | null;
}