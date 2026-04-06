import { Rect } from "react-konva";
import { CaesarAnnotation } from "../../types/annotations";
import { TooltipState } from '../../types/tools'
import type { Dispatch, SetStateAction } from "react";


interface CaesarAnnotationOverlayProps {
    annotations: CaesarAnnotation[];
    stroke?: string;
    strokeWidth?: number;
    onAnnotationClick?: (annotation: { x: number; y: number; width: number; height: number }, annotationId: string) => void;
    selectedId?: string;
    toolCursor?: string;
    setToolTip: Dispatch<SetStateAction<TooltipState>>;
}

/**
 * Overlay component for displaying Caesar machine learning annotations.
 * Renders rectangles from Caesar reductions with tooltips and click handlers.
 * @param props - CaesarAnnotationOverlayProps configuration
 */
export function CaesarAnnotationOverlay({
    annotations,
    strokeWidth = 1,
    onAnnotationClick,
    selectedId,
    toolCursor,
    setToolTip
}: CaesarAnnotationOverlayProps) {

    return (
        <>
            {annotations.map(b => {
                if (b.toolType !== "rectangle") return null;

                const halfW = b.width / 2;
                const halfH = b.height / 2;
                const x = b.x_center - halfW;
                const y = b.y_center - halfH;

                return (
                    <Rect
                        key={b.markId}
                        x={x}
                        y={y}
                        width={b.width}
                        height={b.height}
                        stroke={b.markColour as string}
                        strokeWidth={selectedId === b.markId ? strokeWidth * 2 : strokeWidth}
                        listening={true}
                        hitStrokeWidth={strokeWidth * 5}
                        fillEnabled={false}

                        onMouseEnter={(e) => {
                            const stage = e.target.getStage();
                            const container = stage?.container();

                            if (b.markLabel && stage && container) {
                                const pointer = stage.getPointerPosition();
                                const rect = container.getBoundingClientRect();
                                if (pointer) {
                                    setToolTip({
                                        visible: true,
                                        x: rect.left + pointer.x,
                                        y: rect.top + pointer.y,
                                        text: b.markLabel as string ?? ""
                                    });
                                }
                            }

                            if (container) container.style.cursor = "pointer";
                        }}

                        onMouseMove={(e) => {
                            const stage = e.target.getStage();
                            const container = stage?.container();

                            if (b.markLabel && stage && container) {
                                const pointer = stage.getPointerPosition();
                                const rect = stage.container().getBoundingClientRect();
                                if (pointer) {
                                    setToolTip(t => ({
                                        ...t,
                                        x: rect.left + pointer.x,
                                        y: rect.top + pointer.y
                                    }));
                                }
                            }
                        }}

                        onMouseLeave={(e) => {
                            setToolTip(t => ({ ...t, visible: false }));

                            const container = e.target.getStage()?.container();
                            if (container) container.style.cursor = toolCursor ?? "default";
                        }}

                        onClick={(e) => {
                            e.cancelBubble = true;
                            onAnnotationClick?.({ x, y, width: b.width, height: b.height }, b.markId);
                        }}
                    />
                );
            })}
        </>
    );
}
