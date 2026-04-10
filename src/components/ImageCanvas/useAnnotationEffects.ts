import { useEffect } from 'react';
import Konva from 'konva';
import type { AnnotationTool } from '@/types/annotations';
import type { BrushProps } from './types';

interface UseAnnotationEffectsProps {
  tool: AnnotationTool;
  brushProps: BrushProps;
  isPanMode: boolean;
  toolCursor: string;
  isBrushCursorVisible: boolean;
  debugImageUrl: string | null;
  selectedCaesarAnnotation: string | null;
  onUndo?: () => void;
  stageRef: React.RefObject<Konva.Stage>;
  setIsPanMode: (value: boolean) => void;
  setNoRectangleWarning: (value: boolean) => void;
}

/**
 * Hook for managing canvas effects related to annotations, masks, and keyboard shortcuts.
 *
 * Handles:
 * - Mask swapping when active annotation changes
 * - Updating per-annotation masks when current mask changes
 * - Updating tool cursor based on current state
 * - Pan mode reset when tool changes
 * - Keyboard undo shortcut (Ctrl+Z / ⌘Z)
 * - Warning banner visibility when Caesar annotations are selected
 *
 * @param props - Configuration object with all required state and callbacks
 */
export function useAnnotationEffects(props: UseAnnotationEffectsProps) {
  const {
    tool,
    toolCursor,
    isBrushCursorVisible,
    debugImageUrl,
    selectedCaesarAnnotation,
    onUndo,
    stageRef,
    setIsPanMode,
    setNoRectangleWarning,
  } = props;

  /**
   * Update stage cursor based on tool and pan mode.
   * Hide CSS cursor when brush cursor overlay is visible to avoid visual clutter.
   */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    // Hide cursor when brush cursor overlay is visible, otherwise show the tool cursor
    stage.container().style.cursor = isBrushCursorVisible ? 'none' : (!debugImageUrl ? toolCursor : "default");
  }, [toolCursor, isBrushCursorVisible, debugImageUrl, stageRef]);

  /**
   * Disable pan mode whenever tool changes.
   */
  useEffect(() => {
    setIsPanMode(false);
  }, [tool, setIsPanMode]);

  /**
   * Setup keyboard undo shortcut (Ctrl+Z / ⌘Z).
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        onUndo?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onUndo]);

  /**
   * Clear warning banner silently when a Caesar annotation is selected.
   * Note: The warning is now cleared immediately in handleCaesarAnnotationClick,
   * so this mostly handles edge cases where an annotation might be selected by other means.
   */
  useEffect(() => {
    if (selectedCaesarAnnotation) {
      // Just clear it silently without fade effect
      setNoRectangleWarning(false);
    }
  }, [selectedCaesarAnnotation, setNoRectangleWarning]);
}
