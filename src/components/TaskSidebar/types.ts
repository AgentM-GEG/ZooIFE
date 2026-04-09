/**
 * Configuration for a single classification task.
 */
export interface TaskConfig {
  /** Unique identifier for the task */
  id: string;
  /** Type of task: single choice, multiple choice, or freeform text */
  type: 'single' | 'multiple' | 'text';
  /** Question/prompt text to display */
  question: string;
  /** Available options for single/multiple choice tasks */
  options?: string[];
}
