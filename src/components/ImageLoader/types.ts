import type { Subject } from '@/types/panoptes';

/**
 * Options for subject loading and Caesar reduction fetching
 */
export interface SubjectLoaderOptions {
  token: string;
  workflowId: string;
}

/**
 * Processed subject data ready for display
 */
export interface ProcessedSubject extends Subject {
  imageUrl: string;
  imageData?: {
    width: number;
    height: number;
  };
}
