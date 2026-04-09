import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type Konva from 'konva';
import type { TooltipState } from './types';
import { ANNOTATION_HOVER_CURSOR, ANNOTATION_DEFAULT_CURSOR } from './constants';
import { getTooltipPosition } from './rectangleGeometry';

/**
 * Custom hook for managing Caesar annotation tooltip interactions.
 * Handles visibility, positioning, and cursor changes.
 * @param setToolTip - State setter for tooltip
 * @param toolCursor - Cursor to restore on leave
 * @returns Object with event handlers
 */
export function useCaesarAnnotationTooltip(
  setToolTip: Dispatch<SetStateAction<TooltipState>>,
  toolCursor: string | undefined,
  markLabel: string | undefined
) {
  /**
   * Handle mouse enter on annotation - show tooltip
   */
  const handleMouseEnter = useCallback(
    (e: Konva.KonvaEventObject<GlobalEventHandlersEventMap['mouseenter']>) => {
      if (!markLabel) return;

      const stage = e.target.getStage();
      const container = stage?.container();

      if (stage && container) {
        const pointer = stage.getPointerPosition();
        const rect = container.getBoundingClientRect();

        if (pointer) {
          const { x, y } = getTooltipPosition(pointer.x, pointer.y, rect);
          setToolTip({
            visible: true,
            x,
            y,
            text: markLabel,
          });
        }
      }

      if (container) {
        container.style.cursor = ANNOTATION_HOVER_CURSOR;
      }
    },
    [markLabel, setToolTip]
  );

  /**
   * Handle mouse move on annotation - update tooltip position
   */
  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<GlobalEventHandlersEventMap['mousemove']>) => {
      if (!markLabel) return;

      const stage = e.target.getStage();
      const container = stage?.container();

      if (stage && container) {
        const pointer = stage.getPointerPosition();
        const rect = container.getBoundingClientRect();

        if (pointer) {
          const { x, y } = getTooltipPosition(pointer.x, pointer.y, rect);
          setToolTip((t) => ({
            ...t,
            x,
            y,
          }));
        }
      }
    },
    [markLabel, setToolTip]
  );

  /**
   * Handle mouse leave on annotation - hide tooltip, restore cursor
   */
  const handleMouseLeave = useCallback(
    (e: Konva.KonvaEventObject<GlobalEventHandlersEventMap['mouseleave']>) => {
      setToolTip((t) => ({ ...t, visible: false }));

      const container = e.target.getStage()?.container();
      if (container) {
        container.style.cursor = toolCursor ?? ANNOTATION_DEFAULT_CURSOR;
      }
    },
    [toolCursor, setToolTip]
  );

  return {
    handleMouseEnter,
    handleMouseMove,
    handleMouseLeave,
  };
}
