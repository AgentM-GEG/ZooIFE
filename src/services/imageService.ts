/**
 * Image loading service
 * Phase 1: Local files / static assets
 * Phase 2: Zooniverse /subjects/queued locations
 */

export async function loadImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * For Zooniverse: subject.locations is array of { "image/jpeg": "url" }
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
