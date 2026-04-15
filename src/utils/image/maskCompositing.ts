/**
 * Mask compositing utilities for handling SAM predictions and brush strokes
 *
 * Two distinct storage strategies exist in mask history:
 *
 * - `sam` entries store only the RAW MODEL PREDICTION (not a cumulative snapshot).
 *   They must be OR-composited with all preceding entries so that multiple SAM
 *   predictions and any pre-SAM brush work remain visible simultaneously.
 *
 * - `modifier_brush` entries store a FULL CANVAS SNAPSHOT encoding the cumulative
 *   effect of all preceding operations, including subtract/erase. The snapshot must be
 *   returned directly; OR-compositing would incorrectly resurrect pixels erased by
 *   subtract strokes.
 *
 * `getSimpleComposite` is the canonical compositing function for both display and
 * export, and handles both strategies automatically.
 */

import type { HistoryEntry } from '@/stores/classificationStore';
import { loggers } from '@/utils/logger';

/**
 * Composite multiple ImageData masks by overlaying them on top of each other.
 * Later masks in the array are drawn on top of earlier ones.
 * Uses canvas context compositing to properly blend semi-transparent masks.
 * 
 * @param masks - Array of ImageData masks to composite (must all have same dimensions)
 * @returns Composite ImageData with all masks overlaid, or null if empty array
 */
export function compositeImageDataMasks(masks: ImageData[]): ImageData | null {
    if (masks.length === 0) return null;
    if (masks.length === 1) return masks[0];

    const firstMask = masks[0];
    const { width, height } = firstMask;

    // Use canvas context to composite masks with proper alpha blending
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    // Draw each mask on top of previous ones using 'lighter' composite mode
    // This produces consistent opacity and prevents opacity stacking
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < masks.length; i++) {
        const mask = masks[i];
        
        if (mask.width !== width || mask.height !== height) {
            loggers.masks(`[compositeImageDataMasks] Mask dimension mismatch: expected ${width}x${height}, got ${mask.width}x${mask.height}`);
            continue;
        }

        // Create temporary image for this mask and draw it
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = mask.width;
        tempCanvas.height = mask.height;
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.putImageData(mask, 0, 0);
        
        ctx.drawImage(tempCanvas, 0, 0);
    }

    const composite = ctx.getImageData(0, 0, width, height);
    loggers.masks(`[compositeImageDataMasks] Composited ${masks.length} masks via canvas context, result=${width}x${height}`);
    
    return composite;
}

/**
 * Composite history entries up to the given index for display and export.
 * IMPORTANT: This is the CANONICAL compositing logic used for both display and export.
 * It ensures display and export are consistent.
 *
 * Two storage strategies exist in history:
 * - `modifier_brush` entries store a FULL CANVAS SNAPSHOT: the cumulative mask state at
 *   that stroke, including the effect of any preceding add and subtract operations.
 *   These must be returned directly — OR-compositing with earlier entries would
 *   incorrectly resurrect pixels that were erased by subtract strokes.
 * - `sam` entries store only the RAW MODEL PREDICTION (not a cumulative snapshot).
 *   Multiple SAM predictions and any brush work before them must be OR-composited
 *   so that all earlier contributions remain visible.
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

  const targetEntry = history[maxIndex];

  // modifier_brush snapshots already encode the correct cumulative state (including
  // subtract/erase). Return a copy directly — no compositing needed or wanted.
  if (targetEntry.type === 'modifier_brush') {
    loggers.masks(`[getSimpleComposite] modifier_brush at index=${maxIndex}, using snapshot directly`);
    return new ImageData(
      new Uint8ClampedArray(targetEntry.imageData.data),
      targetEntry.imageData.width,
      targetEntry.imageData.height,
    );
  }

  // sam entry: OR all entries from 0 to maxIndex so all SAM predictions and any
  // pre-SAM brush work remain visible.
  loggers.masks(`[getSimpleComposite] sam at index=${maxIndex}, OR-compositing ${maxIndex + 1} entries`);
  const firstEntry = history[0];
  const compositeData = new Uint8ClampedArray(firstEntry.imageData.data.length);

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

  loggers.masks(`[compositeHistoryUpToIndex] upToIndex=${upToIndex}, maxIndex=${maxIndex}, historyLength=${history.length}`);

  // Collect ALL entries (both SAM and modifier_brush) up to maxIndex
  const entriesToComposite = history.slice(0, maxIndex + 1);
  
  if (entriesToComposite.length === 0) {
    return null;
  }

  // Extract all ImageData from entries in order
  const allMasks = entriesToComposite
    .filter(e => e.imageData)
    .map(e => e.imageData);

  if (allMasks.length === 0) {
    return null;
  }

  loggers.masks(`[compositeHistoryUpToIndex] Compositing ${allMasks.length} total entries (${entriesToComposite.filter(e => e.type === 'sam').length} SAM + ${entriesToComposite.filter(e => e.type === 'modifier_brush').length} brush)`);

  // Composite all masks together in order
  const composite = compositeImageDataMasks(allMasks);
  return composite;
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
