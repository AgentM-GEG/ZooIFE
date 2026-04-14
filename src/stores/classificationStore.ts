import { create } from 'zustand';
import type { DrawingAnnotation } from '@/types/annotations';
import type { Classification, ClassificationMetadata, Annotation as PanoptesAnnotation } from '@/types/panoptes';
import type { AnnotationRect } from '@/components/CaesarAnnotationOverlay/types';
import { compressSegmentationMask } from '@/utils/image/compressImageMask';
import { getSimpleComposite } from '@/utils/image/maskCompositing';
import { PROJECT_ID, WORKFLOW_ID } from '@/services/panoptesService';
import { loggers } from '@/utils/logger';
import { APP_VERSION } from '@/utils/version';

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
 * A single SAM point with coordinates and label
 */
export interface SamPoint {
  x: number;
  y: number;
  label: 0 | 1; // 0 = negative, 1 = positive
}

/**
 * Track all SAM points ever placed and which are active at each history index
 */
export interface SamPointHistory {
  allSamPoints: SamPoint[]; // All points ever added, each stored once
  activePointsPerHistoryIndex: number[][]; // For each history index, which point indices are active
}

/**
 * State for a single annotation's mask history
 */
interface PerAnnotationMaskState {
  maskUrl: string | null;
  history: HistoryEntry[];
  historyIndex: number;
  samPointHistory?: SamPointHistory; // Track SAM points and which are active at each history step
}

/**
 * Get the active SAM points at a given history index
 */
export function getActiveSamPoints(samPointHistory: SamPointHistory, historyIndex: number): SamPoint[] {
  const activeIndices = samPointHistory.activePointsPerHistoryIndex[historyIndex];
  return activeIndices.map(idx => samPointHistory.allSamPoints[idx]);
}

/**
 * Find a point in the pool by exact match on coordinates and label.
 * @returns Index of the point in the pool, or -1 if not found
 */
function findPointInPool(point: SamPoint, pool: SamPoint[]): number {
  return pool.findIndex(p => p.x === point.x && p.y === point.y && p.label === point.label);
}

/**
 * State for a user-created rectangle annotation
 */
export interface UserRectState extends AnnotationRect {
  markLabel: string; // Label shown in tooltip
  markColour: string; // Stroke color (for Caesar export compatibility)
  markStroke: string; // Stroke style ('solid' | 'dashed' etc, for Caesar export compatibility)
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
  /** Composite mask showing all visible masks EXCEPT the active annotation (for reference layer) */
  compositeExcludingActiveMask: string | null;

  // ============= User-Created Rects =============
  /** User-created bounding boxes with negative IDs (-2, -3, etc.) */
  userRects: Record<string, UserRectState>;
  /** Counter for next user rect ID (incremented for each new rect, stored as negative) */
  nextUserRectId: number;

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
   * Clear annotations by type and/or for a specific rect.
   * @param rectId - Optional annotation ID (markId from Caesar rect) to target specific rect. If '-1', targets whole image.
   * @param types - Optional annotation type(s) to clear ('point', 'sam2_mask', 'brush', 'polyline'). If not specified, clears all types.
   * If no arguments provided, clears all annotations.
   */
  clearAnnotations: (rectId?: string, types?: string | string[]) => void;

  /**
   * Clear all SAM point annotations for a specific annotation.
   * Called when user clicks "Clear SAM Points" button. Does not update history.
   * @param annotationId - The annotation's markId
   */
  clearSamPoints: (annotationId: string) => void;

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
   * Set the composite mask excluding the active annotation (reference layer)
   * @param url Composite mask image URL or null
   */
  setCompositeExcludingActiveMask: (url: string | null) => void;

  /**
   * Add per-annotation mask to history
   * @param annotationId Annotation's markId
   * @param entry HistoryEntry to store (includes type and data)
   * @param samPoints Optional SAM points active at this history entry (used to populate samPointHistory)
   */
  pushPerAnnotationMaskHistory: (annotationId: string, entry: HistoryEntry, samPoints?: SamPoint[]) => void;

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
   * Update annotations array to show only active SAM points at current history index.
   * Called after undo/redo to sync displayed points with history position.
   * @param annotationId Annotation's markId
   */
  syncAnnotationsToHistoryIndex: (annotationId: string) => void;

  /**
   * Save per-annotation mask and return to global view
   * @param annotationId Annotation's markId
   */
  saveMask: (annotationId: string) => void;

  /**
   * Clear the entire mask history for a specific annotation
   * @param annotationId Annotation's markId
   */
  clearPerAnnotationMaskHistory: (annotationId: string) => void;

  // ============= Actions: User-Created Rects =============
  /**
   * Add a user-created bounding box
   * @param rect AnnotationRect with x, y, width, height
   * @returns The assigned rect ID (string, e.g., '-2', '-3')
   */
  addUserRect: (rect: AnnotationRect) => string;

  /**
   * Update a user-created rect (e.g., with new bounds after mask editing)
   * @param rectId User rect ID (e.g., '-2', '-3')
   * @param rect Updated AnnotationRect with x, y, width, height
   */
  updateUserRect: (rectId: string, rect: AnnotationRect) => void;

  /**
   * Remove a user-created rect by ID
   * @param rectId User rect ID (e.g., '-2', '-3')
   */
  removeUserRect: (rectId: string) => void;

  /**
   * Clear all user-created rects
   */
  clearUserRects: () => void;

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
const createInitialState = (): Pick<ClassificationState, Exclude<keyof ClassificationState, 'setSubject' | 'addAnnotation' | 'removeAnnotation' | 'undoLastAnnotation' | 'clearAnnotations' | 'clearSamPoints' | 'syncAnnotationsToHistoryIndex' | 'setTaskAnswer' | 'setDebugImage' | 'setDebugMasks' | 'setActiveAnnotation' | 'setPerAnnotationMask' | 'setGlobalCompositeMask' | 'setCompositeExcludingActiveMask' | 'pushPerAnnotationMaskHistory' | 'undoPerAnnotationMask' | 'redoPerAnnotationMask' | 'saveMask' | 'clearPerAnnotationMaskHistory' | 'addUserRect' | 'updateUserRect' | 'removeUserRect' | 'clearUserRects' | 'buildPanoptesAnnotations' | 'buildPanoptesClassification' | 'reset'>> => ({
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
  compositeExcludingActiveMask: null,
  userRects: {},
  nextUserRectId: -2,
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
   * Clear annotations by type and/or for a specific rect.
   * @param rectId - Optional annotation ID (markId from Caesar rect) to target specific rect. If '-1', targets whole image.
   * @param types - Optional annotation type(s) to clear ('point', 'sam2_mask', 'brush', 'polyline'). If not specified, clears all types.
   * If no arguments provided, clears all annotations.
   */
  clearAnnotations: (rectId?: string, types?: string | string[]) =>
    set((state) => {
      // If no arguments, clear everything (original behavior)
      if (rectId === undefined && types === undefined) {
        return { annotations: [], debugImageUrl: null };
      }

      // Normalize types to array
      const typesToClear = types ? (Array.isArray(types) ? types : [types]) : null;

      // Filter annotations
      const filtered = state.annotations.filter((annotation) => {
        // Check type filter
        if (typesToClear && !typesToClear.includes(annotation.type)) {
          return true; // Keep annotations not matching type filter
        }

        // Check rect filter
        if (rectId !== undefined) {
          const annRectId = (annotation as any).annotationId ?? '-1';
          if (annRectId !== rectId) {
            return true; // Keep annotations for other rects
          }
        }

        // Remove this annotation (doesn't match filters)
        return false;
      });

      return { annotations: filtered };
    }),

  /**
   * Clear all SAM point annotations for a specific annotation.
   * Called when user clicks "Clear SAM Points" button. Does not update history.
   * @param annotationId - The annotation's markId
   */
  clearSamPoints: (annotationId) =>
    set((state) => {
      const pointsBeforeCount = state.annotations.filter(
        a => a.type === 'point' && ((a as any).annotationId || '-1') === annotationId
      ).length;
      loggers.history(`[clearSamPoints] annotationId=${annotationId}, pointsCleared=${pointsBeforeCount}`);
      return {
        annotations: state.annotations.filter(
          a => !(a.type === 'point' && ((a as any).annotationId || '-1') === annotationId)
        ),
      };
    }),

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
   * Set the composite mask showing all visible masks EXCEPT the active annotation.
   * Used for the reference layer during editing.
   * @param url - Composite mask image URL or null to clear
   */
  setCompositeExcludingActiveMask: (url) => set({ compositeExcludingActiveMask: url }),

  /**
   * Add mask to undo/redo history for a specific annotation.
   * @param annotationId - The annotation's markId
   * @param entry - HistoryEntry object (includes type and imageData)
   */
  pushPerAnnotationMaskHistory: (annotationId, entry, samPoints?) =>
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

      // Update samPointHistory if SAM points were provided
      let samPointHistory = annotationState.samPointHistory;
      if (samPoints) {
        // Start with existing pool, grow it as needed (accumulative, never replace)
        let allSamPoints = annotationState.samPointHistory?.allSamPoints ?? [];
        
        // For each new point, find it in pool or add it
        const newActiveIndices = samPoints.map(newPoint => {
          const existingIdx = findPointInPool(newPoint, allSamPoints);
          if (existingIdx !== -1) {
            return existingIdx;  // Reuse existing index
          } else {
            allSamPoints.push(newPoint);  // Append to pool
            return allSamPoints.length - 1;  // Return new index
          }
        });
        
        // Truncate activePointsPerHistoryIndex in sync with mask history, then append new entry
        const truncatedEntries = annotationState.samPointHistory?.activePointsPerHistoryIndex?.slice(0, annotationState.historyIndex + 1) ?? [];
        samPointHistory = {
          allSamPoints,
          activePointsPerHistoryIndex: [...truncatedEntries, newActiveIndices],
        };
        loggers.history(`[pushPerAnnotationMaskHistory] samPointHistory updated, historyIndex=${newHistoryIndex}, pointCount=${samPoints.length}, poolSize=${allSamPoints.length}`);
      }

      return {
        perAnnotationMasks: {
          ...state.perAnnotationMasks,
          [annotationId]: {
            ...annotationState,
            history: [...truncated, entry],
            historyIndex: newHistoryIndex,
            samPointHistory,
          },
        },
      };
    }),

  /**
   * Undo to previous mask in history for a specific annotation.
   * IMPORTANT: When undoing, we composite all history entries UP TO the new index,
   * not just display the single entry at that index. This ensures multiple SAM
   * predictions or brush strokes remain visible when moving backward.
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
    
    // Composite all history entries up to the new index using bitwise OR (union)
    let newMaskUrl: string | null = null;
    if (newIndex >= 0) {
      const composite = getSimpleComposite(annotationState.history, newIndex);
      if (composite) {
        const canvas = document.createElement('canvas');
        canvas.width = composite.width;
        canvas.height = composite.height;
        const ctx = canvas.getContext('2d')!;
        ctx.putImageData(composite, 0, 0);
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
    loggers.history(`[undoPerAnnotationMask] annotationId=${annotationId}, historyIndex=${annotationState.historyIndex} -> ${newIndex}`);
    // Only sync annotations if this annotation has SAM point history and we're at a valid history index
    if (annotationState.samPointHistory && newIndex >= 0) {
      get().syncAnnotationsToHistoryIndex(annotationId);
    }
    return newIndex >= 0 ? annotationState.history[newIndex] : null;
  },

  /**
   * Redo to next mask in history for a specific annotation.
   * IMPORTANT: When redoing, we composite all history entries UP TO the new index,
   * not just display the single entry at that index. This ensures multiple SAM
   * predictions or brush strokes remain visible when moving forward.
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
    
    // Composite all history entries up to the new index using bitwise OR (union)
    let newMaskUrl: string | null = null;
    if (newIndex < annotationState.history.length) {
      const composite = getSimpleComposite(annotationState.history, newIndex);
      if (composite) {
        const canvas = document.createElement('canvas');
        canvas.width = composite.width;
        canvas.height = composite.height;
        const ctx = canvas.getContext('2d')!;
        ctx.putImageData(composite, 0, 0);
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
    loggers.history(`[redoPerAnnotationMask] annotationId=${annotationId}, historyIndex=${annotationState.historyIndex} -> ${newIndex}`);
    // Only sync annotations if this annotation has SAM point history
    if (annotationState.samPointHistory) {
      get().syncAnnotationsToHistoryIndex(annotationId);
    }
    return annotationState.history[newIndex];
  },

  /**
   * Update the annotations array to show only the active SAM points at the current history index.
   * Called after undo/redo when the annotation has SAM point history.
   * @param annotationId - The annotation's markId
   */
  syncAnnotationsToHistoryIndex: (annotationId) => {
    set((s) => {
      loggers.history(`[syncAnnotationsToHistoryIndex] Called`)
      const maskState = s.perAnnotationMasks[annotationId];
      if (!maskState?.samPointHistory) {
        loggers.history(`[syncAnnotationsToHistoryIndex] No SAM point history`)
        return s;
      }

      const activePoints = getActiveSamPoints(maskState.samPointHistory, maskState.historyIndex);
      loggers.history(`[syncAnnotationsToHistoryIndex] annotationId=${annotationId}, historyIndex=${maskState.historyIndex}, activePointsCount=${activePoints.length}`);
      
      // Remove all point annotations for this annotation, then add back only the active ones
      const oldAnnotations = s.annotations.filter(
        a => !(a.type === 'point' && ((a as any).annotationId || '-1') === annotationId)
      );
      const removedPointsCount = s.annotations.length - oldAnnotations.length;
      
      const newPointAnnotations = activePoints.map((p, idx) => ({
        type: 'point' as const,
        x: p.x,
        y: p.y,
        label: p.label,
        annotationId,
        id: `${annotationId}-point-${idx}`,
      }));

      loggers.history(`[syncAnnotationsToHistoryIndex] removed=${removedPointsCount} points, adding=${newPointAnnotations.length} points`);

      return {
        ...s,
        annotations: [...oldAnnotations, ...newPointAnnotations],
      };
    });
  },

  /**
   * Save (finalize) the mask for a specific annotation and return to global view.
   * @param annotationId - The annotation's markId
   */
  saveMask: (_annotationId) =>
    set({ activeAnnotationId: null }),

  /**
   * Clear the entire mask history for an annotation and reset its mask URL.
   * Used when clearing temporary masks (e.g., -1 mask after transferring to user rect).
   * @param annotationId - The annotation's markId
   */
  clearPerAnnotationMaskHistory: (annotationId) =>
    set((state) => {
      loggers.store(`[clearPerAnnotationMaskHistory] Clearing all history for ${annotationId}`);
      return {
        perAnnotationMasks: {
          ...state.perAnnotationMasks,
          [annotationId]: {
            maskUrl: null,
            history: [],
            historyIndex: -1,
          },
        },
      };
    }),

  // ============= User-Created Rects =============
  /**
   * Add a user-created bounding box with a negative ID
   * @param rect AnnotationRect with x, y, width, height
   * @returns The assigned rect ID (string, e.g., '-2', '-3')
   */
  addUserRect: (rect) => {
    const state = get();
    const rectId = String(state.nextUserRectId);
    
    set((s) => ({
      userRects: {
        ...s.userRects,
        [rectId]: {
          ...rect,
          markLabel: 'Volunteer-defined object',
          markColour: '#FF0000',
          markStroke: 'dashed',
        },
      },
      nextUserRectId: s.nextUserRectId - 1,
    }));
    
    loggers.store(`[addUserRect] Created rect ${rectId}: x=${rect.x}, y=${rect.y}, width=${rect.width}, height=${rect.height}`);
    return rectId;
  },

  /**
   * Update a user-created rect (e.g., with new bounds after mask editing)
   * @param rectId User rect ID (e.g., '-2', '-3')
   * @param rect Updated AnnotationRect with x, y, width, height
   */
  updateUserRect: (rectId, rect) => {
    set((s) => {
      const existingRect = s.userRects[rectId];
      return {
        userRects: {
          ...s.userRects,
          [rectId]: {
            ...existingRect,
            ...rect,
          },
        },
      };
    });
    loggers.store(`[updateUserRect] Updated rect ${rectId}: x=${rect.x}, y=${rect.y}, width=${rect.width}, height=${rect.height}`);
  },

  /**
   * Remove a user-created rect by ID
   * @param rectId User rect ID (e.g., '-2', '-3')
   */
  removeUserRect: (rectId) => {
    set((s) => {
      const { [rectId]: _, ...remaining } = s.userRects;
      return { userRects: remaining };
    });
    loggers.store(`[removeUserRect] Removed rect ${rectId}`);
  },

  /**
   * Clear all user-created rects and reset ID counter
   */
  clearUserRects: () => {
    set({ userRects: {}, nextUserRectId: -2 });
    loggers.store('[clearUserRects] Cleared all user rects');
  },

  buildPanoptesAnnotations: async () => {
    const { annotations, taskAnswers, perAnnotationMasks } = get();

    const result: PanoptesAnnotation[] = [];

    // Build per-rect annotations with SAM points, latest SAM mask, and composite mask
    const rectAnnotations: Array<{
      annotationId: string;
      samPoints: Array<{ x: number; y: number; label: 0 | 1; pointId: number }>;
      samPointHistory: {
        allSamPoints: SamPoint[];
        activePointsPerHistoryIndex: number[][];
      };
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

      // Export SAM point history for all rects.
      // If this rect has no stored history yet, synthesize a minimal one from current points.
      const samPointHistory = maskState?.samPointHistory
        ? {
            allSamPoints: maskState.samPointHistory.allSamPoints,
            activePointsPerHistoryIndex: maskState.samPointHistory.activePointsPerHistoryIndex,
          }
        : {
            allSamPoints: samPoints.map(({ x, y, label }) => ({ x, y, label })),
            activePointsPerHistoryIndex: samPoints.length > 0
              ? [samPoints.map((_, idx) => idx)]
              : [],
          };

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
        samPointHistory,
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
      classifier_version: APP_VERSION,
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
