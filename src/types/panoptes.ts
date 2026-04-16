/**
 * Panoptes / Zooniverse API types
 * 
 * Defines the types for subjects, workflows, and classifications.
 * Aligned with CSSI IFE Interoperability specification and Panoptes API v1.
 * 
 * See docs/TYPES.md for detailed documentation.
 * See https://github.com/zooniverse/Panoptes/wiki/API-Conventions for API spec.
 */

import { CompressedMask } from "@/utils/image/compressImageMask";

/**
 * Subject location with MIME type keys
 * 
 * Maps MIME types to URLs. A subject can have multiple formats.
 * 
 * @example
 * {
 *   "image/jpeg": "https://example.com/image.jpg",
 *   "image/png": "https://example.com/image.png"
 * }
 */
export interface SubjectLocation {
  [mimeType: string]: string;
}

/**
 * Zooniverse subject - the item being classified
 * 
 * A subject is the data unit (image, video, etc.) that users classify.
 * Contains URLs to the actual media via locations.
 * 
 * @example
 * {
 *   id: "12345",
 *   locations: [{ "image/jpeg": "https://example.com/image.jpg" }],
 *   metadata: { species: "monarch", location: "california" },
 *   created_at: "2024-01-15T10:30:00Z",
 *   updated_at: "2024-01-15T10:30:00Z"
 * }
 * 
 * @see SubjectLocation for URL mapping
 * @see useSubjectLoader for how subjects are fetched
 */
export interface Subject {
  id: string;
  locations: SubjectLocation[];
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

/**
 * Single task in a workflow
 * 
 * Defines a classification question or drawing action within the workflow.
 * Multiple tasks chain together to form the complete classification interface.
 * 
 * Task types:
 * - `single` — Click one answer from multiple choice
 * - `multiple` — Select multiple answers (checkbox)
 * - `drawing` — Use drawing tools to annotate image
 * 
 * @example Single-choice task
 * {
 *   type: "single",
 *   question: "What species is this?",
 *   instruction: "Select the closest match",
 *   answers: [
 *     { value: "monarch", label: "Monarch" },
 *     { value: "viceroy", label: "Viceroy" }
 *   ],
 *   next: "task-2"
 * }
 * 
 * @example Drawing task
 * {
 *   type: "drawing",
 *   instruction: "Mark all insects in the image",
 *   tools: [
 *     { type: "point", label: "Point" },
 *     { type: "brush", label: "Brush" }
 *   ],
 *   next: "task-3"
 * }
 */
export interface WorkflowTask {
  type: 'single' | 'multiple' | 'drawing';
  question?: string;
  instruction?: string;
  answers?: Array<{ value: string; label: string; next?: string }>;
  tools?: Array<{ type: string; label: string; value?: string; color?: string }>;
  next?: string | null;
  required?: boolean;
}

/**
 * Complete workflow definition
 * 
 * Defines the entire classification interface for a project.
 * Contains tasks that chain together based on user responses.
 * 
 * @example
 * {
 *   id: "workflow-1",
 *   display_name: "Identify Butterfly",
 *   workflow_version: "1.0",
 *   first_task: "which-species",
 *   tasks: {
 *     "which-species": {
 *       type: "single",
 *       question: "What species is this?",
 *       answers: [...]
 *     }
 *   }
 * }
 * 
 * @see WorkflowTask for task structure
 * @see panoptesService.getWorkflow for API fetching
 */
export interface Workflow {
  id: string;
  display_name: string;
  workflow_version: string;
  first_task: string;
  tasks: Record<string, WorkflowTask>;
  links?: { project: string; subject_sets: string[] };
}

/**
 * Single annotation in a classification
 * 
 * Value can be:
 * - String for single-choice answers
 * - Array of strings for multiple-choice answers
 * - Array of numbers for counting tasks
 * - Record for complex data (e.g., segmentation masks)
 * - CompressedMask for image segmentation data
 * 
 * @example
 * { task: "species-id", value: "monarch" }
 * { task: "patterns", value: ["orange", "black", "white"] }
 * { task: "segmentation-mask", value: { size: [...], rle: "..." } }
 * 
 * @see Classification for how annotations are grouped
 * @see CompressedMask for segmentation format
 */
export interface Annotation {
  task: string;
  value: string | string[] | number[] | Record<string, unknown> | CompressedMask | unknown[];
}

/**
 * Classification metadata - timing and context information
 * 
 * Captures when the classification was started/finished and user environment.
 * Required for all classifications submitted to Panoptes.
 * 
 * @example
 * {
 *   started_at: "2024-01-15T10:30:00Z",
 *   finished_at: "2024-01-15T10:45:30Z",
 *   user_agent: "Mozilla/5.0...",
 *   user_language: "en",
 *   workflow_version: "50",
 *   classifier_version: "IFE-0.1.0"
 * }
 */
export interface ClassificationMetadata {
  started_at: string;
  finished_at: string;
  user_agent: string;
  user_language: string;
  workflow_version: string;
}

/**
 * Complete classification submission to Panoptes API
 * 
 * This is the final object submitted after user completes all classification tasks.
 * Contains metadata, all annotations, and references to the subject and workflow.
 * 
 * @example
 * {
 *   completed: true,
 *   metadata: {
 *     started_at: "2024-01-15T10:30:00Z",
 *     finished_at: "2024-01-15T10:45:30Z",
 *     user_agent: "Mozilla/5.0...",
 *     user_language: "en",
 *     workflow_version: "50"
 *   },
 *   annotations: [
 *     { task: "species-id", value: "monarch" },
 *     { task: "segmentation-mask", value: { size: [...], rle: "..." } }
 *   ],
 *   links: {
 *     subjects: ["12345"],
 *     workflow: "workflow-1",
 *     project: "project-1"
 *   }
 * }
 * 
 * @see Annotation for annotation structure
 * @see ClassificationMetadata for metadata structure
 * @see classificationStore.buildPanoptesClassification for how this is built
 * @see panoptesService.submitClassification for API submission
 */
export interface Classification {
  completed?: boolean;
  metadata: ClassificationMetadata;
  annotations: Annotation[];
  links: {
    subjects: string[];
    workflow: string;
    project: string;
  };
}
