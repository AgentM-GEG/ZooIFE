import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type Konva from 'konva';
import type { TooltipState } from './types';
import { ANNOTATION_DEFAULT_CURSOR, getAnnotationCursor } from './constants';
import { getTooltipPosition } from './rectangleGeometry';

/**
 * Custom hook for managing Caesar annotation tooltip interactions.
 * Handles visibility, positioning, and cursor changes.
 * Tooltip text: shows "Deselect this box" if selected, otherwise shows markLabel.
 * Shows zoom in (🔍+) or zoom out (🔍-) icon based on selection state.
 * @param setToolTip - State setter for tooltip
 * @param toolCursor - Cursor to restore on leave
 * @param markLabel - Label to show in tooltip (when not selected)
 * @param isSelected - Whether this annotation is currently selected
 * @returns Object with event handlers
 */
export function useCaesarAnnotationTooltip(
  setToolTip: Dispatch<SetStateAction<TooltipState>>,
  toolCursor: string | undefined,
  markLabel: string | undefined,
  isSelected: boolean = false
) {
  /**
   * Handle mouse enter on annotation - show tooltip with label
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
          const tooltipText = isSelected ? 'Deselect this box' : markLabel;
          setToolTip({
            visible: true,
            x,
            y,
            text: tooltipText,
          });
        }
      }

      if (container) {
        container.style.cursor = getAnnotationCursor(isSelected);
      }
    },
    [markLabel, isSelected, setToolTip]
  );

  /**
   * Handle mouse move on annotation - update tooltip position and maintain cursor
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
          const tooltipText = isSelected ? 'Deselect this box' : markLabel;
          setToolTip((t) => ({
            ...t,
            x,
            y,
            text: tooltipText,
          }));
        }

        // Keep cursor consistent as user moves within the hit buffer zone
        container.style.cursor = getAnnotationCursor(isSelected);
      }
    },
    [markLabel, isSelected, setToolTip]
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
