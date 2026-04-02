import { create } from 'zustand';
import type { DrawingAnnotation } from '../types/annotations';
import type { Annotation as PanoptesAnnotation } from '../types/panoptes';
import { compressSegmentationMask } from "../utils/image/compressImageMask";


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
  maskHistory: ImageData[] | [];
  maskHistoryIndex: number;
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

  pushMaskHistory: (imgData: ImageData) => void;
  undoMask: () => ImageData | null;
  redoMask: () => ImageData | null

  buildPanoptesAnnotations: () => Promise<PanoptesAnnotation[]>;
  reset: () => void;
}

const initialState = {
  subjectId: null,
  imageUrl: null,
  imageDimensions: null,
  annotations: [],
  taskAnswers: {},
  currentMaskUrl: null,
  maskHistory: [],
  maskHistoryIndex: 0,
  debugImageUrl: null,
};

export const useClassificationStore = create<ClassificationState>((set, get) => ({
  ...initialState,

  setSubject: (id, imageUrl, dimensions) =>
    set({
      subjectId: id,
      imageUrl,
      imageDimensions: dimensions ?? null,
      maskHistory: [],
      maskHistoryIndex: 0
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

  // UNDO / REDO FOR MASK HISTORY (used by Konva brush) 
  pushMaskHistory: (imgData: ImageData) => set((state) => {
    console.log("pushMaskHistory");
    
    const truncated = state.maskHistory.slice(0, state.maskHistoryIndex + 1);
    return { maskHistory: [...truncated, imgData], maskHistoryIndex: truncated.length, };
  }),

  undoMask: () => {
    const { maskHistory, maskHistoryIndex } = get();
    if (maskHistoryIndex <= 0) return null;
    const newIndex = Math.max(maskHistoryIndex - 2, 0);
    set({ maskHistoryIndex: newIndex });
    return maskHistory[newIndex];
  },

  redoMask: () => {
    const { maskHistory, maskHistoryIndex } = get();
    if (maskHistoryIndex >= maskHistory.length - 1) return null;
    const newIndex = Math.min(maskHistoryIndex + 2, maskHistory.length - 1);
    set({ maskHistoryIndex: newIndex });
    return maskHistory[newIndex];
  },

   buildPanoptesAnnotations: async () => {
    const { annotations, taskAnswers, maskHistory, maskHistoryIndex } = get();

    const currentMask = maskHistory[maskHistoryIndex];
    const compressedMask = await compressSegmentationMask(currentMask);

    const result: PanoptesAnnotation[] = [];

    result.push({
      task: 'segmentation-mask',
      value: compressedMask,
    });

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

    console.log(JSON.stringify(result, null, 2));

    return result;
  },

  reset: () => set(initialState),
}));

function mapAnnotationToValue(a: DrawingAnnotation): PanoptesAnnotation['value'] {
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
