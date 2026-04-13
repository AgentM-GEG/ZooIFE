import { memo } from 'react';
import {
  Toolbar,
  ToolbarButton,
  ToolbarLabel,
  MaskHistoryButtonsContainer,
  UndoButton,
  RedoButton,
  IdentifyButton,
  SaveButton,
} from './styled';

/**
 * Memoized toolbar component - only re-renders when its specific props change.
 *
 * @param zoom - Current zoom level as a decimal (e.g., 1 = 100%)
 * @param isPanMode - Whether pan mode is currently active
 * @param isDebugMode - Whether debug mode is enabled (hides toolbar when true)
 * @param activeAnnotationId - ID of currently active annotation (shows action buttons when set)
 * @param disableUndo - Whether undo button should be disabled
 * @param disableRedo - Whether redo button should be disabled
 * @param hasWholeImageMask - Whether the whole-image (-1) mask has content (enable identify button)
 * @param isUserRectSelected - Whether a user-created rect is currently selected (enable save button)
 * @param onZoomIn - Callback for zoom in button
 * @param onZoomOut - Callback for zoom out button
 * @param onZoomFit - Callback for fit-to-view button
 * @param onZoom100 - Callback for 100% zoom button
 * @param onTogglePan - Callback for pan mode toggle
 * @param onUndo - Callback for undo button
 * @param onRedo - Callback for redo button
 * @param onIdentifyNewObject - Callback for identify new object button (enabled when hasWholeImageMask is true)
 * @param onSaveUserRect - Callback for save user rect button (enabled when isUserRectSelected is true)
 * @returns Toolbar element with zoom controls and annotation action buttons, or null if debug mode
 */
const CanvasToolbar = memo(({
  zoom,
  isPanMode,
  isDebugMode,
  activeAnnotationId,
  disableUndo,
  disableRedo,
  hasWholeImageMask = false,
  isUserRectSelected = false,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onZoom100,
  onTogglePan,
  onUndo,
  onRedo,
  onIdentifyNewObject,
  onSaveUserRect,
}: {
  zoom: number;
  isPanMode: boolean;
  isDebugMode: boolean;
  activeAnnotationId: string | null;
  disableUndo: boolean;
  disableRedo: boolean;
  hasWholeImageMask?: boolean;
  isUserRectSelected?: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onZoom100: () => void;
  onTogglePan: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onIdentifyNewObject?: () => void;
  onSaveUserRect?: () => void;
}) => {
  if (isDebugMode) return null;

  return (
    <Toolbar>
      <ToolbarButton type="button" onClick={onZoomOut} title="Zoom out">-</ToolbarButton>
      <ToolbarLabel>{Math.round(zoom * 100)}%</ToolbarLabel>
      <ToolbarButton type="button" onClick={onZoomIn} title="Zoom in">+</ToolbarButton>
      <ToolbarButton type="button" onClick={onZoomFit} title="Fit to view">Fit</ToolbarButton>
      <ToolbarButton type="button" onClick={onZoom100} title="100% (1:1 pixels)">100%</ToolbarButton>
      <ToolbarButton
        type="button"
        $active={isPanMode}
        onClick={onTogglePan}
        title="Pan mode: drag to move image"
      >
        Pan
      </ToolbarButton>
      {(activeAnnotationId || !disableUndo || !disableRedo || (onIdentifyNewObject && hasWholeImageMask)) && (
        <MaskHistoryButtonsContainer>
          {onIdentifyNewObject && hasWholeImageMask && (
            <IdentifyButton
              type="button"
              onClick={onIdentifyNewObject}
              title="Create a new bounding box from the mask"
            >
              Identify new object
            </IdentifyButton>
          )}
          {onSaveUserRect && isUserRectSelected && (
            <SaveButton
              type="button"
              onClick={onSaveUserRect}
              title="Save the mask changes and update the bounding box"
            >
              Save changes
            </SaveButton>
          )}
          <UndoButton
            type="button"
            onClick={onUndo}
            disabled={disableUndo}
            title="Undo last mask operation (Ctrl+Z / ⌘Z)"
          >
            Undo
          </UndoButton>
            <RedoButton
              type="button"
              onClick={onRedo}
              disabled={disableRedo}
              title="Redo last undone mask operation (Ctrl+Shift+Z / ⌘Shift+Z)"
            >
              Redo
            </RedoButton>
          </MaskHistoryButtonsContainer>
      )}
    </Toolbar>
  );
});
CanvasToolbar.displayName = 'CanvasToolbar';

export default CanvasToolbar;
