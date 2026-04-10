import { useCallback, useState, useRef, useEffect } from 'react';
import {
  loadImageAsDataUrl,
  getImageDimensions,
  normalizeImageForDisplay,
} from '@/services/imageService';
import { getQueuedSubjects, WORKFLOW_ID, QUEUE_OPTS } from '@/services/panoptesService';
import { useClassificationStore } from '@/stores/classificationStore';
import type { Subject } from '@/types/panoptes';
import { loggers } from '@/utils/logger';

/**
 * Custom hook for managing subject loading and queue management.
 * Fetches subjects from Zooniverse, loads and normalizes images, and stores in classification store.
 * @param accessToken - OAuth access token for API calls
 * @param onSubjectProcessed - Optional callback when subject has been loaded and processed, receives subject ID
 * @returns Object with subject queue state and handler functions
 */
export function useSubjectLoader(accessToken: string | undefined, onSubjectProcessed?: (subjectId: string) => Promise<void>) {
  // Use state only for triggering re-renders, use ref for actual queue data
  const [queueSize, setQueueSize] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const setSubject = useClassificationStore((s) => s.setSubject);
  
  // Store the subjects queue in a ref (doesn't trigger re-renders when it changes)
  const subjectsQueueRef = useRef<Subject[] | null>(null);
  const hasInitializedRef = useRef(false);
  
  // Use ref to store the latest callback without triggering re-renders or hook count changes
  const onSubjectProcessedRef = useRef(onSubjectProcessed);
  
  // Update ref when callback changes, but don't use it as a dependency
  useEffect(() => {
    onSubjectProcessedRef.current = onSubjectProcessed;
  }, [onSubjectProcessed]);

  /**
   * Load and process a single subject.
   * Converts image to data URL, normalizes for display/SAM2 alignment,
   * and stores in classification store.
   * @param subject - Subject to process
   */
  const processSubject = useCallback(
    async (subject: Subject) => {
      try {
        const dataUrl = await loadImageAsDataUrl(subject.locations[0]['image/jpeg']);
        // Normalize so display and SAM2 see the same pixels (fixes EXIF coordinate mismatch)
        const normalizedUrl = await normalizeImageForDisplay(dataUrl);
        const dims = await getImageDimensions(normalizedUrl);
        setSubject(subject.id, normalizedUrl, dims);
        await onSubjectProcessedRef.current?.(subject.id);
      } catch (err) {
        loggers.app('Failed to load and process subject:', err);
      }
    },
    [setSubject]
  );

  /**
   * Load next subject from queue.
   * Fetches subjects on first call, then uses queued subjects from ref.
   * Automatically processes subject and updates queue ref.
   * Prevents concurrent calls with loading state.
   */
  const loadNextSubject = useCallback(async () => {
    if (!accessToken || isLoading) return;

    setIsLoading(true);
    try {
      // If no subjects loaded yet, fetch them FIRST
      if (!hasInitializedRef.current || !subjectsQueueRef.current || subjectsQueueRef.current.length === 0) {
        try {
          const newSubjects = await getQueuedSubjects(WORKFLOW_ID, accessToken, QUEUE_OPTS);
          subjectsQueueRef.current = newSubjects;
          hasInitializedRef.current = true;
        } catch (error) {
          loggers.app('Failed to fetch queued subjects:', error);
          return;
        }
      }

      // Get current subject from ref queue
      const queue = subjectsQueueRef.current;
      if (!queue || queue.length === 0) {
        loggers.app('No subjects available in queue');
        return;
      }

      // Dequeue first subject
      const [current, ...remaining] = queue;
      subjectsQueueRef.current = remaining;
      
      // Update state to trigger re-render with new queue size
      // This is only for display purposes, actual queue is in ref
      setQueueSize(remaining.length);

      await processSubject(current);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, isLoading, processSubject]);

  return {
    queueSize,
    isLoading,
    loadNextSubject,
  };
}
