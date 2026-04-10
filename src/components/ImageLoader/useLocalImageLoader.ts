import { useCallback } from 'react';
import {
  loadImageAsDataUrl,
  getImageDimensions,
  normalizeImageForDisplay,
} from '@/services/imageService';
import { useClassificationStore } from '@/stores/classificationStore';
import { LOCAL_SUBJECT_ID_PREFIX, ACCEPTED_IMAGE_TYPES } from './localImageConstants';
import { loggers } from '@/utils/logger';

/**
 * Custom hook for managing local image file uploads and processing.
 * Handles file input, image normalization, and store integration.
 * @returns Object with file handler and accepted image types
 */
export function useLocalImageLoader() {
  const { setSubject } = useClassificationStore();

  /**
   * Handle local file selection and normalization.
   * Converts image to data URL, normalizes (fixes EXIF), gets dimensions,
   * and stores in classification store.
   * @param e - File input change event
   */
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const dataUrl = await loadImageAsDataUrl(file);
        // Normalize so display and SAM2 see the same pixels (fixes EXIF coordinate mismatch)
        const normalizedUrl = await normalizeImageForDisplay(dataUrl);
        const dims = await getImageDimensions(normalizedUrl);
        setSubject(`${LOCAL_SUBJECT_ID_PREFIX}${file.name}`, normalizedUrl, dims);
      } catch (err) {
        loggers.app('Failed to load local image:', err);
      }
    },
    [setSubject]
  );

  return {
    handleFileChange,
    acceptedImageTypes: ACCEPTED_IMAGE_TYPES,
  };
}
