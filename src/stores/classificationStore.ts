import { create } from 'zustand';
import type { DrawingAnnotation } from '@/types/annotations';
import type { Classification, ClassificationMetadata, Annotation as PanoptesAnnotation } from '@/types/panoptes';
import { compressSegmentationMask } from '@/utils/image/compressImageMask';
import { getSimpleComposite } from '@/utils/image/maskCompositing';
import { PROJECT_ID, WORKFLOW_ID } from '@/services/panoptesService';
import { loggers } from '@/utils/logger';

/**
 * Single entry in mask history - tracks origin (SAM or brush stroke)
 * 
 * Types:
 * - 'sam': SAM model prediction. Contains raw model output (no pre-compositing).
 * - 'modifier_brush': User brush stroke (either regular brush or refinement).
 * 
 * IMPORTANT: Storage vs Display
 * - Storage: imageData contains ONLY the raw atomic mask (SAM or brush)
 * - Display: User sees composite of all masks up to historyIndex (calculated at display time)
 * - Export: Composite calculated fresh from all entries (bitwise OR)
 * 
 * This separation ensures:
 * 1. Clean undo/redo (each entry is atomic)\n * 2. Correct export composites (per-rect not accumulating across rects)
 * 3. Accurate mask type tracking (SAM vs brush vs composite)
 */
export interface HistoryEntry {
  type: 'sam' | 'modifier_brush';
  imageData: ImageData; // Raw atomic mask (SAM prediction or brush stroke)
}

/**
 * State for a single annotation's mask history
 */
interface PerAnnotationMaskState {
  maskUrl: string | null;
  history: HistoryEntry[];
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
  /** Debug masks: all candidate masks from SAM (shown in debug mode) */
  debugMasks: Array<{
    idx: number;
    iou: number;
    url: string;
    is_selected: boolean;
  }> | null;
  /** Mask selection info (which mask was selected and why) */
  maskSelectionInfo: {
    selected_idx: number;
    selected_iou: number;
    all_iou_scores: number[];
    has_background_prompts: boolean;
  } | null;
  /** Crop region info for debug visualization */
  debugCrop: {
    crop_x0: number;
    crop_y0: number;
    crop_w: number;
    crop_h: number;
  } | null;
  /** Prompts sent to SAM for debug visualization */
  debugPrompts: Array<{
    x: number;
    y: number;
    label: 0 | 1;
  }> | null;

  // ============= Per-Annotation Masks =============
  /** Segmentation masks for individual annotations */
  perAnnotationMasks: Record<string, PerAnnotationMaskState>;
  /** Currently selected annotation for editing its mask */
  activeAnnotationId: string | null;
  /** Global composite mask showing all visible masks from all annotations */
  globalCompositeMask: string | null;

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

  /**
   * Set debug masks and selection info
   * @param masks Array of candidate masks or null
   * @param selectionInfo Mask selection information
   * @param crop Crop region info
   * @param prompts Points sent to SAM
   */
  setDebugMasks: (
    masks: Array<{ idx: number; iou: number; url: string; is_selected: boolean }> | null,
    selectionInfo: { selected_idx: number; selected_iou: number; all_iou_scores: number[]; has_background_prompts: boolean } | null,
    crop?: { crop_x0: number; crop_y0: number; crop_w: number; crop_h: number } | null,
    prompts?: Array<{ x: number; y: number; label: 0 | 1 }> | null
  ) => void;

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
   * Set the global composite mask (shows all visible masks)
   * @param url Composite mask image URL or null
   */
  setGlobalCompositeMask: (url: string | null) => void;

  /**
   * Add per-annotation mask to history
   * @param annotationId Annotation's markId
   * @param entry HistoryEntry to store (includes type and data)
   */
  pushPerAnnotationMaskHistory: (annotationId: string, entry: HistoryEntry) => void;

  /**
   * Undo per-annotation mask
   * @param annotationId Annotation's markId
   * @returns Previous entry or null
   */
  undoPerAnnotationMask: (annotationId: string) => HistoryEntry | null;

  /**
   * Redo per-annotation mask
   * @param annotationId Annotation's markId
   * @returns Next entry or null
   */
  redoPerAnnotationMask: (annotationId: string) => HistoryEntry | null;

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
const createInitialState = (): Pick<ClassificationState, Exclude<keyof ClassificationState, 'setSubject' | 'addAnnotation' | 'removeAnnotation' | 'undoLastAnnotation' | 'clearAnnotations' | 'setTaskAnswer' | 'setDebugImage' | 'setDebugMasks' | 'setActiveAnnotation' | 'setPerAnnotationMask' | 'setGlobalCompositeMask' | 'pushPerAnnotationMaskHistory' | 'undoPerAnnotationMask' | 'redoPerAnnotationMask' | 'saveMask' | 'buildPanoptesAnnotations' | 'buildPanoptesClassification' | 'reset'>> => ({
  subjectId: null,
  imageUrl: null,
  imageDimensions: null,
  annotations: [],
  taskAnswers: {},
  debugImageUrl: null,
  debugMasks: null,
  maskSelectionInfo: null,
  debugCrop: null,
  debugPrompts: null,
  finishedAt: null,
  perAnnotationMasks: {},
  activeAnnotationId: null,
  globalCompositeMask: null,
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
      debugImageUrl: null,
      debugMasks: null,
      maskSelectionInfo: null,
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
   * Set debug masks and mask selection information.
   * @param masks - Array of candidate masks or null to clear
   * @param selectionInfo - Information about which mask was selected
   */
  setDebugMasks: (masks, selectionInfo, crop, prompts) =>
    set({ debugMasks: masks, maskSelectionInfo: selectionInfo, debugCrop: crop || null, debugPrompts: prompts || null }),

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
          ...(state.perAnnotationMasks[annotationId] || { history: [], historyIndex: -1 }),
          maskUrl: url,
        },
      },
    })),

  /**
   * Set the global composite mask showing all visible annotations' masks.
   * @param url - Composite mask image URL or null to clear
   */
  setGlobalCompositeMask: (url) => set({ globalCompositeMask: url }),

  /**
   * Add mask to undo/redo history for a specific annotation.
   * @param annotationId - The annotation's markId
   * @param entry - HistoryEntry object (includes type and imageData)
   */
  pushPerAnnotationMaskHistory: (annotationId, entry) =>
    set((state) => {
      const annotationState = state.perAnnotationMasks[annotationId] || {
        maskUrl: null,
        history: [],
        historyIndex: -1,
      };
      const truncated = annotationState.history.slice(0, annotationState.historyIndex + 1);
      const newHistoryLength = truncated.length + 1;
      const newHistoryIndex = truncated.length;
      loggers.store(`[pushPerAnnotationMaskHistory] annotationId=${annotationId}, type=${entry.type}, newHistoryLength=${newHistoryLength}, historyIndex=${newHistoryIndex}`);
      return {
        perAnnotationMasks: {
          ...state.perAnnotationMasks,
          [annotationId]: {
            ...annotationState,
            history: [...truncated, entry],
            historyIndex: newHistoryIndex,
          },
        },
      };
    }),

  /**
   * Undo to previous mask in history for a specific annotation.
   * @param annotationId - The annotation's markId
   * @returns Previous entry or null if at beginning of history
   */
  undoPerAnnotationMask: (annotationId) => {
    const state = get();
    const annotationState = state.perAnnotationMasks[annotationId];
    if (!annotationState || annotationState.historyIndex < 0) {
      loggers.store(`[undoPerAnnotationMask] annotationId=${annotationId}, cannotUndo=true (historyIndex=${annotationState?.historyIndex ?? 'N/A'})`);
      return null;
    }
    const newIndex = annotationState.historyIndex - 1;
    loggers.store(`[undoPerAnnotationMask] annotationId=${annotationId}, oldIndex=${annotationState.historyIndex}, newIndex=${newIndex}, historyLength=${annotationState.history.length}`);
    
    // Convert ImageData to data URL if we're going to a valid history entry
    let newMaskUrl: string | null = null;
    if (newIndex >= 0 && annotationState.history[newIndex]) {
      const entry = annotationState.history[newIndex];
      if (entry.imageData) {
        const canvas = document.createElement('canvas');
        canvas.width = entry.imageData.width;
        canvas.height = entry.imageData.height;
        const ctx = canvas.getContext('2d')!;
        ctx.putImageData(entry.imageData, 0, 0);
        newMaskUrl = canvas.toDataURL('image/png');
      }
    }
    
    set((s) => ({
      perAnnotationMasks: {
        ...s.perAnnotationMasks,
        [annotationId]: {
          ...s.perAnnotationMasks[annotationId],
          historyIndex: newIndex,
          maskUrl: newMaskUrl,
        },
      },
    }));
    return newIndex >= 0 ? annotationState.history[newIndex] : null;
  },

  /**
   * Redo to next mask in history for a specific annotation.
   * @param annotationId - The annotation's markId
   * @returns Next entry or null if at end of history
   */
  redoPerAnnotationMask: (annotationId) => {
    const state = get();
    const annotationState = state.perAnnotationMasks[annotationId];
    if (!annotationState || annotationState.historyIndex >= annotationState.history.length - 1) {
      loggers.store(`[redoPerAnnotationMask] annotationId=${annotationId}, cannotRedo=true (historyIndex=${annotationState?.historyIndex ?? 'N/A'}, historyLength=${annotationState?.history.length ?? 'N/A'})`);
      return null;
    }
    const newIndex = annotationState.historyIndex + 1;
    loggers.store(`[redoPerAnnotationMask] annotationId=${annotationId}, oldIndex=${annotationState.historyIndex}, newIndex=${newIndex}, historyLength=${annotationState.history.length}`);
    
    // Convert ImageData to data URL for the new history entry
    let newMaskUrl: string | null = null;
    if (newIndex < annotationState.history.length && annotationState.history[newIndex]) {
      const entry = annotationState.history[newIndex];
      if (entry.imageData) {
        const canvas = document.createElement('canvas');
        canvas.width = entry.imageData.width;
        canvas.height = entry.imageData.height;
        const ctx = canvas.getContext('2d')!;
        ctx.putImageData(entry.imageData, 0, 0);
        newMaskUrl = canvas.toDataURL('image/png');
      }
    }
    
    set((s) => ({
      perAnnotationMasks: {
        ...s.perAnnotationMasks,
        [annotationId]: {
          ...s.perAnnotationMasks[annotationId],
          historyIndex: newIndex,
          maskUrl: newMaskUrl,
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

    // Build per-rect annotations with SAM points, latest SAM mask, and composite mask
    const rectAnnotations: Array<{
      annotationId: string;
      samPoints: Array<{ x: number; y: number; label: 0 | 1; pointId: number }>;
      latestSamMask: any; // CompressedMask or null
      compositeMask: any;  // CompressedMask or null
    }> = [];

    // Get all unique annotationIds from point annotations (to include rects with only points, no masks yet)
    // Normalize all ids to strings for consistency - Caesar IDs may be numbers, but we export as strings
    const annotationIdsWithPoints = new Set(
      annotations
        .filter((a) => a.type === 'point')
        .map((p) => String(p.annotationId ?? '-1'))
    );

    // Combine: all rects with masks + all rects with only points
    // Normalize perAnnotationMasks keys to strings as well
    const allAnnotationIds = new Set([
      ...Object.keys(perAnnotationMasks).map(id => String(id)),
      ...annotationIdsWithPoints,
    ]);

    // Process each annotation (rect or "-1" for unmarked)
    for (const annotationId of allAnnotationIds) {
      const maskState = perAnnotationMasks[annotationId];

      // 1. Collect SAM points for this rect with pointId (order of placement)
      // Normalize comparison to string since annotationId may be stored as number from Caesar
      const rectPoints = annotations.filter(
        (a): a is Extract<typeof a, { type: 'point'; annotationId?: string }> =>
          a.type === 'point' && String(a.annotationId ?? '-1') === annotationId
      );
      const samPoints = rectPoints.map((p, idx) => ({
        x: p.x,
        y: p.y,
        label: p.label,
        pointId: idx,
      }));

      // If no points and no mask history, skip this rect
      if (samPoints.length === 0 && (!maskState || maskState.history.length === 0)) {
        continue;
      }

      // 2. Get latest SAM mask at historyIndex (if mask history exists)
      // Searches backwards through history to find the most recent 'sam' type entry
      // This extracts the raw SAM prediction (not composited with modifiers)
      let latestSamMask: any = null;
      if (maskState && maskState.history.length > 0) {
        const historyUpToNow = maskState.history.slice(0, maskState.historyIndex + 1);
        for (let i = historyUpToNow.length - 1; i >= 0; i--) {
          if (historyUpToNow[i].type === 'sam') {
            latestSamMask = await compressSegmentationMask(historyUpToNow[i].imageData, 'gzip-base64', 'sam');
            break;
          }
        }
      }

      // 3. Get composite mask at historyIndex (if mask history exists)
      // Composite = bitwise OR of all masks (both SAM and brush strokes) up to historyIndex
      // Uses getSimpleComposite (same function as display) to ensure consistency
      let compositeMask: any = null;
      if (maskState && maskState.history.length > 0) {
        const historyUpToNow = maskState.history.slice(0, maskState.historyIndex + 1);
        const compositeImageData = getSimpleComposite(historyUpToNow, maskState.historyIndex);
        compositeMask = compositeImageData ? await compressSegmentationMask(compositeImageData, 'gzip-base64', 'composite') : null;
      }

      rectAnnotations.push({
        annotationId,
        samPoints,
        latestSamMask,
        compositeMask,
      });
    }

    // Add rect annotations as a single task
    if (rectAnnotations.length > 0) {
      result.push({
        task: 'rect-annotations',
        value: rectAnnotations,
      });
    }

    // Drawing annotations (exclude point annotations - they're already in rect-annotations)
    let drawingIndex = 0;
    annotations.forEach((a) => {
      if (a.type === 'point') return; // Skip points, they're in rect-annotations
      result.push({
        task: `drawing-${drawingIndex++}`,
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
