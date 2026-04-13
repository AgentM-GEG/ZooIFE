# BrushEditableImage Component

## Overview

BrushEditableImage is a Konva-based image canvas component that enables interactive mask drawing and editing with brush strokes. It provides add/subtract (paint/erase) modes with full undo/redo support, multi-annotation support, and integration with the classification store for mask history management.

This component renders as a persistent HTML5 canvas that can be drawn on via pointer events, with all painting operations automatically tracked in the store's mask history.

**File Structure:**
- `BrushEditableImage.tsx` — Main component (157 lines)
- `types.ts` — TypeScript interfaces and types
- `constants.ts` — Default props and drawing configuration
- `brushUtils.ts` — Utility functions for color parsing and image manipulation
- `useMaskHistory.ts` — Custom hook for unified mask history management

## Architecture

### Component Hierarchy

```
BrushEditableImage (forwardRef component)
└── KonvaImage (renders to Konva canvas)
    └── HTMLCanvasElement (persistent drawing surface)
        ├── Mask data (ImageData)
        └── Drawing context (CanvasRenderingContext2D)
```

### Critical Distinction: Display Updates vs. History Creation

This component carefully separates two different type of operations:

**1. Display Updates (externalMask effect)**
- Triggered when `externalMask` prop changes (undo/redo, composite display, annotation switching)
- Updates canvas rendering via `ctx.putImageData()`
- **Does NOT create history entries**
- Canvas clears completely when externalMask becomes null (historyIndex = -1)

**2. History Creation (user drawing)**
- Triggered only by user interaction: `pointerUp` event
- Pushes ImageData snapshot to store history via `handlePushMaskHistory()`
- One snapshot per complete stroke (starts with `pointerDown`, ends with `pointerUp`)
- Does NOT trigger on re-renders or display updates

This separation is critical to prevent undo/redo operations from creating spurious history entries.

### Data Flow

1. **Initialization**
   - BrushEditableImage receives image prop (HTMLImageElement)
   - Canvas is sized to match image dimensions
   - Image is NOT drawn to canvas (canvas is transparent)

2. **Drawing Operations** (Create History Entries)
   - User moves pointer on canvas with button pressed
   - `pointerDown` → starts new stroke
   - `pointerMove` → draws line segment, normalizes alpha values
   - `pointerUp` → **pushes final ImageData snapshot to history**
   - Only `pointerUp` creates history entries (one per complete stroke)

3. **External Mask Updates** (Display Only, No History)
   - `externalMask` prop receives new ImageData or HTMLImageElement
   - Effect triggers and resizes canvas to match
   - Merges with `addColor` and renders to canvas via `putImageData()`
   - **Important**: Does NOT push to history
   - When `externalMask` is null: clears canvas completely
   - Used for: undo/redo display updates, annotation switching, composite mask display

4. **History Management**
   - User drawing (`pointerUp`) pushes ImageData snapshots to store
   - `useMaskHistory` hook routes to per-annotation history
   - Undo/redo change `historyIndex`, triggering `externalMask` update
   - Canvas re-renders via effect without creating new history entries

## Types

### BrushMode

```typescript
type BrushMode = "add" | "subtract";
```

Determines how brush strokes are applied:
- **"add"**: Paints with `addColor` using `lighter` (additive) compositing to prevent opacity stacking and ensure consistent opacity
- **"subtract"**: Erases using `destination-out` compositing

### BrushEditableImageHandle

Imperative API exposed via ref:

```typescript
interface BrushEditableImageHandle {
  pointerDown: (e: KonvaEventObject<PointerEvent>) => void;  // Begin stroke
  pointerMove: (e: KonvaEventObject<PointerEvent>) => void;  // Continue stroke
  pointerUp: () => void;                                     // End stroke
  undo: () => void;                                          // Undo last operation
  redo: () => void;                                          // Redo last operation
}
```

### BrushEditableImageProps

```typescript
interface BrushEditableImageProps extends Omit<Konva.ImageConfig, "image"> {
  image?: HTMLImageElement | null;              // Source image (sized only)
  externalMask?: ImageData | HTMLImageElement | null;  // External mask to apply
  enableBrush?: boolean;                        // Enable brush mode (default: false)
  brushRadius?: number;                         // Brush radius in pixels (default: 20)
  brushMode?: BrushMode;                        // "add" or "subtract" (default: "add")
  addColor?: string;                            // RGBA color for painting (default: "rgba(0,255,200,0.45)")
  contentScale?: number;                        // Scale factor for brush size (default: 1)
}
```

#### externalMask Behavior

The `externalMask` prop is used to display masks from the store without creating additional history entries. This is essential for undo/redo operations.

- When `externalMask` is provided: Canvas is updated to display the mask via `putImageData()`
- When `externalMask` is null: Canvas is completely cleared via `clearRect()`
- **Important**: Changing `externalMask` does NOT trigger `pushPerAnnotationMaskHistory()`
- Only user drawing (pointerUp event) creates history entries

**Common use cases:**
1. Undo/redo operations display previous state via externalMask
2. Composite mask display shows combination of all annotations' current masks
3. Switching active annotation shows its current mask state

## Constants

Located in `constants.ts`:

### BRUSH_DEFAULTS
- `BRUSH_MODE`: "add"
- `BRUSH_RADIUS`: 20 pixels
- `ENABLE_BRUSH`: false
- `ADD_COLOR`: "rgba(0,255,200,0.45)" (cyan with 45% alpha)

### DRAWING_CONFIG
- `STROKE_ALPHA`: 0.45 (alpha ratio for drawn pixels)
- `LINE_WIDTH_MULTIPLIER`: 4 (lineWidth = 4 * brushRadius / contentScale)
- `ERASE_COMPOSITE`: "destination-out"
- `ADD_COMPOSITE`: "lighter" (additive blending to prevent opacity stacking across overlapping strokes)
- `LINE_CAP`: "round"
- `LINE_JOIN`: "round"

## Utility Functions

### parseRGBA(rgba: string)
Parse RGBA color string to [R, G, B, A] tuple.
```typescript
parseRGBA("rgba(0,255,200,0.45)") // [0, 255, 200, 114]
```

### sourceToImageData(source)
Convert ImageData or HTMLImageElement to standardized ImageData format.

### applyColorToMask(target, source, color)
Overlay RGBA color onto mask while preserving alpha channel.

### normalizeAlpha(imageData, alphaRatio)
Set alpha channel to consistent value for all non-transparent pixels.

## Custom Hook: useMaskHistory

Located in `useMaskHistory.ts`.

The `useMaskHistory` hook provides unified interface for mask history operations, automatically routing to global or per-annotation store methods based on `activeAnnotationId`.

### Exported Functions

```typescript
const {
  handlePushMaskHistory,    // (imgData: ImageData) => void
  handleUndoMask,           // () => ImageData | null
  handleRedoMask,           // () => ImageData | null
  getActiveMaskState,       // () => MaskState
  activeAnnotationId,       // string | null
  perAnnotationMasks,       // Record<string, MaskState>
} = useMaskHistory();
```

## Usage

### Basic Brush Editing

```tsx
import { useRef } from 'react';
import { BrushEditableImage } from '@/components/ImageMask';
import type { BrushEditableImageHandle } from '@/components/ImageMask/types';

function Editor() {
  const brushRef = useRef<BrushEditableImageHandle>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const handlePointerDown = (e) => {
    brushRef.current?.pointerDown(e);
  };

  const handlePointerMove = (e) => {
    brushRef.current?.pointerMove(e);
  };

  const handlePointerUp = () => {
    brushRef.current?.pointerUp();
  };

  const handleUndo = () => {
    brushRef.current?.undo();
  };

  const handleRedo = () => {
    brushRef.current?.redo();
  };

  return (
    <div>
      <BrushEditableImage
        ref={brushRef}
        image={imageRef.current}
        enableBrush={true}
        brushRadius={20}
        brushMode="add"
        addColor="rgba(0,255,200,0.45)"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      <button onClick={handleUndo}>Undo</button>
      <button onClick={handleRedo}>Redo</button>
    </div>
  );
}
```

### Multi-Annotation Support

When `activeAnnotationId` is set in the store, all mask operations automatically store per-annotation history:

```tsx
// Store handles routing internally
const { setActiveAnnotationId } = useClassificationStore();

const switchAnnotation = (id: string) => {
  setActiveAnnotationId(id);
  // Subsequent brush operations store in perAnnotationMasks[id]
};
```

### Applying External Masks

```tsx
const handleApplyMask = (maskData: ImageData) => {
  setExternalMask(maskData);
  // Component automatically:
  // 1. Resizes canvas to match mask dimensions
  // 2. Applies addColor overlay
  // 3. Pushes merged result to history
};
```

## Interactions

### Pointer Events
- **pointerDown** (left button): Start new stroke, create history snapshot
- **pointerMove**: Draw line segment, normalize alpha
- **pointerUp**: Finalize stroke, push final state to history

### Drawing Modes
- **Add Mode** (`brushMode="add"`)
  - Uses `source-over` compositing
  - Paints with `addColor` (typically cyan with transparency)
  - Creates additive mask overlay

- **Subtract Mode** (`brushMode="subtract"`)
  - Uses `destination-out` compositing
  - Erases pixels from mask
  - Removes areas regardless of current color

### History Operations
- **Undo**: Restore previous ImageData snapshot, redraw to canvas
- **Redo**: Restore next ImageData snapshot, redraw to canvas
- All operations are per-annotation when `activeAnnotationId` is set

## Store Integration

### Store Dependencies

The component reads from `classificationStore`:
- `pushMaskHistory(imgData)` — Global mask history
- `undoMask()` — Global undo
- `redoMask()` — Global redo
- `maskHistory` — Global history array
- `maskHistoryIndex` — Current global history index
- `activeAnnotationId` — Current annotation context
- `perAnnotationMasks` — Per-annotation mask states
- `pushPerAnnotationMaskHistory(id, imgData)` — Per-annotation history
- `undoPerAnnotationMask(id)` — Per-annotation undo
- `redoPerAnnotationMask(id)` — Per-annotation redo

### Store Updates

The component automatically pushes ImageData to store on:
- Stroke initialization (after `ensureMaskExists`)
- Stroke completion (after `pointerUp`)
- External mask application
- Undo/redo operations (handled by store)

## Performance Characteristics

### Canvas Rendering
- **Persistent Canvas**: Single HTMLCanvasElement reused across all renders (no recreation)
- **Batch Drawing**: Konva's `batchDraw()` combines multiple canvas operations
- **Relative Coordinates**: Uses `getRelativePointerPosition()` for image-space calculations

### Memory Usage
- **History Storage**: Each undo/redo preserves full ImageData (width × height × 4 bytes)
- **Per-Annotation**: Separate history for each annotation with `activeAnnotationId`
- **No DOM Cloning**: All operations on persistent canvas, no SVG/DOM elements

### Optimization Tips
1. Limit history depth in store if memory becomes issue
2. Batch multiple operations before pushing if possible
3. Use `contentScale` to adjust brush size without canvas resizing
4. Clear history when switching images to reset state

## Debugging

### Console Logging
- Remove debug console.logs from undo/redo if no longer needed
- Add with `console.log(mask history state)` to diagnose routing issues

### Canvas Inspection
- Access canvas via `canvasImage` reference
- Use browser DevTools canvas debugger to inspect pixel data
- Check `ctx.getImageData()` to verify drawing state

### Store State
- Inspect `useClassificationStore.getState()` in console
- Check `maskHistory` length and `maskHistoryIndex` position
- Verify `activeAnnotationId` routing for per-annotation operations

## Testing Checklist

### Rendering
- [ ] Component renders without errors
- [ ] Canvas gets created (query by ref)
- [ ] Canvas has correct dimensions matching image

### Basic Drawing
- [ ] Pointer down initializes drawing state
- [ ] Pointer move draws continuous line
- [ ] Pointer up finalizes stroke
- [ ] Visual mask appears on canvas

### Brush Mode
- [ ] Add mode paints with addColor
- [ ] Subtract mode erases pixels
- [ ] Color overlay applies correctly in add mode

### History
- [ ] Undo restores previous canvas state
- [ ] Redo restores next canvas state
- [ ] Multiple undo/redo cycles work correctly
- [ ] History bounds respected (nothing before first, after last)

### External Masks
- [ ] ImageData masks load correctly
- [ ] HTMLImageElement masks convert correctly
- [ ] Canvas resizes on external mask
- [ ] addColor applies to external mask
- [ ] Merged result pushed to history

### Multi-Annotation
- [ ] activeAnnotationId switches history context
- [ ] Switching annotations switches mask state
- [ ] Per-annotation histories independent
- [ ] Global history used when no activeAnnotationId

## Related Components

- **ImageCanvas.tsx** — Higher-level canvas container managing brush state
- **classificationStore.ts** — Zustand store managing mask history and annotations
- **AnnotationRenderer.tsx** — Renders mask overlay on canvas

## Future Enhancements

1. **Brush Types**
   - Add support for different brush shapes (square, hex)
   - Implement soft-edge brushes with gradient falloff

2. **Performance**
   - Implement dirty rectangle optimization for redraw regions
   - Add canvas compression/downsampling for large masks

3. **Advanced Features**
   - Brush pressure sensitivity for stylus input
   - Stroke smoothing/interpolation
   - Mask merging/composition operations

4. **Accessibility**
   - Keyboard shortcuts for undo/redo
   - Voice commands for brush operations
   - Touch input optimization for mobile
