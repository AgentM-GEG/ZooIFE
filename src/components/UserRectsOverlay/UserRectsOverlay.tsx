import { Rect } from 'react-konva';
import { useState, useRef, useEffect } from 'react';
import { useClassificationStore } from '@/stores/classificationStore';
import { getAnnotationCursor, ANNOTATION_DEFAULT_CURSOR } from '@/components/CaesarAnnotationOverlay/constants';
import { useCaesarAnnotationTooltip } from '@/components/CaesarAnnotationOverlay/useCaesarAnnotationTooltip';
import type { TooltipState } from '@/components/CaesarAnnotationOverlay/types';
import type { Dispatch, SetStateAction } from 'react';
import type { UserRectState } from '@/stores/classificationStore';

function UserRect({
  rectId,
  rect,
  isSelected,
  opacity,
  baseStrokeWidth,
  onMouseEnter,
  onMouseLeave,
  onMouseMove,
  onClick,
  onTap,
  toolCursor,
  markLabel,
  hasUnsavedChanges,
  setToolTip,
}: {
  rectId: string;
  rect: UserRectState;
  isSelected: boolean;
  isHovered: boolean;
  opacity: number;
  baseStrokeWidth: number;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onMouseMove: (e: any) => void;
  onClick: (e: any) => void;
  onTap: (e: any) => void;
  toolCursor: string;
  markLabel: string;
  hasUnsavedChanges: boolean;
  setToolTip: Dispatch<SetStateAction<TooltipState>>;
}) {
  const rectRef = useRef<any>(null);
  const prevBoundsRef = useRef<UserRectState>(rect);
  const prevOpacityRef = useRef<number | null>(null);
  const [displayedBounds, setDisplayedBounds] = useState<UserRectState>(rect);

  // Animate when rect bounds change (e.g., after Save operation)
  useEffect(() => {
    const prev = prevBoundsRef.current;
    const curr = rect;

    // Check if anything changed
    if (prev.x !== curr.x || prev.y !== curr.y || prev.width !== curr.width || prev.height !== curr.height) {
      // Animate to new bounds over 0.2 seconds
      if (rectRef.current) {
        rectRef.current.to({
          x: curr.x,
          y: curr.y,
          width: curr.width,
          height: curr.height,
          duration: 0.2,
          onFinish: () => {
            // Ensure bounds are exactly correct after animation
            setDisplayedBounds(curr);
          },
        });
      }
      prevBoundsRef.current = curr;
    } else {
      // No animation needed, just update displayed bounds
      setDisplayedBounds(curr);
    }
  }, [rect]);

  // Animate opacity changes with Caesar-style animation timing
  // 200ms fade-in (slower) when becoming visible, 100ms fade-out (faster) when dimming
  useEffect(() => {
    if (rectRef.current) {
      const prevOpacity = prevOpacityRef.current;
      const rect = (rectRef.current as any);
      
      // On first mount, set opacity directly without animation
      if (prevOpacity === null) {
        rect.opacity(opacity);
      } else if (opacity !== prevOpacity) {
        // For subsequent updates, animate the change
        const isFadingIn = opacity > prevOpacity;
        const duration = isFadingIn ? 0.2 : 0.1; // 200ms fade-in, 100ms fade-out
        rect.to({ opacity, duration });
      }
    }
    prevOpacityRef.current = opacity;
  }, [opacity]);

  const strokeWidth = isSelected ? baseStrokeWidth * 2 : baseStrokeWidth;

  // Tooltip handler hook - reuses Caesar annotation tooltip logic
  const tooltipHandlers = useCaesarAnnotationTooltip(
    setToolTip,
    toolCursor,
    markLabel,
    isSelected
  );

  return (
    <Rect
      ref={rectRef}
      key={rectId}
      x={displayedBounds.x}
      y={displayedBounds.y}
      width={displayedBounds.width}
      height={displayedBounds.height}
      stroke={rect.markColour}
      strokeWidth={strokeWidth}
      dash={hasUnsavedChanges ? [5, 5] : undefined}
      fillEnabled={false}
      listening={true}
      hitStrokeWidth={baseStrokeWidth * 4} // Make hit area larger for easier clicking
      onMouseEnter={(e) => {
        onMouseEnter();
        tooltipHandlers.handleMouseEnter(e);
      }}
      onMouseLeave={(e) => {
        onMouseLeave();
        tooltipHandlers.handleMouseLeave(e);
      }}
      onMouseMove={(e) => {
        onMouseMove(e);
        tooltipHandlers.handleMouseMove(e);
      }}
      onClick={(e) => {
        e.cancelBubble = true;
        onClick(e);
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onTap(e);
      }}
    />
  );
}

/**
 * User-created rects overlay component.
 * 
 * Renders bounding boxes that were created by the user from segmentation masks.
 * Styled with blue color and dotted stroke pattern to distinguish from Caesar rects.
 * Supports clicking to select/zoom to rect (same interaction as Caesar rects).
 * Handles cursor changes and dimming on hover, matching Caesar rect behavior.
 * Displays tooltips with "Volunteer-defined object" label when hovering.
 * Stroke width scales with canvas zoom level (contentScale) for consistency.
 * 
 * User rects:
 * - Have negative IDs (-2, -3, -4, etc.)
 * - Are created by the "Identify new object" button
 * - Encompass the bounding box of the -1 mask
 * - Can be clicked to zoom in and edit
 * 
 * @param onRectClick - Callback when user rect is clicked (annotation geometry and ID)
 * @param selectedRectId - ID of currently selected user rect for highlight
 * @param toolCursor - Cursor to use when not hovering (default: 'default')
 * @param onMouseEnter - Callback when mouse enters any user rect
 * @param onMouseLeave - Callback when mouse leaves any user rect
 * @param isHoveringOverCaesarRect - Whether cursor is over a Caesar rect (for dimming)
 * @param setToolTip - Tooltip state setter for displaying hover labels
 * @param contentScale - Canvas zoom scale factor (used to scale stroke width inversely)
 * 
 * @example
 * <UserRectsOverlay 
 *   onRectClick={(rect, id) => console.log('Clicked', id)}
 *   selectedRectId="-2"
 *   toolCursor="default"
 *   onMouseEnter={() => {}}
 *   onMouseLeave={() => {}}
 *   setToolTip={setTooltipState}
 *   contentScale={1.5}
 * />
 */
export function UserRectsOverlay({
  onRectClick,
  selectedRectId,
  toolCursor = ANNOTATION_DEFAULT_CURSOR,
  onMouseEnter,
  onMouseLeave,
  isHoveringOverCaesarRect = false,
  setToolTip,
  contentScale = 1,
}: {
  onRectClick?: (rect: UserRectState, rectId: string) => void;
  selectedRectId?: string;
  toolCursor?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  isHoveringOverCaesarRect?: boolean;
  setToolTip: Dispatch<SetStateAction<TooltipState>>;
  contentScale?: number;
}) {
  const userRects = useClassificationStore((s) => s.userRects);
  const perAnnotationMasks = useClassificationStore((s) => s.perAnnotationMasks);
  const [hoveredRectId, setHoveredRectId] = useState<string | undefined>();

  if (Object.keys(userRects).length === 0) {
    return null;
  }

  // Determine if we're hovering over any user rect
  const isHoveringOverUserRect = hoveredRectId !== undefined;

  return (
    <>
      {Object.entries(userRects).map(([rectId, rect]) => {
        const isSelected = selectedRectId === rectId;
        const isHovered = hoveredRectId === rectId;
        
        // Determine stroke width: double for selected, normal otherwise
        // Scale with contentScale (inverse of zoom) to keep visual consistency
        const baseStrokeWidth = 2 / contentScale;
        
        // Determine opacity:
        // - If hovering over this rect: full opacity
        // - If hovering over another user rect and not this one: dimmed (0.5)
        // - If hovering over Caesar rect: dimmed (0.5)
        // - If selecting this rect: full opacity
        // - If selecting another rect: dimmed (0.5)
        // - Otherwise: full opacity
        let opacity = 1;
        if (isHoveringOverUserRect && !isHovered) {
          opacity = 0.5;
        } else if (isHoveringOverCaesarRect) {
          opacity = 0.5;
        } else if (selectedRectId !== undefined && !isSelected) {
          opacity = 0.5;
        }

        const maskState = perAnnotationMasks[rectId];
        const hasUnsavedChanges = !!maskState && maskState.historyIndex !== maskState.lastSavedHistoryIndex;

        return (
          <UserRect
            key={rectId}
            rectId={rectId}
            rect={rect}
            isSelected={isSelected}
            isHovered={isHovered}
            opacity={opacity}
            baseStrokeWidth={baseStrokeWidth}
            toolCursor={toolCursor}
            markLabel={rect.markLabel}
            hasUnsavedChanges={hasUnsavedChanges}
            setToolTip={setToolTip}
            onMouseEnter={() => {
              setHoveredRectId(rectId);
              onMouseEnter?.();
            }}
            onMouseLeave={() => {
              setHoveredRectId(undefined);
              onMouseLeave?.();
            }}
            onMouseMove={(e) => {
              // Set cursor on canvas container when moving on rect
              const container = e.target.getStage()?.container();
              if (container) {
                container.style.cursor = getAnnotationCursor(isSelected);
              }
            }}
            onClick={() => {
              onRectClick?.(rect, rectId);
            }}
            onTap={() => {
              onRectClick?.(rect, rectId);
            }}
          />
        );
      })}
    </>
  );
}
