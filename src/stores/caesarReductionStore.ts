import { create } from 'zustand';
import type { CaesarAnnotation } from '../types/annotations';

interface CaesarAnnotationState {
  annotations: CaesarAnnotation[];
  setAnnotations: (ann: CaesarAnnotation[]) => void;
  clearAnnotations: () => void;
}

export const useCaesarAnnotationStore = create<CaesarAnnotationState>((set) => ({
  annotations: [],
  setAnnotations: (annotations) => set({ annotations }),
  clearAnnotations: () => set({ annotations: [] }),
}));