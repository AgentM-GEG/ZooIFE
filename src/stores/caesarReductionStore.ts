import { create } from 'zustand';
import type { CaesarAnnotation } from '@/types/annotations';

/**
 * State interface for Caesar ML annotations store
 */
interface CaesarAnnotationState {
  /** Array of Caesar ML-generated annotations for current subject */
  annotations: CaesarAnnotation[];
  /** Currently selected annotation ID for display/interaction */
  selectedAnnotationId: string | null;

  // Actions
  /**
   * Replace all Caesar annotations with a new array.
   * Called after fetching annotations from Caesar API for a subject.
   *
   * @param annotations Array of CaesarAnnotation objects
   */
  setAnnotations: (annotations: CaesarAnnotation[]) => void;

  /**
   * Clear all Caesar annotations.
   * Called when loading a new subject or clearing the ui.
   */
  clearAnnotations: () => void;

  /**
   * Set or toggle the selected annotation.
   * Used for highlighting/interactive feedback when user hovers or clicks annotations.
   *
   * @param id ID of the annotation to select, or null to deselect
   */
  setSelectedAnnotationId: (id: string | null) => void;
}

/**
 * Zustand store for Caesar machine learning annotations.
 *
 * Caesar is a standalone ML service that generates segmentation masks
 * and other annotations for subject images. These are independent from
 * user-drawn annotations and are displayed as read-only overlays.
 *
 * Annotations are fetched separately via the Caesar API when a new
 * subject is loaded, then stored here for display and interaction.
 *
 * @example
 * ```tsx
 * const { annotations, selectedAnnotationId, setSelectedAnnotationId } = useCaesarAnnotationStore();
 *
 * // Display annotations on canvas
 * annotations.forEach(ann => renderAnnotation(ann));
 *
 * // Handle hover
 * onMouseEnter={(ann) => setSelectedAnnotationId(ann.id)}
 * ```
 */
export const useCaesarAnnotationStore = create<CaesarAnnotationState>((set) => ({
  annotations: [],
  selectedAnnotationId: null,

  setAnnotations: (annotations) => set({ annotations }),
  clearAnnotations: () => set({ annotations: [] }),
  setSelectedAnnotationId: (selectedAnnotationId) => set({ selectedAnnotationId }),
}));