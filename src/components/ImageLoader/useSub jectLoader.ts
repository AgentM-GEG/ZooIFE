import { useCallback, useState } from 'react';
import {
  loadImageAsDataUrl,
  getImageDimensions,
  normalizeImageForDisplay,
} from '@/services/imageService';
import { getQueuedSubjects, WORKFLOW_ID, QUEUE_OPTS } from '@/services/panoptesService';
import { useClassificationStore } from '@/stores/classificationStore';
import type { Subject } from '@/types/panoptes';

/**
 * Custom hook for managing subject loading and queue management.
 * Fetches subjects from Zooniverse, loads and normalizes images, and stores in classification store.
 * @param accessToken - OAuth access token for API calls
 * @param onSubjectProcessed - Optional callback when subject has been loaded and processed
 * @returns Object with subject queue state and handler functions
 */
export function useSubjectLoader(accessToken: string | undefined, onSubjectProcessed?: () => void) {
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const setSubject = useClassificationStore((s) => s.setSubject);

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
        onSubjectProcessed?.();
      } catch (err) {
        console.error('Failed to load and process subject:', err);
      }
    },
    [setSubject, onSubjectProcessed]
  );

  /**
   * Load next subject from queue.
   * Fetches subjects on first call, then uses queued subjects.
   * Automatically processes subject and updates queue.
   */
  const loadNextSubject = useCallback(async () => {
    if (!accessToken) return;

    // If no subjects loaded yet, fetch them FIRST and use them immediately
    if (!subjects || subjects.length === 0) {
      const newSubjects = await getQueuedSubjects(WORKFLOW_ID, accessToken, QUEUE_OPTS);

      // Save to React state
      setSubjects(newSubjects);

      // Use them immediately (React state won't update yet)
      const [current, ...remaining] = newSubjects;
      setSubjects(remaining);

      await processSubject(current);
      return;
    }

    // We have subjects in state (safe to use)
    const [current, ...remaining] = subjects;
    setSubjects(remaining);

    await processSubject(current);
  }, [subjects, accessToken, processSubject]);

  return {
    subjects,
    loadNextSubject,
    queueSize: subjects?.length ?? 0,
  };
}
