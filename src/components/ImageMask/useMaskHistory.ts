import { useClassificationStore } from '@/stores/classificationStore';

/**
 * Custom hook that manages per-annotation mask history.
 * All masks (including unmarked objects) use the same per-annotation system with "-1" as the default annotation ID.
 * @returns Object with unified history methods and state accessors
 */
export function useMaskHistory() {
  const {
    activeAnnotationId,
    perAnnotationMasks,
    pushPerAnnotationMaskHistory,
    setPerAnnotationMask,
    undoPerAnnotationMask,
    redoPerAnnotationMask,
  } = useClassificationStore((s) => ({
    activeAnnotationId: s.activeAnnotationId,
    perAnnotationMasks: s.perAnnotationMasks,
    pushPerAnnotationMaskHistory: s.pushPerAnnotationMaskHistory,
    setPerAnnotationMask: s.setPerAnnotationMask,
    undoPerAnnotationMask: s.undoPerAnnotationMask,
    redoPerAnnotationMask: s.redoPerAnnotationMask,
  }));

  /**
   * Get the current working annotation ID.
   * Returns activeAnnotationId if set, otherwise "-1" for unmarked objects.
   */
  const getCurrentAnnotationId = (): string => activeAnnotationId || "-1";

  /**
   * Push new mask state to history.
   * @param imgData - ImageData to push to history
   */
  const handlePushMaskHistory = (imgData: ImageData) => {
    const annotationId = getCurrentAnnotationId();
    pushPerAnnotationMaskHistory(annotationId, imgData);
  };

  /**
   * Undo last mask operation.
   * @returns Restored ImageData or null if nothing to undo
   */
  const handleUndoMask = (): ImageData | null => {
    const annotationId = getCurrentAnnotationId();
    return undoPerAnnotationMask(annotationId);
  };

  /**
   * Redo last undone mask operation.
   * @returns Restored ImageData or null if nothing to redo
   */
  const handleRedoMask = (): ImageData | null => {
    const annotationId = getCurrentAnnotationId();
    return redoPerAnnotationMask(annotationId);
  };

  /**
   * Get current active mask state.
   * @returns Object containing history array, current history index, and optional mask URL
   */
  const getActiveMaskState = () => {
    const annotationId = getCurrentAnnotationId();
    return (
      perAnnotationMasks[annotationId] || {
        maskUrl: null,
        history: [],
        historyIndex: 0,
      }
    );
  };

  /**
   * Update the mask display URL for the current annotation.
   * Called after drawing to show the updated canvas content.
   * @param maskUrl - Data URI of the mask to display, or null to clear
   */
  const handleUpdateMaskDisplay = (maskUrl: string | null) => {
    const annotationId = getCurrentAnnotationId();
    setPerAnnotationMask(annotationId, maskUrl);
  };

  return {
    handlePushMaskHistory,
    handleUndoMask,
    handleRedoMask,
    handleUpdateMaskDisplay,
    getActiveMaskState,
    activeAnnotationId,
    perAnnotationMasks,
  };
}
