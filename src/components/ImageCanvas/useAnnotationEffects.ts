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
  onRedo?: () => void;
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
    onRedo,
    stageRef,
    setIsPanMode,
    setNoRectangleWarning,
  } = props;

  const isEditableTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;

    if (target.isContentEditable) return true;

    const tagName = target.tagName.toLowerCase();
    if (tagName === 'textarea') return true;
    if (tagName === 'select') return true;
    if (tagName === 'input') {
      const input = target as HTMLInputElement;
      return input.type !== 'button' && input.type !== 'checkbox' && input.type !== 'radio' && input.type !== 'range';
    }

    return false;
  };

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
   * Setup scoped keyboard shortcuts for mask history:
   * - Undo: Ctrl+Z / ⌘Z
  * - Redo: ⌘⇧Z / Ctrl+Y
   *
   * Shortcuts are ignored when:
   * - Focus is in an editable element (input/textarea/select/contenteditable), or
   * - The canvas is not hovered.
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const stage = stageRef.current;
      if (!stage) return;
      const isCanvasHovered = stage.container().matches(':hover');
      if (!isCanvasHovered) return;

      const key = e.key.toLowerCase();
      const hasMod = e.metaKey || e.ctrlKey;
      if (!hasMod) return;

      const isUndo = key === 'z' && !e.shiftKey;
      const isRedo = (key === 'z' && e.shiftKey && e.metaKey) || (key === 'y' && e.ctrlKey && !e.metaKey);

      if (isUndo) {
        e.preventDefault();
        onUndo?.();
        return;
      }

      if (isRedo) {
        e.preventDefault();
        onRedo?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onUndo, onRedo, stageRef]);

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
