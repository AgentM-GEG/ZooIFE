import { create } from 'zustand';
import type { CaesarAnnotation } from '@/types/annotations';

/**
 * Zustand store for Caesar machine learning annotations.
 */
interface CaesarAnnotationState {
  annotations: CaesarAnnotation[];
  selectedAnnotationId: string | null;
  /**
   * Set the Caesar annotations array.
   * @param ann - Array of CaesarAnnotation objects
   */
  setAnnotations: (ann: CaesarAnnotation[]) => void;
  /**
   * Clear all Caesar annotations.
   */
  clearAnnotations: () => void;
  /**
   * Set the selected annotation ID.
   * @param id - ID of the annotation to select, or null to deselect
   */
  setSelectedAnnotationId: (id: string | null) => void;
}

export const useCaesarAnnotationStore = create<CaesarAnnotationState>((set) => ({
  annotations: [],
  selectedAnnotationId: null,
  setAnnotations: (annotations) => set({ annotations }),
  clearAnnotations: () => set({ annotations: [] }),
  setSelectedAnnotationId: (selectedAnnotationId) => set({ selectedAnnotationId }),
}));