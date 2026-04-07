import { create } from 'zustand';
import type { DrawingAnnotation } from '@/types/annotations';
import type { Classification, ClassificationMetadata, Annotation as PanoptesAnnotation } from '@/types/panoptes';
import { compressSegmentationMask } from "@/utils/image/compressImageMask";
import { PROJECT_ID, WORKFLOW_ID } from '@/services/panoptesService';



export interface TaskAnswer {
  taskId: string;
  value: string | string[];
}

interface ClassificationState {
  // Subject & image
  subjectId: string | null;
  imageUrl: string | null;
  imageDimensions: { width: number; height: number } | null;

  // Start and end times for classification
  startedAt: string;
  finishedAt: string | null;

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
  buildPanoptesClassification: (projectId: string, workflowId: string) => Promise<Classification>;
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
  startedAt: new Date().toISOString(),
  finishedAt: null,
};

export const useClassificationStore = create<ClassificationState>((set, get) => ({
  ...initialState,

  /**
   * Set the current subject and image.
   * @param id - Subject ID
   * @param imageUrl - Image URL or data URI
   * @param dimensions - Optional image dimensions (width, height)
   */
  setSubject: (id, imageUrl, dimensions) =>
    set({
      subjectId: id,
      imageUrl,
      imageDimensions: dimensions ?? null,
      maskHistory: [],
      maskHistoryIndex: 0
    }),

  /**
   * Add a drawing annotation to the current list.
   * @param annotation - DrawingAnnotation object to add
   */
  addAnnotation: (annotation) =>
    set((state) => ({
      annotations: [...state.annotations, { ...annotation, id: crypto.randomUUID() }],
    })),

  /**
   * Remove an annotation by ID.
   * @param id - Annotation ID to remove
   */
  removeAnnotation: (id) =>
    set((state) => ({
      annotations: state.annotations.filter((a) => (a.id ?? '') !== id),
      currentMaskUrl: null,
    })),

  /**
   * Undo the last added annotation.
   * @returns The removed annotation or undefined if none to undo
   */
  undoLastAnnotation: () => {
    const { annotations } = get();
    if (annotations.length === 0) return undefined;
    const removed = annotations[annotations.length - 1];
    set({ annotations: annotations.slice(0, -1), currentMaskUrl: null });
    return removed;
  },

  /**
   * Clear all annotations.
   */
  clearAnnotations: () =>
    set({ annotations: [], currentMaskUrl: null, debugImageUrl: null }),

  /**
   * Set answer for a task.
   * @param taskId - Task ID
   * @param value - Answer value (string or array of strings)
   */
  setTaskAnswer: (taskId, value) =>
    set((state) => ({
      taskAnswers: { ...state.taskAnswers, [taskId]: value },
    })),

  /**
   * Set the current segmentation mask URL.
   * @param url - Mask image URL or null to clear
   */
  setMask: (url) => set({ currentMaskUrl: url, debugImageUrl: null }),

  /**
   * Set the debug image URL for coordinate debugging.
   * @param url - Debug image URL or null to clear
   */
  setDebugImage: (url: string | null) => set({ debugImageUrl: url }),

  /**
   * Add mask to undo/redo history.
   * @param imgData - ImageData object to store in history
   */
  pushMaskHistory: (imgData: ImageData) => set((state) => {
    console.log("pushMaskHistory");

    const truncated = state.maskHistory.slice(0, state.maskHistoryIndex + 1);
    return { maskHistory: [...truncated, imgData], maskHistoryIndex: truncated.length, };
  }),

  /**
   * Undo to previous mask in history.
   * @returns Previous mask or null if at beginning of history
   */
  undoMask: () => {
    const { maskHistory, maskHistoryIndex } = get();
    if (maskHistoryIndex <= 0) return null;
    const newIndex = Math.max(maskHistoryIndex - 2, 0);
    set({ maskHistoryIndex: newIndex });
    return maskHistory[newIndex];
  },

  /**
   * Redo to next mask in history.
   * @returns Next mask or null if at end of history
   */
  redoMask: () => {
    const { maskHistory, maskHistoryIndex } = get();
    if (maskHistoryIndex >= maskHistory.length - 1) return null;
    const newIndex = Math.min(maskHistoryIndex + 2, maskHistory.length - 1);
    set({ maskHistoryIndex: newIndex });
    return maskHistory[newIndex];
  },

  /**
   * Build Panoptes-compatible annotations array from current state.
   * Includes segmentation mask, drawn annotations, and task answers.
   * @returns Promise resolving to array of Panoptes annotation objects
   */
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

  buildPanoptesClassification: async (projectId: string = PROJECT_ID, workflowId: string | undefined = WORKFLOW_ID) => {
    if (!projectId || !workflowId) {
      throw new Error("Project ID and Workflow ID are required to build classification");
    }

    const { subjectId, startedAt } = get();
    if (!subjectId) throw new Error("No subject is set for classification");

    const classificationMetaData: ClassificationMetadata = {
      user_agent: navigator.userAgent,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      user_language: navigator.language,
      workflow_version: "1.0",
    };

    console.log(classificationMetaData);

    const classification: Classification = {
      metadata: classificationMetaData,
      annotations: await get().buildPanoptesAnnotations(),
      links: {
        subjects: get().subjectId ? [get().subjectId!] : [],
        workflow: workflowId,
        project: projectId,
      },
    };

    console.log(classification);

    return classification;

  },

  reset: () => set(initialState),
}));


/**
 * Map drawing annotation to Panoptes annotation value format.
 * @param a - DrawingAnnotation to convert
 * @returns Panoptes-compatible annotation value
 */
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
