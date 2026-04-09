/**
 * Constants for Zustand stores
 */

/**
 * Task types for Panoptes classifications
 */
export const CLASSIFICATION_TASKS = {
  GLOBAL_SEGMENTATION_MASK: 'segmentation-mask',
  PER_ANNOTATION_MASK: 'segmentation-mask',
  DRAWING: 'drawing',
} as const;

/**
 * Max history size for undo/redo operations (per annotation and global)
 */
export const MAX_HISTORY_SIZE = 50;

/**
 * Drawing annotation type prefixes
 */
export const ANNOTATION_TYPE_PREFIXES = {
  DRAWING: 'drawing',
  MASK: 'segmentation-mask',
} as const;
