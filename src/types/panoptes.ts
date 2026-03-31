/**
 * Panoptes / Zooniverse API types
 * Aligned with CSSI IFE Interoperability and Panoptes API
 */

import { CompressedMask } from "@/utils/image/compressImageMask";

export interface SubjectLocation {
  [mimeType: string]: string; // e.g. { "image/jpeg": "https://..." }
}

export interface Subject {
  id: string;
  locations: SubjectLocation[];
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface WorkflowTask {
  type: 'single' | 'multiple' | 'drawing';
  question?: string;
  instruction?: string;
  answers?: Array<{ value: string; label: string; next?: string }>;
  tools?: Array<{ type: string; label: string; value?: string; color?: string }>;
  next?: string | null;
  required?: boolean;
}

export interface Workflow {
  id: string;
  display_name: string;
  workflow_version: string;
  first_task: string;
  tasks: Record<string, WorkflowTask>;
  links?: { project: string; subject_sets: string[] };
}

export interface Annotation {
  task: string;
  value: string | string[] | number[] | Record<string, unknown> | CompressedMask | unknown[];
}

export interface ClassificationMetadata {
  started_at: string;
  finished_at: string;
  user_agent: string;
  user_language: string;
  workflow_version: string;
}

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
