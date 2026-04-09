# ImageLoader Component

## Overview

ImageLoader is a React component that enables users to upload and load local image files from their device for classification. It automatically normalizes images (fixing EXIF orientation) and prepares them for annotation display on the canvas.

Unlike ZooniverseImageLoader which fetches subjects from the Zooniverse platform, ImageLoader works with local files selected by the user through a native file picker.

**File Structure:**
- `ImageLoader.tsx` — Main component (22 lines)
- `useLocalImageLoader.ts` — Custom hook for file handling and image processing
- `localImageConstants.ts` — Configuration constants
- `styled.ts` — Shared styled components (Container, Button, HiddenInput)

## Architecture

### Component Hierarchy

```
ImageLoader (main component)
├── Container (styled wrapper)
├── HiddenInput (hidden file input)
└── Button (styled button)
    └── onClick → inputRef.current?.click()
        └── handleFileChange()
            └── useLocalImageLoader hook
                ├── loadImageAsDataUrl()
                ├── normalizeImageForDisplay()
                ├── getImageDimensions()
                └── Classification Store
```

### Data Flow

1. **User Interaction**
   - User clicks "Load Image" button
   - Button triggers hidden file input click
   - Native file picker dialog opens

2. **File Selection**
   - User selects image file from device
   - `handleFileChange()` triggered with selected file

3. **Image Processing**
   - Load image file as data URL
   - Normalize image (fix EXIF rotation, coordinates)
   - Get image dimensions (width, height)
   - Create subject ID from filename

4. **State Storage**
   - Store in classification store with subject ID format: `local-{filename}`
   - Image URL, dimensions ready for display

## Types & Constants

### Subject ID Format

```typescript
const subjectId = `local-${file.name}`;
// Example: "local-photo.jpg"
```

This prefix distinguishes local uploads from Zooniverse subjects in the store.

## Custom Hook: useLocalImageLoader

Located in `useLocalImageLoader.ts`

Manages file input handling and image normalization.

```typescript
const { 
  handleFileChange,       // (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  acceptedImageTypes      // "image/*"
} = useLocalImageLoader();
```

**Key Functions:**
- `handleFileChange(e)` — Process file input change event
- Uses `loadImageAsDataUrl()`, `normalizeImageForDisplay()`, `getImageDimensions()`

## Styled Components

Located in `styled.ts`, shared across ImageLoader and ZooniverseImageLoader:

| Component | Purpose | Key Features |
|-----------|---------|--------------|
| `Container` | Wrapper | Inline-block layout |
| `Button` | Upload trigger | Secondary bg, primary border, hover inversion, press effect |
| `HiddenInput` | File input | `display: none`, accepts image/* |

## Usage

### Basic Implementation

```tsx
import { ImageLoader } from '@/components/ImageLoader';

function App() {
  return (
    <div>
      <ImageLoader />
      {/* ImageCanvas renders loaded image */}
    </div>
  );
}
```

### Combined with ZooniverseImageLoader

```tsx
import { ImageLoader } from '@/components/ImageLoader';
import { ZooniverseImageLoader } from '@/components/ImageLoader';

function App() {
  return (
    <div>
      <ZooniverseImageLoader />   {/* Load from Zooniverse */}
      <ImageLoader />             {/* Load from local device */}
      {/* ImageCanvas displays whichever image is active */}
    </div>
  );
}
```

## Interactions

### User Flow
1. User clicks "Load Image" button
2. Native file picker opens (filters to images)
3. User selects file
4. Image processes automatically:
   - Converted to data URL
   - EXIF rotation normalized
   - Dimensions extracted
5. Image stored in classification store
6. ImageCanvas displays image immediately

### Image Normalization

EXIF metadata can cause misalignment between:
- Image displayed on screen (with EXIF rotation applied)
- Image processed by ML models (without EXIF rotation)

`normalizeImageForDisplay()` applies rotation to canvas, output has no EXIF metadata, ensuring coordinate alignment.

## Error Handling

Failed file loads are caught and logged to console (non-fatal). Component remains interactive for retry.

```typescript
try {
  // Image processing
} catch (err) {
  console.error('Failed to load local image:', err);
}
```

## Store Integration

### Classification Store

Component writes the following via `setSubject()`:

```typescript
setSubject(
  subjectId: `local-${filename}`,    // Unique local subject ID
  imageUrl: string,                  // Normalized image data URL
  dimensions: {
    width: number,
    height: number
  }
);
```

## Performance Characteristics

### Memory Usage
- Images stored as data URLs in classification store
- Size depends on image resolution
- Typical image: 100-500KB data URL in memory

### Processing Time
- Image data URL conversion: ~50-200ms
- Image normalization: ~100-300ms
- Dimension extraction: ~10-50ms
- Total: ~160-550ms depending on image size

### Browser Apis
- FileReader (async file reading)
- Canvas (image normalization, dimension reading)
- Blob/DataURL conversion

## Debugging

### Console Logging
- File loading errors logged with full error
- Check browser console for error messages

### Store State
- Inspect `useClassificationStore.getState()` in console
- Verify `subject`, `imageUrl`, `imageDimensions` populated
- Subject ID should have `local-` prefix

### File Input
- Use DevTools to inspect hidden input element
- Verify `accept="image/*"` attribute present
- Check input ref binding

## Testing Checklist

### Rendering
- [ ] Component renders button with text "Load Image"
- [ ] Button is clickable
- [ ] Hidden file input present (not visible)

### File Selection
- [ ] Click button opens native file picker
- [ ] File picker filters to images only
- [ ] File selection accepted

### Image Processing
- [ ] Selected image converts to data URL
- [ ] Image normalization succeeds (no console errors)
- [ ] Dimensions extracted correctly
- [ ] Subject ID has `local-` prefix format

### Store Integration
- [ ] Classification store receives subject data
- [ ] Image URL stored correctly
- [ ] Dimensions match actual image
- [ ] ImageCanvas renders loaded image immediately

### Error Handling
- [ ] Missing/corrupt files handled gracefully
- [ ] Error logged to console (non-fatal)
- [ ] Component remains interactive for retry

### Image Types
- [ ] JPEG files load successfully
- [ ] PNG files load successfully
- [ ] WebP files load successfully (if supported)
- [ ] Non-image files rejected by file picker

## Related Components

- **ZooniverseImageLoader.tsx** — Fetches subjects from Zooniverse platform (contrast)
- **ImageCanvas.tsx** — Displays loaded image with annotation tools
- **classificationStore.ts** — Manages image state and subject data
- **imageService.ts** — Image loading and normalization utilities

## Future Enhancements

1. **File Validation**
   - File size limits (warn if >10MB)
   - Resolution limits (warn if >8K)
   - File format validation

2. **User Feedback**
   - Show loading spinner during processing
   - Display file name after load
   - Show image thumbnail preview
   - Display image dimensions to user

3. **Batch Upload**
   - Multiple file selection (multiple attribute)
   - Queue management for batch processing
   - Progress indicator for batch

4. **Image History**
   - Remember recently loaded files
   - Quick-load previous images
   - Clear history option

5. **Drag & Drop**
   - Allow dragging image onto component
   - Visual drop zone indicator
   - Native file picker as fallback

## Notes

- Component uses native browser file picker (dark theme not customizable)
- Images stored as data URLs (keep resolution reasonable)
- EXIF normalization critical for ML coordinate alignment
- Local subjects marked with `local-` prefix to distinguish from Zooniverse
- No Caesar ML processing for local images (ML predictions not available)
