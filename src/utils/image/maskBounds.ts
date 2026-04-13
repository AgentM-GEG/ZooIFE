/**
 * Mask bounding box computation utilities
 * 
 * Converts PNG mask data URLs to bounding rectangles for creating annotation boxes
 */

import type { AnnotationRect } from '@/components/CaesarAnnotationOverlay/types';
import { loggers } from '@/utils/logger';

/**
 * Compute bounding box from a PNG mask data URL
 * 
 * Loads the mask image, extracts pixel data, and finds the minimal bounding rectangle
 * that encompasses all non-transparent pixels.
 * 
 * @param maskUrl - PNG mask data URL (e.g., 'data:image/png;base64,...')
 * @returns Promise resolving to AnnotationRect with x, y, width, height, or null if invalid/empty
 * @throws Error if image fails to load
 * 
 * @example
 * const maskUrl = 'data:image/png;base64,iVBORw0KGgo...';
 * const bounds = await computeMaskBounds(maskUrl);
 * if (bounds) {
 *   console.log(`Rect: ${bounds.x}, ${bounds.y}, ${bounds.width}x${bounds.height}`);
 * }
 */
export async function computeMaskBounds(maskUrl: string | null): Promise<AnnotationRect | null> {
  if (!maskUrl) {
    loggers.masks('[computeMaskBounds] No mask URL provided');
    return null;
  }

  return new Promise((resolve) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        // Create canvas and draw image to extract pixel data
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          loggers.masks('[computeMaskBounds] Failed to get canvas context');
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        
        const bounds = extractBoundingBox(imageData);
        
        if (bounds) {
          loggers.masks(`[computeMaskBounds] Extracted bounds: x=${bounds.x}, y=${bounds.y}, width=${bounds.width}, height=${bounds.height} from ${img.width}x${img.height}`);
        } else {
          loggers.masks('[computeMaskBounds] No non-transparent pixels found in mask');
        }
        
        resolve(bounds);
      } catch (err) {
        loggers.masks(`[computeMaskBounds] Error extracting bounds: ${err}`);
        resolve(null);
      }
    };

    img.onerror = () => {
      loggers.masks('[computeMaskBounds] Failed to load image from mask URL');
      resolve(null);
    };

    // Set the source last to trigger loading
    img.src = maskUrl;
  });
}

/**
 * Extract bounding box from ImageData by finding min/max pixel coordinates
 * 
 * Scans all pixels in the image and identifies the minimal rectangle that contains
 * all non-transparent (alpha > 0) pixels.
 * 
 * @param imageData - Canvas ImageData with pixel information
 * @returns AnnotationRect with bounds, or null if no non-transparent pixels found
 */
function extractBoundingBox(imageData: ImageData): AnnotationRect | null {
  const { data, width, height } = imageData;
  
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  let foundPixel = false;

  // Scan pixel data: RGBA format, 4 bytes per pixel
  // Alpha channel is at index (pixelIndex * 4 + 3)
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]; // Alpha channel
    
    if (alpha > 0) {
      // Calculate pixel position from byte index
      const pixelIndex = i / 4;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      foundPixel = true;
    }
  }

  // If no pixels found, return null
  if (!foundPixel) {
    return null;
  }

  // Convert min/max coordinates to rect (minX/minY is top-left, width/height)
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/**
 * Check if a mask has any non-transparent pixels
 * 
 * @param maskUrl - PNG mask data URL
 * @returns Promise resolving to true if mask has pixels, false otherwise
 */
export async function hasMaskPixels(maskUrl: string | null): Promise<boolean> {
  if (!maskUrl) {
    return false;
  }

  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(false);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const { data } = imageData;

        // Check if any alpha channel pixel is > 0
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] > 0) {
            resolve(true);
            return;
          }
        }

        resolve(false);
      } catch (err) {
        loggers.masks(`[hasMaskPixels] Error checking mask pixels: ${err}`);
        resolve(false);
      }
    };

    img.onerror = () => {
      resolve(false);
    };

    img.src = maskUrl;
  });
}
