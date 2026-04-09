import type { TaskConfig } from './types';

/**
 * Sample tasks for development and testing.
 * These demonstrate the different task types supported.
 */
export const SAMPLE_TASKS: TaskConfig[] = [
  {
    id: 'task-001',
    type: 'single',
    question: 'Is there an animal present?',
    options: ['Yes', 'No', 'Unsure'],
  },
  {
    id: 'task-002',
    type: 'multiple',
    question: 'What type(s) of animals do you see?',
    options: ['Mammal', 'Bird', 'Reptile', 'Other'],
  },
  {
    id: 'task-003',
    type: 'text',
    question: 'Describe the animal(s) in detail:',
  },
];
