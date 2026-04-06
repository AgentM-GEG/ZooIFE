import { create } from 'zustand';
import type { CaesarAnnotation } from '../types/annotations';

/**
 * Zustand store for Caesar machine learning annotations.
 */
interface CaesarAnnotationState {
  annotations: CaesarAnnotation[];
  /**
   * Set the Caesar annotations array.
   * @param ann - Array of CaesarAnnotation objects
   */
  setAnnotations: (ann: CaesarAnnotation[]) => void;
  /**
   * Clear all Caesar annotations.
   */
  clearAnnotations: () => void;
}

export const useCaesarAnnotationStore = create<CaesarAnnotationState>((set) => ({
  annotations: [],
  setAnnotations: (annotations) => set({ annotations }),
  clearAnnotations: () => set({ annotations: [] }),
}));