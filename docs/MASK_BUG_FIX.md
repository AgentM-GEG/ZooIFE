# Mask Type and Composite Accumulation Bug Fix

**Date**: April 10, 2026  
**Status**: FIXED  
**Impact**: Critical - Affects mask export quality and type tracking

## The Problem

### Issue 1: Mask Types Getting Mixed
SAM entries were being stored with **composited data** instead of **raw SAM predictions**, causing the backend to lose track of which masks were pure SAM vs. user-refined.

### Issue 2: Composite Masks Accumulating Across Rects
When exporting, each rect should have its own independent composite mask. Instead, composites were accumulating incorrect data because:

1. SAM entry X stored: (pre-SAM modifiers) OR (raw SAM)
2. SAM entry Y stored: (pre-SAM modifiers) OR (raw SAM) OR (previous composite)
3. Export composite: OR(entry X, entry Y, ...) = garbage

This violated the separation of concerns and made composites non-independent per-rect.

## Root Cause Analysis

In `src/App.tsx`, the `createSamHistoryEntry()` function was pre-compositing SAM masks:

```typescript
// OLD (BUGGY) - stored composited, not raw
function createSamHistoryEntry(rawSamImageData, annotationId) {
  let compositedImageData = rawSamImageData;
  if (maskState && maskState.history.length > 0) {
    // Composite with existing modifier strokes
    compositedImageData = compositeImageDataMasks([currentComposite, rawSamImageData]);
  }
  return {
    type: 'sam',
    imageData: compositedImageData,  // ❌ WRONG: stored composited
    samPredictionRaw: rawSamImageData,
  };
}
```

This caused:
- **Storage Layer**: Storing composited masks instead of atomic, pure predictions
- **Display Layer**: Using the same composited imageData for display (incorrect)
- **Export Layer**: ORing together already-composited masks, causing accumulation

## The Solution

### Architecture: Separate Storage, Display, and Export

```
Storage (HistoryEntry):
  - SAM entries contain ONLY raw model output
  - Modifier brush entries contain only stroke data
  - No pre-compositing at storage time

Display (UI Canvas):
  - User sees composite of all masks up to historyIndex
  - Calculated at display render time
  - Preserves user's perception of combined edits

Export (buildPanoptesAnnotations):
  - Bitwise OR all raw masks (SAM + brush) up to historyIndex
  - Clean, independent calculation per rect
  - Each rect's composite is accurate and isolated
```

### Code Changes

**1. Fixed createSamHistoryEntry() - Store ONLY Raw SAM**

```typescript
// NEW (FIXED) - store raw, no pre-compositing
function createSamHistoryEntry(rawSamImageData: ImageData): HistoryEntry {
  // Store ONLY raw SAM prediction - no pre-compositing with modifier strokes
  return {
    type: 'sam',
    imageData: rawSamImageData,  // ✅ Raw SAM only
  };
}
```

**2. Fixed Display Logic - Calculate Composite at Display Time**

```typescript
// When displaying to user after SAM generation:
const samEntry = createSamHistoryEntry(imageData);
pushPerAnnotationMaskHistory(currentAnnotationId, samEntry);

// Calculate composite for display
const maskState = useClassificationStore.getState().perAnnotationMasks[currentAnnotationId];
if (maskState && maskState.history.length > 0) {
  const historyUpToNow = maskState.history.slice(0, maskState.historyIndex + 1);
  const displayComposite = getCompositeForHistoryIndex(historyUpToNow, maskState.historyIndex);
  const compositedMaskUrl = imageDataToDataUri(displayComposite);
  setPerAnnotationMask(currentAnnotationId, compositedMaskUrl);  // Show composite to user
} else {
  const maskUrl = imageDataToDataUri(samEntry.imageData);
  setPerAnnotationMask(currentAnnotationId, maskUrl);
}
```

**3. Fixed Removed Pre-compositing Field**

Removed `samPredictionRaw` field from `HistoryEntry` since `imageData` is now always raw:

```typescript
export interface HistoryEntry {
  type: 'sam' | 'modifier_brush';
  imageData: ImageData;  // Raw atomic mask (SAM prediction or brush stroke)
}
```

**4. Fixed Export Logic - Explicit Per-Rect Independence**

Added comments in `buildPanoptesAnnotations` to clarify that composites are calculated fresh for each rect:

```typescript
// 3. Get composite mask at historyIndex (if mask history exists)
// Composite = bitwise OR of all raw masks (both SAM and brush strokes) up to historyIndex
// Since history stores raw atomic masks (not pre-composited), this calculation is clean and per-rect
// This ensures each rect's composite is independent and doesn't accumulate across other rects
let compositeMask: any = null;
if (maskState && maskState.history.length > 0) {
  const compositeHistoryUpToIndex = (history, upToIndex) => {
    const compositeData = new Uint8ClampedArray(...);
    // OR all entries from 0 to upToIndex (inclusive)
    for (let i = 0; i <= upToIndex && i < history.length; i++) {
      const hEntry = history[i];
      for (let j = 0; j < hEntry.imageData.data.length; j++) {
        compositeData[j] = compositeData[j] | hEntry.imageData.data[j];  // Clean OR of raw masks
      }
    }
    return new ImageData(compositeData, ...);
  };
  ...
}
```

## Expected Behavior After Fix

### Scenario: SAM + Brush Refinement on Rect "1013"

**Before Fix:**
```
History:
  [0] sam:  (raw SAM 569px)          imageData = 569px (composited = 569px)
  [1] brush: (stroke +63px)           imageData = 63px
  historyIndex = 1

Export latestSamMask:  569px ❌ (but was composited with pre-SAM modifiers)
Export compositeMask:  569px OR 63px = 632px ✓ (but only by luck)
```

**After Fix:**
```
History:
  [0] sam:  (raw SAM 569px)          imageData = raw SAM (569px)
  [1] brush: (stroke +63px)           imageData = raw brush (63px)
  historyIndex = 1

Export latestSamMask:  569px ✓ (pure SAM, raw model output)
Export compositeMask:  569px OR 63px = 632px ✓ (correct composition)
```

### Scenario: Two SAM Calls on Rect "1001" (no brush)

**Before Fix:**
```
History:
  [0] sam:  raw=800px, imageData=800px (pre-composited with nothing)
  [1] sam:  raw=750px, imageData=???? (pre-composited with 800px? composite(800) OR 750?)
  historyIndex = 1

Export latestSamMask:  800px OR 750px ❌ (should be 750px, the latest SAM)
Export compositeMask:  unclear accumulation ❌
```

**After Fix:**
```
History:
  [0] sam:  imageData = raw SAM (800px)
  [1] sam:  imageData = raw SAM (750px)
  historyIndex = 1

Export latestSamMask:  750px ✓ (latest SAM, raw)
Export compositeMask:  800px OR 750px ≈ 850px ✓ (union of both SAM predictions)
```

## Files Modified

1. **src/App.tsx**
   - Simplified `createSamHistoryEntry()` to store raw SAM only
   - Added display-time composite calculation
   - Removed `compositeImageDataMasks` import (no longer needed)

2. **src/stores/classificationStore.ts**
   - Removed `samPredictionRaw` field from `HistoryEntry`
   - Updated `HistoryEntry` interface documentation
   - Added comments explaining storage vs display vs export

3. **src/utils/image/maskCompositing.ts**
   - Updated debug function to use `imageData` instead of `samPredictionRaw`

4. **src/stores/__tests__/classificationStore.test.ts**
   - Updated test helper to remove `samPredictionRaw`

5. **docs/MASK_HISTORY_SYSTEM.md**
   - Updated architecture documentation

## Verification

- [x] TypeScript compilation: All mychanges compile without errors
- [x] Test visualization: Existing notebook test still renders correctly
- [x] Export structure: latestSamMask and compositeMask are now independent
- [x] Per-rect independence: Each rect's composite is calculated fresh

## Impact

- **Backend**: Now receives pure SAM predictions (before compositing) and can distinguish raw model output from user refinements
- **Frontend**: User sees composited masks on canvas (unchanged visually)
- **Export**: Composites are clean, per-rect, and don't accumulate across rects
- **Undo/Redo**: Works correctly with atomic entries in history
