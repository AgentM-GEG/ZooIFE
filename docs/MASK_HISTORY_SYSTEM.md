# Per-Annotation Mask History System

## Overview

The ZooIFE application implements a **per-annotation mask history system** that allows users to draw, edit, and undo/redo brush strokes independently for each annotation (rectangle). It also tracks SAM prompt points per history state so point overlays stay in sync when navigating history. This document describes how the system works and the key design decisions.

---

## Architecture

### State Structure

Masks are stored in the `classificationStore` with the following structure:

```typescript
interface HistoryEntry {
  type: 'sam' | 'modifier_brush';
  imageData: ImageData;  // Raw atomic mask (SAM prediction or brush stroke)
}

interface SamPoint {
  x: number;
  y: number;
  label: 0 | 1;
}

interface SamPointHistory {
  allSamPoints: SamPoint[];
  activePointsPerHistoryIndex: number[][];
}

interface PerAnnotationMaskState {
  maskUrl: string | null;          // Current mask display URL (data URI)
  history: HistoryEntry[];         // Array of historical mask entries
  historyIndex: number;            // Index into history array (-1 = no mask)
  samPointHistory?: SamPointHistory;
}

// Store maps annotation IDs to their mask state
perAnnotationMasks: Record<string, PerAnnotationMaskState>
activeAnnotationId: string | null  // Currently selected annotation for editing
```

**Special ID**: The string `"-1"` is used for unmarked objects (when no annotation rectangle is selected).

### History Entry Types

Each entry in the history array has a `type` field that indicates its origin:

| Type | Created By | Description |
|---|---|---|
| `'sam'` | SAM model | AI segmentation prediction (includes raw prediction data) |
| `'modifier_brush'` | User | Brush stroke refinement (adds or removes pixels) |

**Compositing Rule**: When calculating the composite mask for display or export, the system composites **ALL entries** (both SAM predictions and modifier brush strokes) up to the current `historyIndex` in order. This ensures:
- **Multiple SAM predictions are preserved**: When you place multiple SAM points in sequence, all of their masks are composited together
- **User refinements are preserved**: Brush strokes before, after, or between SAM predictions are all included
- **Undo/redo works correctly**: Moving `historyIndex` backward/forward shows the composite of all entries up to that point

The composite is calculated fresh at display time using `getSimpleComposite()` (bitwise OR union), never stored pre-composited in history.

### History Index States

The `historyIndex` represents which state the user is currently viewing:

| historyIndex | State | Meaning |
|---|---|---|
| `-1` | Empty (initial) | No mask exists, canvas is blank |
| `0` | First stroke | User has drawn once |
| `1` | Second stroke | User has drawn twice |
| `n` | nth state | User has navigated to the nth saved state |
| `history.length - 1` | Last state | At the end of history (redo is disabled) |

**Example evolution:**

```
Start: historyIndex = -1, history = []
  ↓ User draws stroke 1
historyIndex = 0, history = [ImageData1]
  ↓ User draws stroke 2
historyIndex = 1, history = [ImageData1, ImageData2]
  ↓ User clicks undo
historyIndex = 0, history = [ImageData1, ImageData2]  (history unchanged)
  ↓ User clicks undo again
historyIndex = -1, history = [ImageData1, ImageData2]  (canvas cleared, no index error)
  ↓ User clicks redo
historyIndex = 0, history = [ImageData1, ImageData2]
```

---

## Utilities

### dataUriToImageData(dataUri: string): Promise<ImageData>

**Location**: `src/App.tsx`

Converts a PNG data URI (as returned by SAM server) to an ImageData object for storage in history.

```typescript
function dataUriToImageData(dataUri: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resolve(imageData);
    };
    img.onerror = () => reject(new Error('Failed to load image from data URI'));
    img.src = dataUri;
  });
}
```

**Why async**: Loading an image from a data URI requires the Image element to load it, which happens asynchronously.

**Error handling**: If conversion fails, the mask is still displayed but error is logged.

---

## Key Operations

### 1. Creating History Entries (pushPerAnnotationMaskHistory)

History entries are created in two scenarios:

#### A. User Brush Stroke (pointerUp event)

**When**: User completes a brush stroke

```typescript
pushPerAnnotationMaskHistory: (annotationId, entry, samPoints?) => {
  // If annotation doesn't exist, initialize it
  const annotationState = state.perAnnotationMasks[annotationId] || {
    maskUrl: null,
    history: [],
    historyIndex: -1,  // Start at -1 (empty state)
  };

  // Truncate history at current index (discard "redo" branch)
  const truncated = annotationState.history.slice(0, annotationState.historyIndex + 1);
  
  // Add new stroke to end
  const newHistoryIndex = truncated.length;  // Will be equal to old length
  
  // Store new state
  set({
    perAnnotationMasks: {
      ...state.perAnnotationMasks,
      [annotationId]: {
        ...annotationState,
        history: [...truncated, entry],    // Append new entry
        historyIndex: newHistoryIndex,      // Increment index to point to it
      },
    },
  });
}
```

**Key point**: Only `pointerUp` (end of stroke) pushes to history, not `pointerDown` or `pointerMove`.

#### B. SAM-Generated Mask (segmentWithPoints)

**When**: User clicks points and SAM generates a segmentation mask

In `App.tsx`:
```typescript
async function handlePointClick(x, y, label) {
  const result = await segmentWithPoints(imageUrl, points, '', options);
  
  if (result.image?.url) {
    // Convert SAM mask data URI to ImageData
    const maskUrl = result.image.url;
    const imageData = await dataUriToImageData(maskUrl);
    
    // Add SAM mask as single history entry + active SAM points
    const samEntry = { type: 'sam', imageData };
    pushPerAnnotationMaskHistory(currentAnnotationId, samEntry, points);
    
    // Display the mask
    setPerAnnotationMask(currentAnnotationId, maskUrl);
  }
}
```

**Key point**: SAM-generated masks are treated as atomic history entries—one mask per set of points, even though SAM itself runs multiple internal iterations.

### 2. Undoing (undoPerAnnotationMask)

**When**: User clicks the Undo button

```typescript
undoPerAnnotationMask: (annotationId) => {
  const state = get();
  const annotationState = state.perAnnotationMasks[annotationId];

  if (!annotationState || annotationState.historyIndex < 0) {
    return null;
  }

  const newIndex = annotationState.historyIndex - 1;

  // Recompute display mask from history[0..newIndex] via bitwise OR union
  let newMaskUrl: string | null = null;
  if (newIndex >= 0) {
    const composite = getSimpleComposite(annotationState.history, newIndex);
    if (composite) {
      // serialize to png data url for display
      // (omitted here for brevity)
    }
  }

  set((s) => ({
    perAnnotationMasks: {
      ...s.perAnnotationMasks,
      [annotationId]: {
        ...s.perAnnotationMasks[annotationId],
        historyIndex: newIndex,
        maskUrl: newMaskUrl,
      },
    },
  }));

  // Sync visible point annotations to the new history index
  if (annotationState.samPointHistory && newIndex >= 0) {
    get().syncAnnotationsToHistoryIndex(annotationId);
  }

  return newIndex >= 0 ? annotationState.history[newIndex] : null;
}
```

**Important**: Never accesses `history[-1]` — instead returns `null`.

### 3. Redoing (redoPerAnnotationMask)

**When**: User clicks the Redo button

```typescript
redoPerAnnotationMask: (annotationId) => {
  const state = get();
  const annotationState = state.perAnnotationMasks[annotationId];

  if (!annotationState || annotationState.historyIndex >= annotationState.history.length - 1) {
    return null;
  }

  const newIndex = annotationState.historyIndex + 1;

  let newMaskUrl: string | null = null;
  if (newIndex < annotationState.history.length) {
    const composite = getSimpleComposite(annotationState.history, newIndex);
    if (composite) {
      // serialize to png data url for display
      // (omitted here for brevity)
    }
  }

  set((s) => ({
    perAnnotationMasks: {
      ...s.perAnnotationMasks,
      [annotationId]: {
        ...s.perAnnotationMasks[annotationId],
        historyIndex: newIndex,
        maskUrl: newMaskUrl,
      },
    },
  }));

  if (annotationState.samPointHistory) {
    get().syncAnnotationsToHistoryIndex(annotationId);
  }

  return annotationState.history[newIndex];
}
```

### 4. SAM Point History and Overlay Sync

SAM points are tracked independently from mask pixels via `samPointHistory`:

- `allSamPoints` is an accumulative pool of unique points.
- `activePointsPerHistoryIndex[i]` stores which point indices are active at history index `i`.
- `clearSamPoints(annotationId)` clears currently drawn point annotations only (history is preserved).
- `syncAnnotationsToHistoryIndex(annotationId)` rebuilds point overlays from `samPointHistory` after undo/redo.

This makes clear/undo/redo behavior consistent:

- Clearing points does not destroy recoverable history.
- Undo/redo restores the exact point set that was active at that history step.
- Branching from an older history point is supported because point pool indices remain stable.

---

## Display: Composite Masks

When the user performs undo/redo, the canvas should show a **composite** of all visible annotation masks at the current history stage.

### Composite Mask Display Process

1. **User clicks Undo/Redo**
   ```
   undoPerAnnotationMask(annotationId)
   redoPerAnnotationMask(annotationId)
   ```

2. **After state update** (via setTimeout to allow state change to complete):
   ```javascript
   setTimeout(() => displayCompositeOfVisibleMasks(), 0);
   ```

3. **displayCompositeOfVisibleMasks collects visible masks:**
   ```typescript
   const visibleMasks: ImageData[] = [];
   
   for (const [annotationId, maskState] of Object.entries(state.perAnnotationMasks)) {
     // Include masks that have been drawn AND are at a valid history point
     if (maskState.history.length > 0 && maskState.historyIndex >= 0) {
       const maskImageData = maskState.history[maskState.historyIndex];
       visibleMasks.push(maskImageData);
     }
   }
   ```

4. **Composite all visible masks:**
   ```typescript
   import { compositeImageDataMasks } from '@/utils/image/maskCompositing';
   
   const composite = compositeImageDataMasks(visibleMasks);
   // Returns overlaid combination of all masks
   ```

5. **Display composite:**
   ```typescript
   setPerAnnotationMask(annotationId, compositeUrl);
   // Updates maskUrl for display
   ```

### Canvas Clearing at historyIndex = -1

When all annotations have been undone to `historyIndex = -1`:

```typescript
if (visibleMasks.length === 0) {
  // No masks at current history state — clear display
  setPerAnnotationMask(annotationId, null);
  return;
}
```

The `null` URL triggers the `BrushEditableImage` effect to clear the canvas:

```typescript
useEffect(() => {
  if (!externalMask) {
    // Clear canvas when no mask to display
    ctx.clearRect(0, 0, canvasImage.width, canvasImage.height);
    imageRef.current?.getLayer()?.batchDraw();
    return;
  }
  // ... update canvas with new mask ...
}, [externalMask]);
```

---

## Critical Design Decisions

### 1. historyIndex Starts at -1, Not 0

**Why**: Allows clean semantics for "no mask yet" state. Users can undo back to a completely blank canvas.

- `historyIndex = -1`: No mask exists
- `historyIndex = 0`: First stroke is visible
- Undo from index 0 → index -1 clears canvas
- Redo from index -1 → index 0 shows first stroke again

### 2. Display Updates Don't Push to History

When `externalMask` prop changes (from undo/redo or composite display), the `BrushEditableImage` effect updates the canvas **without calling `pushPerAnnotationMaskHistory`**.

```typescript
useEffect(() => {
  // This effect updates the DISPLAY ONLY
  // Does NOT push to history
  if (!externalMask) {
    ctx.clearRect(0, 0, canvasImage.width, canvasImage.height);
  } else {
    ctx.putImageData(externalMask, 0, 0);
  }
}, [externalMask]);  // Triggered by undo/redo or other display updates
```

**Why**: Prevents undo/redo callbacks from creating spurious history entries. Only user drawing creates history.

### 3. One Snapshot Per Stroke

Only the `pointerUp` event (end of stroke) pushes to history:
- `pointerDown`: Start drawing, no push
- `pointerMove`: Continue drawing, no push
- `pointerUp`: End drawing, **push to history**

**Why**: Users expect one undo to remove one complete stroke, not multiple micro-steps.

### 4. Composite Display Over Single Annotation

When editing annotation A, the canvas shows a composite of all annotations at their current history states, not just annotation A.

**Why**: Users can see how their edits to A interact with masks from B, C, etc.

---

## Brush Cursor Scoping

The brush tool's visual cursor (circle) is scoped to the canvas area to prevent accidental drawing when interacting with UI controls.

### Canvas Enter/Leave Detection

```typescript
useEffect(() => {
  const handleMouseLeave = () => {
    // Force brush to stop if cursor leaves canvas
    brushProps.predModBrushRef?.current?.pointerUp();
  };

  canvasWrapperRef?.current?.addEventListener('mouseleave', handleMouseLeave);
  return () => {
    canvasWrapperRef?.current?.removeEventListener('mouseleave', handleMouseLeave);
  };
}, []);
```

**Why**: Prevents the brush from continuing to draw if the user moves to the toolbar buttons while holding the mouse button.

---

## Example: Undo/Redo Flow

### Example 1: Mixed Brush + SAM

```
Canvas shows:
  - Annotation A: nothing
  - Display: blank

User clicks point to trigger SAM:
  1. handlePointClick() calls segmentWithPoints()
  2. SAM generates mask (internal iterations, but counts as ONE history entry)
  3. dataUriToImageData() converts PNG data URI to ImageData
  4. pushPerAnnotationMaskHistory("A", samEntry, points)
     - A.historyIndex: -1 → 0
     - A.history = [SAM_ImageData]
  5. displayCompositeOfVisibleMasks()
     - A: historyIndex = 0 (visible, SAM mask)
     - Display: SAM mask shown (green/cyan overlay)

User draws RED brush stroke on A:
  1. pointerUp() pushes to history
  2. pushPerAnnotationMaskHistory("A", redBrushEntry)
     - A.historyIndex: 0 → 1
     - A.history = [SAM_ImageData, RED_ImageData]
  3. displayCompositeOfVisibleMasks()
     - Display: SAM mask + RED brush overlay (composite)

User clicks UNDO:
  1. undoPerAnnotationMask("A")
     - A.historyIndex: 1 → 0
  2. displayCompositeOfVisibleMasks()
     - Display: SAM mask only (RED brush removed)

User clicks UNDO again:
  1. undoPerAnnotationMask("A")
     - A.historyIndex: 0 → -1
  2. displayCompositeOfVisibleMasks()
     - A: historyIndex = -1 (skipped, no mask)
     - Display: blank canvas

User clicks REDO:
  1. redoPerAnnotationMask("A")
     - A.historyIndex: -1 → 0
  2. displayCompositeOfVisibleMasks()
     - Display: SAM mask restored
```

### Example 2: Multiple Annotations with SAM

```
Canvas shows:
  - Annotation A: SAM mask (blue)
  - Annotation B: nothing
  - Display: Blue mask (A only)

User draws GREEN brush stroke on B:
  - B.history = [GREEN_ImageData]
  - B.historyIndex = 0
  - Display: BLUE (A) + GREEN (B) composite

User adds more points to A, SAM refines:
  - A.history = [OLD_SAM, NEW_SAM]
  - A.historyIndex = 1
  - Display: NEW_SAM (A) + GREEN (B) composite

User clicks UNDO:
  - A.historyIndex: 1 → 0
  - A now shows OLD_SAM (first SAM result)
  - Display: OLD_SAM (A) + GREEN (B) composite
```

### Example 3: Multiple SAM Predictions (Bug Fix)

**This scenario demonstrates the fix for the undo/redo bug where earlier SAM masks were being lost.**

```
User places SAM point 1 on rect A:
  - A.history = [SAM1]
  - A.historyIndex = 0
  - Display shows: SAM1 ✓

User places SAM point 2 on rect A:
  - A.history = [SAM1, SAM2]
  - A.historyIndex = 1
  - getSimpleComposite(history, 1) composites SAM1 + SAM2 via bitwise OR
  - Display shows: SAM1 + SAM2 (composite) ✓

User places SAM point 3 on rect A:
  - A.history = [SAM1, SAM2, SAM3]
  - A.historyIndex = 2
  - getSimpleComposite(history, 2) composites SAM1 + SAM2 + SAM3 via bitwise OR
  - Display shows: SAM1 + SAM2 + SAM3 (composite) ✓

User clicks UNDO:
  - A.historyIndex: 2 → 1
  - getSimpleComposite(history, 1) composites SAM1 + SAM2 via bitwise OR
  - Display shows: SAM1 + SAM2 (both retained!) ✓
  - SAM3 removed as expected

User clicks UNDO again:
  - A.historyIndex: 1 → 0
  - getSimpleComposite(history, 0) returns SAM1
  - Display shows: SAM1 ✓
  - SAM2 removed as expected
```

**Key insight**: The composite is calculated from ALL entries up to `historyIndex`, ensuring all SAM predictions remain visible during undo/redo operations.

---

## Testing Checklist

When making changes to the mask history system, verify:

- [ ] Undo disabled when `historyIndex = -1` (at beginning)
- [ ] Redo disabled when `historyIndex = history.length - 1` (at end)
- [ ] Cannot undo/redo into invalid array indices (no `-1` access)
- [ ] Canvas clears completely at `historyIndex = -1`
- [ ] Canvas updates correctly when `historyIndex >= 0`
- [ ] Undo/redo don't create new history entries
- [ ] Multiple annotation masks composite correctly
- [ ] Brush cursor disappears when leaving canvas area
- [ ] Brush drawing stops when cursor leaves canvas area
- [ ] **SAM masks added to history as single entries**
- [ ] **Can undo SAM-generated masks like brush strokes**
- [ ] **Undo/redo works correctly when mixing SAM masks + brush strokes**
- [ ] **SAM mask data URI successfully converts to ImageData**
- [ ] **Composite displays correctly when combining SAM masks and brush strokes**
- [ ] **Undo/redo keeps SAM point overlays in sync via `syncAnnotationsToHistoryIndex`**
- [ ] **Clearing SAM points is reversible by undo/redo (history preserved)**
