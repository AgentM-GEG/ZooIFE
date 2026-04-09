import { create } from 'zustand';
import type { DrawingAnnotation } from '@/types/annotations';
import type { Classification, ClassificationMetadata, Annotation as PanoptesAnnotation } from '@/types/panoptes';
import { compressSegmentationMask } from '@/utils/image/compressImageMask';
import { PROJECT_ID, WORKFLOW_ID } from '@/services/panoptesService';
import { CLASSIFICATION_TASKS } from '@/stores/constants';

/**
 * Task answer from sidebar classification
 */
export interface TaskAnswer {
  taskId: string;
  value: string | string[];
}

/**
 * State for a single annotation's mask history
 */
interface PerAnnotationMaskState {
  maskUrl: string | null;
  history: ImageData[];
  historyIndex: number;
}

/**
 * Global classification state managed by Zustand
 */
interface ClassificationState {
  // ============= Subject & Image =============
  /** Current subject ID being classified */
  subjectId: string | null;
  /** Current image URL or data URI */
  imageUrl: string | null;
  /** Image dimensions (width, height) */
  imageDimensions: { width: number; height: number } | null;

  // ============= Classification Metadata =============
  /** ISO timestamp when classification started */
  startedAt: string;
  /** ISO timestamp when classification was finished */
  finishedAt: string | null;

  // ============= Drawing Annotations =============
  /** User-drawn annotations (points, polylines, brush strokes) */
  annotations: DrawingAnnotation[];

  // ============= Task Answers =============
  /** Answers to sidebar classification questions */
  taskAnswers: Record<string, string | string[]>;

  // ============= Debug Image =============
  /** Debug image URL (shows point coordinates received by server) */
  debugImageUrl: string | null;

  // ============= Per-Annotation Masks =============
  /** Segmentation masks for individual annotations */
  perAnnotationMasks: Record<string, PerAnnotationMaskState>;
  /** Currently selected annotation for editing its mask */
  activeAnnotationId: string | null;

  // ============= Actions: Subject Management =============
  /**
   * Set the current subject and start a new classification
   * @param id Subject ID
   * @param imageUrl Image URL or data URI
   * @param dimensions Optional image dimensions
   */
  setSubject: (id: string, imageUrl: string, dimensions?: { width: number; height: number }) => void;

  // ============= Actions: Annotations =============
  /**
   * Add a drawing annotation
   * @param annotation DrawingAnnotation object (id auto-assigned)
   */
  addAnnotation: (annotation: DrawingAnnotation) => void;

  /**
   * Remove an annotation by ID
   * @param id Annotation ID to remove
   */
  removeAnnotation: (id: string) => void;

  /**
   * Undo the last added annotation
   * @returns The removed annotation or undefined
   */
  undoLastAnnotation: () => DrawingAnnotation | undefined;

  /**
   * Clear all annotations
   */
  clearAnnotations: () => void;

  // ============= Actions: Task Answers =============
  /**
   * Set answer for a sidebar task
   * @param taskId Task ID
   * @param value Answer value
   */
  setTaskAnswer: (taskId: string, value: string | string[]) => void;

  // ============= Actions: Global Mask =============
  /**
   * Set debug image URL for coordinate visualization
   * @param url Debug image URL or null
   */
  setDebugImage: (url: string | null) => void;

  // ============= Actions: Per-Annotation Masks =============
  /**
   * Set which annotation's mask is currently being edited
   * @param annotationId Annotation's markId or null
   */
  setActiveAnnotation: (annotationId: string | null) => void;

  /**
   * Set the mask URL for a specific annotation
   * @param annotationId Annotation's markId
   * @param url Mask image URL or null
   */
  setPerAnnotationMask: (annotationId: string, url: string | null) => void;

  /**
   * Add per-annotation mask to history
   * @param annotationId Annotation's markId
   * @param imgData ImageData to store
   */
  pushPerAnnotationMaskHistory: (annotationId: string, imgData: ImageData) => void;

  /**
   * Undo per-annotation mask
   * @param annotationId Annotation's markId
   * @returns Previous mask or null
   */
  undoPerAnnotationMask: (annotationId: string) => ImageData | null;

  /**
   * Redo per-annotation mask
   * @param annotationId Annotation's markId
   * @returns Next mask or null
   */
  redoPerAnnotationMask: (annotationId: string) => ImageData | null;

  /**
   * Save per-annotation mask and return to global view
   * @param annotationId Annotation's markId
   */
  saveMask: (annotationId: string) => void;

  // ============= Actions: Building Submissions =============
  /**
   * Build Panoptes-compatible annotations array from current state
   * @returns Promise resolving to PanoptesAnnotation array
   */
  buildPanoptesAnnotations: () => Promise<PanoptesAnnotation[]>;

  /**
   * Build complete Panoptes classification object ready for submission
   * @param projectId Project ID (defaults to env config)
   * @param workflowId Workflow ID (defaults to env config)
   * @returns Promise resolving to Classification object
   */
  buildPanoptesClassification: (projectId: string, workflowId: string) => Promise<Classification>;

  /**
   * Reset all state to initial values
   */
  reset: () => void;
}

/**
 * Create initial state with dynamically generated timestamp
 */
const createInitialState = (): Pick<ClassificationState, Exclude<keyof ClassificationState, 'setSubject' | 'addAnnotation' | 'removeAnnotation' | 'undoLastAnnotation' | 'clearAnnotations' | 'setTaskAnswer' | 'setDebugImage' | 'setActiveAnnotation' | 'setPerAnnotationMask' | 'pushPerAnnotationMaskHistory' | 'undoPerAnnotationMask' | 'redoPerAnnotationMask' | 'saveMask' | 'buildPanoptesAnnotations' | 'buildPanoptesClassification' | 'reset'>> => ({
  subjectId: null,
  imageUrl: null,
  imageDimensions: null,
  annotations: [],
  taskAnswers: {},
  debugImageUrl: null,
  finishedAt: null,
  perAnnotationMasks: {},
  activeAnnotationId: null,
  startedAt: new Date().toISOString(),
});

/**
 * Global Zustand store for managing subject classifications.
 *
 * Handles all state for a single classification workflow including:
 * - Subject and image metadata
 * - User-drawn annotations (points, polylines, brush)
 * - Task answers from sidebar
 * - Global and per-annotation segmentation masks
 * - Undo/redo history for masks
 *
 * When ready to submit, use `buildPanoptesClassification()` to generate
 * a submission-ready object.
 *
 * @example
 * ```tsx
 * // Load subject
 * const { setSubject } = useClassificationStore();
 * setSubject(subjectId, imageUrl, { width: 800, height: 600 });
 *
 * // Get current state
 * const imageUrl = useClassificationStore(s => s.imageUrl);
 *
 * // Submit classification
 * const { buildPanoptesClassification } = useClassificationStore();
 * const classification = await buildPanoptesClassification(projectId, workflowId);
 * ```
 */
export const useClassificationStore = create<ClassificationState>((set, get) => ({
  ...createInitialState(),

  setSubject: (id, imageUrl, dimensions) =>
    set({
      subjectId: id,
      imageUrl,
      imageDimensions: dimensions ?? null,
      startedAt: new Date().toISOString(),
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
    })),

  /**
   * Undo the last added annotation.
   * @returns The removed annotation or undefined if none to undo
   */
  undoLastAnnotation: () => {
    const { annotations } = get();
    if (annotations.length === 0) return undefined;
    const removed = annotations[annotations.length - 1];
    set({ annotations: annotations.slice(0, -1) });
    return removed;
  },

  /**
   * Clear all annotations.
   */
  clearAnnotations: () =>
    set({ annotations: [], debugImageUrl: null }),

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
   * Set the debug image URL for coordinate debugging.
   * @param url - Debug image URL or null to clear
   */
  setDebugImage: (url: string | null) => set({ debugImageUrl: url }),

  /**
   * Set the active annotation being edited.
   * @param annotationId - The markId of the annotation to edit, or null to return to global view
   */
  setActiveAnnotation: (annotationId: string | null) => set({ activeAnnotationId: annotationId }),

  /**
   * Set the mask URL for a specific annotation.
   * @param annotationId - The annotation's markId
   * @param url - Mask image URL or null to clear
   */
  setPerAnnotationMask: (annotationId, url) =>
    set((state) => ({
      perAnnotationMasks: {
        ...state.perAnnotationMasks,
        [annotationId]: {
          ...(state.perAnnotationMasks[annotationId] || { history: [], historyIndex: 0 }),
          maskUrl: url,
        },
      },
    })),

  /**
   * Add mask to undo/redo history for a specific annotation.
   * @param annotationId - The annotation's markId
   * @param imgData - ImageData object to store in history
   */
  pushPerAnnotationMaskHistory: (annotationId, imgData) =>
    set((state) => {
      const annotationState = state.perAnnotationMasks[annotationId] || {
        maskUrl: null,
        history: [],
        historyIndex: -1,
      };
      const truncated = annotationState.history.slice(0, annotationState.historyIndex + 1);
      const newHistoryLength = truncated.length + 1;
      const newHistoryIndex = truncated.length;
      console.log(`[pushPerAnnotationMaskHistory] annotationId=${annotationId}, newHistoryLength=${newHistoryLength}, historyIndex=${newHistoryIndex}`);
      return {
        perAnnotationMasks: {
          ...state.perAnnotationMasks,
          [annotationId]: {
            ...annotationState,
            history: [...truncated, imgData],
            historyIndex: newHistoryIndex,
          },
        },
      };
    }),

  /**
   * Undo to previous mask in history for a specific annotation.
   * @param annotationId - The annotation's markId
   * @returns Previous mask or null if at beginning of history
   */
  undoPerAnnotationMask: (annotationId) => {
    const state = get();
    const annotationState = state.perAnnotationMasks[annotationId];
    if (!annotationState || annotationState.historyIndex < 0) {
      console.log(`[undoPerAnnotationMask] annotationId=${annotationId}, cannotUndo=true (historyIndex=${annotationState?.historyIndex ?? 'N/A'})`);
      return null;
    }
    const newIndex = annotationState.historyIndex - 1;
    console.log(`[undoPerAnnotationMask] annotationId=${annotationId}, oldIndex=${annotationState.historyIndex}, newIndex=${newIndex}, historyLength=${annotationState.history.length}`);
    set((s) => ({
      perAnnotationMasks: {
        ...s.perAnnotationMasks,
        [annotationId]: {
          ...s.perAnnotationMasks[annotationId],
          historyIndex: newIndex,
        },
      },
    }));
    return newIndex >= 0 ? annotationState.history[newIndex] : null;
  },

  /**
   * Redo to next mask in history for a specific annotation.
   * @param annotationId - The annotation's markId
   * @returns Next mask or null if at end of history
   */
  redoPerAnnotationMask: (annotationId) => {
    const state = get();
    const annotationState = state.perAnnotationMasks[annotationId];
    if (!annotationState || annotationState.historyIndex >= annotationState.history.length - 1) {
      console.log(`[redoPerAnnotationMask] annotationId=${annotationId}, cannotRedo=true (historyIndex=${annotationState?.historyIndex ?? 'N/A'}, historyLength=${annotationState?.history.length ?? 'N/A'})`);
      return null;
    }
    const newIndex = annotationState.historyIndex + 1;
    console.log(`[redoPerAnnotationMask] annotationId=${annotationId}, oldIndex=${annotationState.historyIndex}, newIndex=${newIndex}, historyLength=${annotationState.history.length}`);
    set((s) => ({
      perAnnotationMasks: {
        ...s.perAnnotationMasks,
        [annotationId]: {
          ...s.perAnnotationMasks[annotationId],
          historyIndex: newIndex,
        },
      },
    }));
    return annotationState.history[newIndex];
  },

  /**
   * Save (finalize) the mask for a specific annotation and return to global view.
   * @param annotationId - The annotation's markId
   */
  saveMask: (_annotationId) =>
    set({ activeAnnotationId: null }),



  buildPanoptesAnnotations: async () => {
    const { annotations, taskAnswers, perAnnotationMasks } = get();

    const result: PanoptesAnnotation[] = [];

    // Per-annotation masks with metadata (including "-1" for unmarked objects)
    for (const [annotationId, maskState] of Object.entries(perAnnotationMasks)) {
      if (maskState.history.length > 0 && maskState.historyIndex < maskState.history.length) {
        const perAnnotationMask = maskState.history[maskState.historyIndex];
        const compressedPerAnnotationMask = await compressSegmentationMask(perAnnotationMask);
        result.push({
          task: `${CLASSIFICATION_TASKS.PER_ANNOTATION_MASK}-${annotationId}`,
          value: {
            compressedMask: compressedPerAnnotationMask,
            annotationId,
          },
        });
      }
    }

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

  buildPanoptesClassification: async (projectId: string = PROJECT_ID, workflowId: string | undefined = WORKFLOW_ID) => {
    if (!projectId || !workflowId) {
      throw new Error('Project ID and Workflow ID are required to build classification');
    }

    const { subjectId, startedAt } = get();
    if (!subjectId) throw new Error('No subject is set for classification');

    const classificationMetaData: ClassificationMetadata = {
      user_agent: navigator.userAgent,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      user_language: navigator.language,
      workflow_version: '1.0',
    };

    const classification: Classification = {
      metadata: classificationMetaData,
      annotations: await get().buildPanoptesAnnotations(),
      links: {
        subjects: get().subjectId ? [get().subjectId!] : [],
        workflow: workflowId,
        project: projectId,
      },
    };

    return classification;
  },

  reset: () => set(createInitialState()),
}));

/**
 * Map drawing annotation to Panoptes annotation value format
 * @param a DrawingAnnotation to convert
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
