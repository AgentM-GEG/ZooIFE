/**
 * Image loading service
 * Phase 1: Local files / static assets
 * Phase 2: Zooniverse /subjects/queued locations
 */

/**
 * Load image from file or URL and convert to data URL.
 * @param file - File object or URL string to load
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns Promise resolving to data URL string
 * @throws Error if file cannot be loaded or times out
 */
export async function loadImageAsDataUrl(file: File | string, timeoutMs = 30000): Promise<string> {
  if (file instanceof File) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const timeout = setTimeout(() => {
        reader.abort();
        reject(new Error(`File reading timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      reader.onload = () => {
        clearTimeout(timeout);
        resolve(reader.result as string);
      };

      reader.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to read file: ${reader.error?.message ?? 'unknown error'}`));
      };

      reader.readAsDataURL(file);
    });
  }

  // Load from URL
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(file, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Failed to fetch image from URL: HTTP ${response.status}`);
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`Image fetch timeout after ${timeoutMs}ms`);
      }
      throw error;
    }
    throw new Error(`Failed to load image from URL: ${String(error)}`);
  }
}

/**
 * Normalize image so pixels match what the browser displays (EXIF orientation, etc).
 * Draws to canvas and re-exports. Use before sending to SAM2 to avoid coordinate mismatch.
 * @param dataUrl - Data URL of image to normalize
 * @param timeoutMs - Timeout in milliseconds (default: 10000)
 * @returns Promise resolving to normalized image data URL
 * @throws Error if image cannot be normalized
 */
export async function normalizeImageForDisplay(dataUrl: string, timeoutMs = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timeout = setTimeout(() => {
      reject(new Error(`Image normalization timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Could not get canvas context for image normalization');
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Failed to load image for normalization'));
    };

    img.src = dataUrl;
  });
}

/**
 * Get dimensions of an image from URL.
 * @param src - Image source URL
 * @param timeoutMs - Timeout in milliseconds (default: 10000)
 * @returns Promise resolving to object with width and height in pixels
 * @throws Error if image cannot be loaded
 */
export function getImageDimensions(src: string, timeoutMs = 10000): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timeout = setTimeout(() => {
      reject(new Error(`Image dimension loading timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    img.onload = () => {
      clearTimeout(timeout);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };

    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error(`Failed to load image from URL: ${src}`));
    };

    img.src = src;
  });
}

/**
 * Extract image URL from Zooniverse subject locations array.
 * For Zooniverse: subject.locations is array of { "image/jpeg": "url" }
 * @param locations - Array of location objects mapping MIME types to URLs
 * @returns Image URL or null if no supported format found
 */
export function getSubjectImageUrl(locations: Array<Record<string, string>>): string | null {
  const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  for (const loc of locations) {
    for (const mime of imageTypes) {
      if (loc[mime]) return loc[mime];
    }
  }
  return null;
}
