# ZooniverseImageLoader Component

## Overview

ZooniverseImageLoader is a React component that manages subject loading from the Zooniverse platform. It fetches subjects from a configured workflow, processes and normalizes images, and automatically fetches Caesar ML model predictions for each subject.

The component integrates with Zooniverse OAuth authentication, the classification store (for images), and the Caesar annotation store (for ML predictions). It handles image normalization (fixing EXIF orientation mismatches) to ensure display and ML/SAM2 see identical pixel coordinates.

Both the image and ML predictions are loaded in parallel, ready for simultaneous display on the canvas.

**File Structure:**
- `ZooniverseImageLoader.tsx` — Main component (20 lines)
- `types.ts` — TypeScript type definitions
- `styled.ts` — Styled components (Container, Button)
- `useSubjectLoader.ts` — Custom hook for subject loading logic
- `useCaesarReductions.ts` — Custom hook for Caesar ML reduction processing

## Architecture

### Component Hierarchy

```
ZooniverseImageLoader (main component)
├── Container (styled wrapper)
└── Button (styled button)
    └── handleLoadNextSubject()
        ├── useSubjectLoader hook
        │   ├── loadNextSubject()
        │   ├── processSubject()
        │   └── Classification Store (image data)
        │
        └── useCaesarReductions hook
            ├── processCaesarReductions(subjectId)
            ├── Caesar API call
            └── Caesar Annotation Store (ML predictions)
```

### Data Flow

1. **Initialization**
   - Component renders "Next subject" button (visible only when authenticated)
   - User clicks button → `handleLoadNextSubject()`

2. **Subject Fetching**
   - First click: `getQueuedSubjects()` fetches batch from Zooniverse API
   - Subjects stored in React state
   - First subject processed immediately

3. **Image Processing**
   - Load JPEG from subject.locations[0]['image/jpeg']
   - Convert to data URL
   - Normalize image (fix EXIF orientation/coordinates)
   - Get dimensions (width, height)
   - Store in classification store

4. **Caesar ML Processing** (Automatic)
   - After image stored, `processCaesarReductions(subjectId)` triggered
   - Fetches ML predictions from Caesar API
   - Converts to CaesarAnnotation format
   - Stores in useCaesarAnnotationStore
   - CaesarAnnotationOverlay renders ML boxes

5. **State Management**
   - Classification store receives: subjectId, imageUrl, imageDimensions
   - Caesar annotation store receives: array of ML annotations
   - Both ready for simultaneous display

6. **Queue Management**
   - Subsequent clicks consume queued subjects
   - When queue exhausted, fetch new batch

## Types

### SubjectLoaderOptions

```typescript
interface SubjectLoaderOptions {
  token: string;          // OAuth access token
  workflowId: string;     // Workflow ID to fetch subjects from
}
```

### ProcessedSubject

```typescript
interface ProcessedSubject extends Subject {
  imageUrl: string;      // Data URL of normalized image
  imageData?: {
    width: number;       // Image width in pixels
    height: number;      // Image height in pixels
  };
}
```

## Styled Components

| Component | Purpose | Key Features |
|-----------|---------|--------------|
| `Container` | Wrapper | Inline-block layout, minimal styling |
| `Button` | Load button | Secondary bg, primary border, hover inversion, press scale effect |

## Custom Hooks

### useSubjectLoader

Located in `useSubjectLoader.ts`

Manages subject queue and image loading workflow.

```typescript
const {
  subjects,           // Current queued subjects or null
  loadNextSubject,    // Async function to load next subject
  queueSize,          // Number of subjects remaining in queue
} = useSubjectLoader(accessToken, onSubjectProcessed);
```

**Parameters:**
- `accessToken` — OAuth token for Zooniverse API calls
- `onSubjectProcessed` — Optional callback when subject is loaded

**Key Functions:**
- `processSubject(subject)` — Load, normalize, and store image
- `loadNextSubject()` — Fetch subjects and process one

### useCaesarReductions

Located in `useCaesarReductions.ts`

Fetches and processes Caesar ML model reductions for subjects. Returns a callback function that takes a subject ID.

```typescript
const processCaesarReductions = useCaesarReductions(
  caesarClient,
  workflowId,
  accessToken
);

// Called automatically when new subject loads
await processCaesarReductions(subjectId);
```

**Integration:** Passed as callback to `useSubjectLoader`, automatically triggered when subject image is loaded and normalized.

## Usage

### Basic Implementation

```tsx
import { ZooniverseImageLoader } from '@/components/ImageLoader';

function App() {
  return (
    <div>
      <ZooniverseImageLoader />
      {/* ImageCanvas and other components render loaded image */}
    </div>
  );
}
```

### Integration Flow

```tsx
// In App component
export function App() {
  return (
    <>
      {/* ZooniverseImageLoader handles subject loading + Caesar ML predictions */}
      <ZooniverseImageLoader />

      {/* ImageCanvas displays the loaded/normalized image */}
      {imageUrl && <ImageCanvas imageUrl={imageUrl} />}

      {/* CaesarAnnotationOverlay displays ML model predictions (boxes) */}
      {caesarAnnotations && <CaesarAnnotationOverlay annotations={caesarAnnotations} />}
    </>
  );
}
```

## Interactions

### User Flow
1. User clicks "Next subject" button
2. Component loads subjects from Zooniverse (first time only)
3. First subject image is fetched and normalized
4. Image dimensions retrieved
5. Data stored in classification store
6. ImageCanvas renders the image
7. Next click loads next queued subject
8. When queue empty, new batch fetched

### Error Handling
- Failed image loads logged to console (non-fatal)
- Continues to next subject on error
- Missing auth token disables button

## Store Integration

### Classification Store Dependencies

The component writes the following to `classificationStore`:

```typescript
setSubject(
  subjectId: string,          // Unique subject ID
  imageUrl: string,           // Normalized image data URL
  dimensions: {              // Image pixel dimensions
    width: number,
    height: number
  }
);
```

### Caesar Annotation Store

When Caesar ML processing is enabled:

```typescript
useCaesarAnnotationStore.getState().setAnnotations(
  annotations: CaesarAnnotation[]  // ML predictions
);
```

## Image Normalization

### Why It's Needed

Raw JPEG files may have EXIF orientation metadata that browsers automatically apply, but ML models (SAM2) do not. This causes coordinate mismatches between:
- Image displayed on screen (rotated by EXIF)
- Image processed by ML (not rotated)

### Solution

`normalizeImageForDisplay()` reads EXIF, applies rotation to canvas, and outputs normalized data URL where:
- Visual display matches ML processing
- All coordinates align
- No hidden orientation issues

## Performance Characteristics

### Memory Usage
- Images stored as data URLs in classification store
- Subjects queue in React state (typically 5-100 subjects)
- Each subject ~200-400 bytes metadata

### API Calls
- First click: `getQueuedSubjects()` (fetches ~10-100 subjects)
- Subsequent clicks: No API calls until queue exhausted
- Image loading: One HTTP request per subject image

### Loading Time
- Subject fetch: ~500ms (network dependent)
- Image data URL conversion: ~100-300ms
- Image normalization: ~50-150ms
- Total first load: ~650-750ms

### Optimization Tips
1. Preload next subject image in background
2. Batch subject fetches to reduce API calls
3. Cache normalized images if possible
4. Use lower resolution previews for faster loading

## Debugging

### Console Logging
- Image load failures logged with full error
- Add debug logs in custom hooks if needed

### Store State
- Check `useClassificationStore.getState()` in browser console
- Verify `subject`, `imageUrl`, `imageDimensions` populated

### Network
- Use DevTools Network tab to monitor:
  - Zooniverse API calls for subjects
  - Image JPEG downloads
  - Image data URL creation time

## Testing Checklist

### Rendering
- [ ] Component renders button when authenticated
- [ ] Button hidden when not authenticated
- [ ] Button text displays "Next subject"

### Subject Loading
- [ ] First click fetches subjects from API
- [ ] Subject image loads successfully
- [ ] Image URL stored in classification store
- [ ] Image dimensions extracted correctly
- [ ] Caesar ML reductions fetched for subject
- [ ] Caesar annotations stored in Caesar annotation store
- [ ] CaesarAnnotationOverlay displays ML boxes

### Image Normalization
- [ ] EXIF orientation applied correctly
- [ ] Normalized image displays same as original
- [ ] ML coordinates match visual coordinates

### Queue Management
- [ ] Subsequent clicks consume queued subjects
- [ ] No new API calls while queue has subjects
- [ ] New batch fetched when queue empty

### Error Handling
- [ ] Failed image loads don't crash component
- [ ] Error logged to console
- [ ] Can retry with next click

### Authentication
- [ ] Button disabled without auth token
- [ ] Works after login
- [ ] Persists auth to API calls

## Related Components

- **ImageCanvas.tsx** — Displays loaded image with brush annotation tools
- **classificationStore.ts** — Manages subject state and image data
- **caesarService.ts** — Fetches ML model reductions
- **imageService.ts** — Image loading and normalization utilities

## Future Enhancements

1. **Progress Tracking**
   - Show subject queue size remaining
   - Display subject number (e.g., "Subject 3 of 15")
   - Progress bar for workflow

2. **Batch Operations**
   - Preload multiple subjects in background
   - Prefetch images for faster loading
   - Parallel image normalization

3. **Image Caching**
   - Cache normalized images in IndexedDB
   - Reduce re-fetching on reload
   - Store multiple subjects locally

4. **Subject Metadata Display**
   - Show subject creation date, source, or metadata
   - Display classification count/status
   - Link to subject on Zooniverse

## Notes

- Component relies on OAuth token from AuthContext
- Uses Zooniverse API (`panoptesService`) for subject fetching
- Image normalization critical for ML coordinate alignment
- Caesar ML reductions automatically fetched and processed on subject load
- ML annotations stored in separate store (useCaesarAnnotationStore) for independent display
- CaesarAnnotationOverlay component renders ML predictions on canvas
