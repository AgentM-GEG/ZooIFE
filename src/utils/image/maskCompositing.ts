/**
 * Mask compositing utilities for handling SAM predictions and brush strokes
 * 
 * Compositing logic:
 * 1. Find the most recent SAM prediction
 * 2. Composite all modifier brush strokes before that prediction
 * 3. Composite the SAM prediction with the composite from step 2
 * 4. Apply all modifier brush strokes made after the last SAM prediction
 */

import type { HistoryEntry } from '@/stores/classificationStore';
import { loggers } from '@/utils/logger';

/**
 * Composite multiple ImageData masks by overlaying them on top of each other.
 * Later masks in the array are drawn on top of earlier ones.
 * 
 * @param masks - Array of ImageData masks to composite (must all have same dimensions)
 * @returns Composite ImageData with all masks overlaid, or null if empty array
 */
export function compositeImageDataMasks(masks: ImageData[]): ImageData | null {
    if (masks.length === 0) return null;
    if (masks.length === 1) return masks[0];

    const firstMask = masks[0];
    const { width, height } = firstMask;

    // Create composite by ORing all mask pixels together
    // This combines all masks into one without any overwriting
    const compositeData = new Uint8ClampedArray(firstMask.data);

    for (let i = 1; i < masks.length; i++) {
        const mask = masks[i];
        
        if (mask.width !== width || mask.height !== height) {
            loggers.masks(`[compositeImageDataMasks] Mask dimension mismatch: expected ${width}x${height}, got ${mask.width}x${mask.height}`);
            continue;
        }

        // OR each pixel value from this mask with the composite
        // This preserves all mask data - if either mask has a pixel, it appears in composite
        for (let j = 0; j < mask.data.length; j++) {
            compositeData[j] = compositeData[j] | mask.data[j];
        }
    }

    const composite = new ImageData(compositeData, width, height);
    loggers.masks(`[compositeImageDataMasks] Composited ${masks.length} masks via bitwise OR, result=${width}x${height}`);
    
    return composite;
}

/**
 * Simple composite: bitwise OR all masks up to the given index.
 * IMPORTANT: This is the CANONICAL compositing logic used for both display and export.
 * It ensures display and export are consistent.
 * 
 * Do NOT use SAM-aware compositing (finding latest SAM, pre/post positioning) for display,
 * as that can cause earlier SAM predictions to be lost when multiple SAMs are placed.
 * 
 * @param history - HistoryEntry array from mask history
 * @param upToIndex - Max index to composite (inclusive)
 * @returns Composited ImageData or null if no valid history
 */
export function getSimpleComposite(history: HistoryEntry[], upToIndex: number): ImageData | null {
  if (history.length === 0 || upToIndex < 0) {
    return null;
  }

  // Clamp to valid range
  const maxIndex = Math.min(upToIndex, history.length - 1);
  
  // Start with empty (all zeros)
  const firstEntry = history[0];
  const compositeData = new Uint8ClampedArray(firstEntry.imageData.data.length);
  
  // OR all entries from 0 to maxIndex (inclusive)
  for (let i = 0; i <= maxIndex && i < history.length; i++) {
    const hEntry = history[i];
    for (let j = 0; j < hEntry.imageData.data.length; j++) {
      compositeData[j] = compositeData[j] | hEntry.imageData.data[j];
    }
  }
  
  return new ImageData(compositeData, firstEntry.imageData.width, firstEntry.imageData.height);
}

/**
 * Composite a mask history up to the given index.
 * Implements the rule: modifier strokes before latest SAM + SAM + modifier strokes after SAM.
 * 
 * @param history - HistoryEntry array from mask history
 * @param upToIndex - Max index to composite (inclusive), or last index if -1
 * @returns Composited ImageData or null if no history
 */
export function compositeHistoryUpToIndex(history: HistoryEntry[], upToIndex: number): ImageData | null {
  if (history.length === 0 || upToIndex < 0) {
    return null;
  }

  // Clamp upToIndex to valid range
  const maxIndex = Math.min(upToIndex, history.length - 1);

  // Step 1: Find the most recent SAM prediction at or before maxIndex
  let latestSamIndex = -1;
  for (let i = maxIndex; i >= 0; i--) {
    if (history[i].type === 'sam') {
      latestSamIndex = i;
      break;
    }
  }

  loggers.masks(`[compositeHistoryUpToIndex] upToIndex=${upToIndex}, maxIndex=${maxIndex}, latestSamIndex=${latestSamIndex}`);

  // If no SAM found, composite all modifier strokes
  if (latestSamIndex === -1) {
    const modifierStrokes = history
      .slice(0, maxIndex + 1)
      .filter(e => e.type === 'modifier_brush')
      .map(e => e.imageData);
    
    if (modifierStrokes.length === 0) {
      return null;
    }

    loggers.masks(`[compositeHistoryUpToIndex] No SAM found, compositing ${modifierStrokes.length} modifier strokes`);
    return compositeImageDataMasks(modifierStrokes);
  }

  // Step 2: Composite all modifier brush strokes BEFORE the latest SAM
  const presamModifiers = history
    .slice(0, latestSamIndex)
    .filter(e => e.type === 'modifier_brush')
    .map(e => e.imageData);

  let baseComposite: ImageData | null = null;
  if (presamModifiers.length > 0) {
    baseComposite = compositeImageDataMasks(presamModifiers);
    loggers.masks(`[compositeHistoryUpToIndex] Composited ${presamModifiers.length} pre-SAM modifiers`);
  }

  // Step 3: Composite the SAM prediction with pre-SAM modifiers
  const latestSam = history[latestSamIndex];
  let samComposite: ImageData;

  if (baseComposite && latestSam.imageData) {
    samComposite = compositeImageDataMasks([baseComposite, latestSam.imageData]) || latestSam.imageData;
    loggers.masks(`[compositeHistoryUpToIndex] Composited pre-SAM modifiers with SAM prediction`);
  } else if (latestSam.imageData) {
    samComposite = latestSam.imageData;
    loggers.masks(`[compositeHistoryUpToIndex] Using SAM prediction as base (no pre-SAM modifiers)`);
  } else {
    return baseComposite;
  }

  // Step 4: Apply all MODIFIER BRUSH strokes after the latest SAM
  const postsamModifiers = history
    .slice(latestSamIndex + 1, maxIndex + 1)
    .filter(e => e.type === 'modifier_brush')
    .map(e => e.imageData);

  let finalComposite = samComposite;
  if (postsamModifiers.length > 0) {
    finalComposite = compositeImageDataMasks([samComposite, ...postsamModifiers]) || samComposite;
    loggers.masks(`[compositeHistoryUpToIndex] Applied ${postsamModifiers.length} post-SAM modifiers`);
  }

  return finalComposite;
}

/**
 * Get the mask to display for the current history state.
 * @param history - HistoryEntry array from mask history
 * @param historyIndex - Current position in history (-1 if empty)
 * @returns Composited ImageData or null
 */
export function getCompositeForHistoryIndex(history: HistoryEntry[], historyIndex: number): ImageData | null {
  return compositeHistoryUpToIndex(history, historyIndex);
}

/**
 * Create a debug visualization of mask compositing.
 * Overlays the latest raw SAM prediction with red color to visualize its contribution.
 * 
 * The resulting image shows:
 * - Cyan/green areas: Composite from modifier strokes + SAM (darker = more layers)
 * - Red-tinted areas: Parts that are in the latest raw SAM prediction
 * - Darker areas where red and cyan overlap: SAM covered by post-SAM modifiers
 * 
 * @param history - HistoryEntry array from mask history
 * @param upToIndex - Max index to composite (inclusive)
 * @returns Composited ImageData with debug overlay, or null if no history
 */
export function compositeHistoryUpToIndexDebug(history: HistoryEntry[], upToIndex: number): ImageData | null {
  if (history.length === 0 || upToIndex < 0) {
    loggers.masks(`[compositeHistoryUpToIndexDebug] No history (length=${history.length}, upToIndex=${upToIndex})`);
    return null;
  }

  // Get the normal composite
  const normalComposite = compositeHistoryUpToIndex(history, upToIndex);
  if (!normalComposite) {
    loggers.masks(`[compositeHistoryUpToIndexDebug] Normal composite returned null`);
    return null;
  }

  // Clamp upToIndex to valid range
  const maxIndex = Math.min(upToIndex, history.length - 1);

  // Find the latest SAM prediction
  let latestSamIndex = -1;
  for (let i = maxIndex; i >= 0; i--) {
    if (history[i].type === 'sam') {
      latestSamIndex = i;
      break;
    }
  }

  // If no SAM, just return the normal composite
  if (latestSamIndex === -1) {
    loggers.masks(`[compositeHistoryUpToIndexDebug] No SAM found in history, returning normal composite`);
    return normalComposite;
  }

  const latestSam = history[latestSamIndex];
  if (!latestSam.imageData) {
    loggers.masks(`[compositeHistoryUpToIndexDebug] No imageData found at index ${latestSamIndex}`);
    return normalComposite;
  }

  loggers.masks(`[compositeHistoryUpToIndexDebug] Found latestSamIndex=${latestSamIndex}, SAM imageData exists, dimensions=${latestSam.imageData.width}x${latestSam.imageData.height}`);

  // Log sample pixels from SAM to understand the format
  const samData = latestSam.imageData.data;
  loggers.masks('[compositeHistoryUpToIndexDebug] Sample SAM pixels:');
  for (let i = 0; i < Math.min(40, samData.length); i += 4) {
    loggers.masks(`  Pixel ${i/4}: R=${samData[i]}, G=${samData[i+1]}, B=${samData[i+2]}, A=${samData[i+3]}`);
  }

  // Create debug image: copy normal composite and overlay raw SAM with red
  const debugImage = new ImageData(
    new Uint8ClampedArray(normalComposite.data),
    normalComposite.width,
    normalComposite.height
  );

  const debugData = debugImage.data;

  // Count pixels that get the red overlay
  let redPixelsAdded = 0;

  // Try multiple approach: check if any channel is non-zero (mask pixel)
  for (let i = 0; i < samData.length; i += 4) {
    // Check if this pixel is part of the mask (any channel > 0)
    const r = samData[i];
    const g = samData[i + 1];
    const b = samData[i + 2];
    const a = samData[i + 3];
    
    // Consider it a mask pixel if alpha > 0 and any color channel > 0
    if (a > 0 && (r > 0 || g > 0 || b > 0)) {
      // This pixel is in the mask - make it EXTREMELY RED for visibility
      debugData[i] = 255; // Max red
      debugData[i + 1] = 0; // No green
      debugData[i + 2] = 0; // No blue
      debugData[i + 3] = 255; // Full alpha
      redPixelsAdded++;
    }
  }

  loggers.masks(`[compositeHistoryUpToIndexDebug] Overlaid raw SAM prediction with red visualization (${redPixelsAdded} pixels modified)`);
  return debugImage;
}
