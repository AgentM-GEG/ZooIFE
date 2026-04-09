import { memo } from 'react';
import {
  Toolbar,
  ToolbarButton,
  ToolbarLabel,
  MaskHistoryButtonsContainer,
  UndoButton,
  RedoButton,
  SaveButton,
  BackButton,
  MarkingMessage,
} from './styled';

/**
 * Memoized toolbar component - only re-renders when its specific props change.
 *
 * @param zoom - Current zoom level as a decimal (e.g., 1 = 100%)
 * @param isPanMode - Whether pan mode is currently active
 * @param isDebugMode - Whether debug mode is enabled (hides toolbar when true)
 * @param activeAnnotationId - ID of currently active annotation (shows action buttons when set)
 * @param disableUndoRedo - Whether undo/redo buttons should be disabled
 * @param onZoomIn - Callback for zoom in button
 * @param onZoomOut - Callback for zoom out button
 * @param onZoomFit - Callback for fit-to-view button
 * @param onZoom100 - Callback for 100% zoom button
 * @param onTogglePan - Callback for pan mode toggle
 * @param onUndo - Callback for undo button
 * @param onRedo - Callback for redo button
 * @param onSave - Callback for save mask button
 * @param onBack - Callback for back button
 * @returns Toolbar element with zoom controls and annotation action buttons, or null if debug mode
 */
const CanvasToolbar = memo(({
  zoom,
  isPanMode,
  isDebugMode,
  activeAnnotationId,
  disableUndoRedo,
  selectedAnnotationLabel,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onZoom100,
  onTogglePan,
  onUndo,
  onRedo,
  onSave,
  onBack,
}: {
  zoom: number;
  isPanMode: boolean;
  isDebugMode: boolean;
  activeAnnotationId: string | null;
  disableUndoRedo: boolean;
  selectedAnnotationLabel?: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onZoom100: () => void;
  onTogglePan: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onBack: () => void;
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
      {(activeAnnotationId || !disableUndoRedo) && (
        <MarkingMessage>
          {selectedAnnotationLabel ? `Marking a ${selectedAnnotationLabel}` : 'Marking a new object'}
        </MarkingMessage>
      )}
      {(activeAnnotationId || !disableUndoRedo) && (
        <MaskHistoryButtonsContainer>
          <UndoButton
            type="button"
            onClick={onUndo}
            disabled={disableUndoRedo}
            title="Undo last mask operation (Ctrl+Z / ⌘Z)"
          >
            Undo
          </UndoButton>
            <RedoButton
              type="button"
              onClick={onRedo}
              disabled={disableUndoRedo}
              title="Redo last undone mask operation (Ctrl+Shift+Z / ⌘Shift+Z)"
            >
              Redo
            </RedoButton>
            <SaveButton
              type="button"
              onClick={onSave}
              title="Save mask for this annotation"
            >
              Save
            </SaveButton>
            <BackButton
              type="button"
              onClick={onBack}
              title="Return to full image view"
            >
              Back
            </BackButton>
          </MaskHistoryButtonsContainer>
      )}
    </Toolbar>
  );
});
CanvasToolbar.displayName = 'CanvasToolbar';

export default CanvasToolbar;
