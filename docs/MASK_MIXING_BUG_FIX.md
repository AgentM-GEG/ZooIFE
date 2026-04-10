# Mask Mixing and Accumulation Bug Fix

**Date**: April 10, 2026  
**Status**: FIXED  
**Impact**: Critical - Resolved cumulative mask buildup and type mixing issues

## The Problems

### Issue 1: Cumulative Buildup of Composites
When exporting, composites for non-default rects were accumulating data incorrectly, creating buildup across rects.

### Issue 2: SAM and Non-SAM Masks Getting Mixed
Display and export were using different compositing strategies:
- **Display**: Special SAM-aware logic that positioned masks relative to the latest SAM
- **Export**: Simple bitwise OR of all masks

This inconsistency caused mask types to appear mixed and earlier SAM predictions to be "lost" from the UI.

### Issue 3: Multiple SAM Points Losing Previous Segments
When placing multiple SAM points on the same rect, previous predictions would disappear from the display due to an async state race condition.

## Root Causes

### Cause 1: Inconsistent Compositing Logic

The `compositeHistoryUpToIndex()` function used special logic:

```typescript
// OLD (SAM-AWARE) - loses earlier SAMs
1. Find LATEST SAM in history
2. Get all pre-SAM modifiers → composite with SAM
3. Apply all post-SAM modifiers
4. Result: pre-modifiers OR latestSAM OR post-modifiers
```

But export did simple OR:

```typescript
// OLD (SIMPLE OR) - correct logic
sam1 OR brush1 OR sam2 OR brush2 (all entries)
```

**Example where this breaks:**
- History: [sam1, brush1, sam2, brush2]
- Display (finding latest SAM = sam2): brush1 OR sam2 OR brush2 = **loses sam1** ❌
- Export: sam1 OR brush1 OR sam2 OR brush2 = **includes all** ✓

### Cause 2: Async State Race Condition

When SAM mask arrived, code did:
```typescript
const samEntry = createSamHistoryEntry(imageData);
pushPerAnnotationMaskHistory(currentAnnotationId, samEntry);  // Queue state update

// Immediately try to read the updated state:
const maskState = useClassificationStore.getState().perAnnotationMasks[currentAnnotationId];
// ❌ Gets OLD state (new entry not there yet due to async setState)

// Computes composite with OLD history, missing the SAM just added!
```

## The Solution

### 1. Created Canonical Compositing Logic

Added `getSimpleComposite()` function in `maskCompositing.ts`:

```typescript
export function getSimpleComposite(history: HistoryEntry[], upToIndex: number): ImageData | null {
  // Start with empty
  const compositeData = new Uint8ClampedArray(...);
  
  // OR all entries from 0 to maxIndex (inclusive)
  for (let i = 0; i <= maxIndex && i < history.length; i++) {
    const hEntry = history[i];
    for (let j = 0; j < hEntry.imageData.data.length; j++) {
      compositeData[j] = compositeData[j] | hEntry.imageData.data[j];  // Bitwise OR
    }
  }
  
  return new ImageData(compositeData, ...);
}
```

This is used for **both display and export** to ensure consistency.

### 2. Fixed Async State Race Condition

Instead of relying on `getState()` after pushing, we manually compute what the history **will be** after the push:

```typescript
const samEntry = createSamHistoryEntry(imageData);

// **BEFORE** pushing, compute what history will be after the push
const currentMaskState = useClassificationStore.getState().perAnnotationMasks[currentAnnotationId];
let newHistory: typeof currentMaskState.history = [];
let newHistoryIndex = 0;

if (currentMaskState) {
  // Simulate what pushPerAnnotationMaskHistory will do
  const truncated = currentMaskState.history.slice(0, currentMaskState.historyIndex + 1);
  newHistory = [...truncated, samEntry];  // Add the new entry we just created
  newHistoryIndex = truncated.length;
} else {
  newHistory = [samEntry];
  newHistoryIndex = 0;
}

// Calculate composite with the computed FUTURE history
const displayComposite = getSimpleComposite(newHistory, newHistoryIndex) || samEntry.imageData;
const compositedMaskUrl = imageDataToDataUri(displayComposite);

// NOW push to actual store
pushPerAnnotationMaskHistory(currentAnnotationId, samEntry);
setPerAnnotationMask(currentAnnotationId, compositedMaskUrl);
```

### 3. Unified Display and Export

Both now use `getSimpleComposite()`:

**App.tsx (Display)**:
```typescript
const displayComposite = getSimpleComposite(newHistory, newHistoryIndex) || samEntry.imageData;
```

**classificationStore.ts (Export)**:
```typescript
const compositeImageData = getSimpleComposite(historyUpToNow, maskState.historyIndex);
```

## Key Changes

### File: src/utils/image/maskCompositing.ts
- ✅ Added `getSimpleComposite()` function (canonical OR logic)
- ℹ️ Left `compositeHistoryUpToIndex()` for backward compatibility (but not used for critical paths)

### File: src/App.tsx
- ✅ Changed import from `getCompositeForHistoryIndex` to `getSimpleComposite`
- ✅ Fixed all 3 instances of SAM mask display logic:
  - handleUndo (line ~173)
  - handlePointClick with debug enabled (line ~260)
  - handlePointClick without debug (line ~287)
- ✅ Each now manually constructs future history before state push
- ✅ Uses consistent `getSimpleComposite()` for compositing

### File: src/stores/classificationStore.ts
- ✅ Added import of `getSimpleComposite`
- ✅ Replaced inline composite calculation with call to `getSimpleComposite()`
- ✅ Removed duplicate composite logic

## Expected Behavior After Fix

### Scenario: Multiple SAM Calls on Same Rect

**Before Fix:**
```
User clicks point 1: SAM → entry[0], display shows sam1
User clicks point 2: SAM → entry[1], display shows sam1 ❌ (async race, point 2 lost from display)  
User clicks point 3: SAM → entry[2], display shows sam2 ❌ (only latest SAM visible)
Export shows: sam1 OR sam2 OR sam3 (all there)
```

**After Fix:**
```
User clicks point 1: SAM → entry[0], display shows sam1 ✓
User clicks point 2: SAM → entry[1], display shows sam1 OR sam2 ✓
User clicks point 3: SAM → entry[2], display shows sam1 OR sam2 OR sam3 ✓
Export shows: sam1 OR sam2 OR sam3 ✓
Display and export MATCH ✓
```

### Scenario: Mixed SAM + Brush on Different Rects

**Rect 1013:**
- Sam (500px)
- Brush (+50px)
- Sam (400px)
- Brush (+60px)

**Before Fix (Display):**
```
Found latest SAM = 400px
Composite = lastBrush OR 400pxSAM OR thirdBrush = 510px
❌ Lost first Sam (500px)
```

**After Fix (Display):**
```
Simple OR = 500px OR 50px OR 400px OR 60px = ≈810px
✓ All masks included
✓ Matches export (which does same OR)
```

## Verification

✓ TypeScript compilation clean  
✓ Test notebook renders masks correctly  
✓ Display and export use identical compositing logic  
✓ Per-rect composites are independent  
✓ Multiple SAM predictions accumulate correctly on screen  

## Side Effects

- ✅ Removed dependency on SAM-aware compositing for critical paths
- ✅ Simpler, more predictable compositing logic
- ✅ Better performance (simple OR vs complex SAM-finding logic)
- ℹ️ Old `compositeHistoryUpToIndex()` still exists but unused in critical paths
