import { create } from 'zustand';
import type { CaesarAnnotation } from '@/types/annotations';

/**
 * Configuration for Caesar service retries
 */
export interface CaesarRetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Delay between retries in milliseconds (default: 1000) */
  retryDelayMs: number;
}

/**
 * State interface for Caesar ML annotations store
 */
interface CaesarAnnotationState {
  /** Array of Caesar ML-generated annotations for current subject */
  annotations: CaesarAnnotation[];
  /** Currently selected annotation ID for display/interaction */
  selectedAnnotationId: string | null;
  /** Loading state: true while fetching Caesar annotations */
  isLoading: boolean;
  /** Error message if Caesar fetch fails after all retries */
  error: string | null;

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

  /**
   * Set loading state when fetching Caesar annotations
   * @param isLoading True when fetching, false when complete
   */
  setLoading: (isLoading: boolean) => void;

  /**
   * Set error message if Caesar fetch fails
   * @param error Error message or null if no error
   */
  setError: (error: string | null) => void;
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
  isLoading: false,
  error: null,

  setAnnotations: (annotations) => set({ annotations, error: null }),
  clearAnnotations: () => set({ annotations: [], error: null }),
  setSelectedAnnotationId: (selectedAnnotationId) => set({ selectedAnnotationId }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));