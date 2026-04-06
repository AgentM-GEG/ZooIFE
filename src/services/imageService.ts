/**
 * Image loading service
 * Phase 1: Local files / static assets
 * Phase 2: Zooniverse /subjects/queued locations
 */

/**
 * Load image from file or URL and convert to data URL.
 * @param file - File object or URL string to load
 * @returns Promise resolving to data URL string
 */
export async function loadImageAsDataUrl(file: File | string): Promise<string> {
  if (file instanceof File) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  else {
    return new Promise((resolve, reject) => {
      fetch(file).then(response => response.blob())
        .then(blob => {
          let imgURL = URL.createObjectURL(blob);
          resolve(imgURL);
        }).catch(error => {
          console.error(`Error fetching image: ${error}`)
          reject();
        });
    });
  }
}

/**
 * Normalize image so pixels match what the browser displays (EXIF orientation, etc).
 * Draws to canvas and re-exports. Use before sending to SAM2 to avoid coordinate mismatch.
 * @param dataUrl - Data URL of image to normalize
 * @returns Promise resolving to normalized image data URL
 */
export async function normalizeImageForDisplay(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image for normalization'));
    img.src = dataUrl;
  });
}

/**
 * Get dimensions of an image from URL.
 * @param src - Image source URL
 * @returns Promise resolving to object with width and height in pixels
 */
export function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
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
