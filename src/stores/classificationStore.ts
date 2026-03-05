import { create } from 'zustand';
import type { DrawingAnnotation } from '../types/annotations';
import type { Annotation as PanoptesAnnotation } from '../types/panoptes';

export interface TaskAnswer {
  taskId: string;
  value: string | string[];
}

interface ClassificationState {
  // Subject & image
  subjectId: string | null;
  imageUrl: string | null;
  imageDimensions: { width: number; height: number } | null;

  // Annotations (drawing layer)
  annotations: DrawingAnnotation[];

  // Task answers (sidebar)
  taskAnswers: Record<string, string | string[]>;

  // SAM2 mask overlay
  currentMaskUrl: string | null;
  debugImageUrl: string | null; // When set, shows where server received the point

  // Actions
  setSubject: (id: string, imageUrl: string, dimensions?: { width: number; height: number }) => void;
  addAnnotation: (annotation: DrawingAnnotation) => void;
  removeAnnotation: (id: string) => void;
  undoLastAnnotation: () => DrawingAnnotation | undefined;
  clearAnnotations: () => void;
  setTaskAnswer: (taskId: string, value: string | string[]) => void;
  setMask: (url: string | null) => void;
  setDebugImage: (url: string | null) => void;
  buildPanoptesAnnotations: () => PanoptesAnnotation[];
  reset: () => void;
}

const initialState = {
  subjectId: null,
  imageUrl: null,
  imageDimensions: null,
  annotations: [],
  taskAnswers: {},
  currentMaskUrl: null,
  debugImageUrl: null,
};

export const useClassificationStore = create<ClassificationState>((set, get) => ({
  ...initialState,

  setSubject: (id, imageUrl, dimensions) =>
    set({
      subjectId: id,
      imageUrl,
      imageDimensions: dimensions ?? null,
    }),

  addAnnotation: (annotation) =>
    set((state) => ({
      annotations: [...state.annotations, { ...annotation, id: crypto.randomUUID() }],
    })),

  removeAnnotation: (id) =>
    set((state) => ({
      annotations: state.annotations.filter((a) => (a.id ?? '') !== id),
      currentMaskUrl: null,
    })),

  undoLastAnnotation: () => {
    const { annotations } = get();
    if (annotations.length === 0) return undefined;
    const removed = annotations[annotations.length - 1];
    set({ annotations: annotations.slice(0, -1), currentMaskUrl: null });
    return removed;
  },

  clearAnnotations: () =>
    set({ annotations: [], currentMaskUrl: null, debugImageUrl: null }),

  setTaskAnswer: (taskId, value) =>
    set((state) => ({
      taskAnswers: { ...state.taskAnswers, [taskId]: value },
    })),

  setMask: (url) => set({ currentMaskUrl: url, debugImageUrl: null }),
  setDebugImage: (url: string | null) => set({ debugImageUrl: url }),

  buildPanoptesAnnotations: () => {
    const { annotations, taskAnswers } = get();
    const result: PanoptesAnnotation[] = [];

    // Drawing annotations
    annotations.forEach((a, i) => {
      result.push({
        task: `drawing-${i}`,
        value: mapAnnotationToValue(a),
      });
    });

    // Task answers
    Object.entries(taskAnswers).forEach(([taskId, value]) => {
      result.push({ task: taskId, value });
    });

    return result;
  },

  reset: () => set(initialState),
}));

function mapAnnotationToValue(a: DrawingAnnotation): unknown {
  switch (a.type) {
    case 'point':
      return { type: 'point', x: a.x, y: a.y, label: a.label };
    case 'polyline':
      return { type: 'polyline', points: a.points };
    case 'brush':
      return { type: 'brush', strokes: a.strokes };
    case 'sam2_mask':
      return { type: 'sam2_mask', prompts: a.prompts, maskUrl: a.maskUrl };
    default:
      return a;
  }
}
