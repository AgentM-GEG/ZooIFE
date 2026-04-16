# Components Architecture

This document describes key components edited or created during the services refactoring and hooks debugging work.

## Overview

The application is organized around subject loading, image canvas display, and Caesar ML annotation overlays. Key components handle data flow from Zooniverse platform through image processing to display.

## ImageLoader Components

Located in `src/components/ImageLoader/`

### ZooniverseImageLoader.tsx

Main component for loading subjects from Zooniverse workflow queue and subscribing to Caesar ML annotations.

#### Design Pattern

Uses the **unconditional hooks pattern**: All hooks are called at the top level, in the same order, on every render. Conditional logic is deferred until after hooks are initialized.

```typescript
// ✅ CORRECT: Hooks called unconditionally first
export function ZooniverseImageLoader() {
  const { token } = useAuth();

  // ALL hooks called unconditionally, even with undefined values
  const accessToken = token?.access_token;
  const caesarClient = useCaesarClient(accessToken, CAESAR_REDUCTION_OPTS);
  const processCaesarReductions = useCaesarReductions(caesarClient, WORKFLOW_ID, accessToken);
  const { loadNextSubject } = useSubjectLoader(accessToken, processCaesarReductions);

  // THEN conditional rendering based on auth state
  if (!accessToken) {
    return <Container />;
  }

  return (
    <Container>
      <Button onClick={() => loadNextSubject()}>
        Next subject
      </Button>
    </Container>
  );
}
```

**Why this pattern?** React's hooks engine tracks hook instances by their order in the render function. Conditional calls (before vs after guard checks) change the count and order, causing "rendered fewer/more hooks" errors. The correct approach:

1. **Always call hooks unconditionally** at the top level
2. **Never nest hook calls in branches or loops**
3. **Use conditional rendering after all hooks are set up**

#### Props

None. Component is self-contained with internal state management.

#### Internal Behavior

1. **useAuth()** — Gets OAuth token from AuthContext
2. **useCaesarClient()** — Creates memoized GraphQL client for Caesar API
3. **useCaesarReductions()** — Returns callback to fetch/process Caesar annotations
4. **useSubjectLoader()** — Returns `loadNextSubject` callback
   - Manages subject queue from Panoptes API
   - Loads and normalizes images
   - Calls `processCaesarReductions` immediately after image loaded
5. **Render** — Button to trigger `loadNextSubject()`

#### Flow on "Next subject" Click

```
User clicks "Next subject"
    ↓
loadNextSubject() called
    ↓
Fetches next subject from Panoptes queue (if empty)
    ↓
Loads image from subject location URL
    ↓
Normalizes image (fixes EXIF coordinate mismatch)
    ↓
Stores image + dimensions in classification store
    ↓
Calls processCaesarReductions(subjectId)
    ↓
Fetches Caesar ML reductions for subject
    ↓
Parses reductions into CaesarAnnotation objects
    ↓
Stores annotations in Caesar reduction store
    ↓
ImageCanvas component re-renders with new image + annotations
```

### useSubjectLoader.ts

Custom React hook managing the subject queue and image loading pipeline.

#### Functions

##### `useSubjectLoader(accessToken, onSubjectProcessed?)`

- **Parameters**:
  - `accessToken`: Zooniverse OAuth token (string or undefined)
  - `onSubjectProcessed`: Optional callback after image loaded
    - Called with `subjectId`
    - Useful for triggering Caesar annotation fetch
- **Returns**: Object with:
  - `queueSize: number` — Remaining subjects in queue
  - `isLoading: boolean` — Whether a subject is currently being loaded
  - `loadNextSubject: (overrideSubjectId?: string) => Promise<void>` — Load subject handler
    - When called with no argument (or empty string): dequeues next subject from Panoptes queue
    - When called with a subject ID string: fetches that specific subject directly, bypassing the queue

#### Internal State Management

**Uses refs to avoid state-driven hook count changes:**

```typescript
const subjectsQueueRef = useRef<Subject[] | null>(null);  // Queue data
const hasInitializedRef = useRef(false);                   // Initialization flag
const onSubjectProcessedRef = useRef(onSubjectProcessed);  // Callback storage

// Only minimal state for display purposes
const [queueSize, setQueueSize] = useState(0);
```

**Why refs instead of state?** State updates trigger re-renders, which can change hook counts if dependencies vary. Refs store data without side effects.

#### `loadNextSubject(overrideSubjectId?)` Implementation

```
1. Check token available and not already loading
2. If overrideSubjectId provided (trimmed, non-empty):
   a. Fetch specific subject via getSubject(id, token, staging)
   b. If not found, log and return
   c. Call processSubject(subject) and return
3. Otherwise (queue path):
   a. If queue empty or uninitialized:
      i. Fetch subjects from Panoptes queue
      ii. Store in subjectsQueueRef
      iii. Set hasInitializedRef = true
   b. Dequeue first subject
   c. Update remaining subjects count (state)
   d. Call processSubject(subject)
```

#### Error Handling

- Network errors logged and caught
- Subject processing errors caught; queue continues
- Callback errors don't block queue management

### useCaesarReductions.ts

Custom React hook for fetching and processing Caesar ML reductions.

#### Functions

##### `useCaesarReductions(caesarClient, workflowId, accessToken)`

- **Parameters**:
  - `caesarClient`: GraphQL client from `useCaesarClient`
  - `workflowId`: Zooniverse workflow ID
  - `accessToken`: OAuth token
- **Returns**: Callback function
  - `processCaesarReductions(subjectId): Promise<void>`
  - Fetches and processes Caesar annotations for a subject

#### Data Flow

```typescript
async processCaesarReductions(subjectId) {
  1. fetchTypedCaesarReductions<CaesarBBoxCountReductionData>(
       caesarClient, 'bbox_per_rect_counter', subjectId, workflowId
     )
  2. parseBBoxReductionCounts(bbox_reductions)
     - Returns Record<string, number> keyed by Caesar bbox ID
     - Each value = number of volunteer annotations already recorded for that box
  3. fetchTypedCaesarReductions<CaesarMachineLearntReductionData>(
       caesarClient, 'machineLearnt', subjectId, workflowId
     )
  4. getWorkflow(workflowId, accessToken, staging?)
  5. parseMLReductions(ml_reductions, workflow, bboxReductionCounts)
     - Maps rectangle data to CaesarAnnotation objects
     - Extracts tool color/label from workflow definition
     - Attaches previousAnnotationCount from bboxReductionCounts per markId
  6. Store annotations in caesarReductionStore
}
```

#### BBox Reduction Parsing

`parseBBoxReductionCounts` converts the raw `bbox_per_rect_counter` reduction payload into a `Record<string, number>` dictionary keyed by Caesar bbox ID:

```typescript
// Input payload structure:
{
  "subject_reductions": [{
    "data": {
      "bbox_keys": ["1000", "1001", "1002"],
      "bbox_num_masks": [2, 0, 5]
    }
  }]
}

// Output:
{ "1000": 2, "1001": 0, "1002": 5 }
```

This dictionary is passed to `parseMLReductions`, which attaches the count as `previousAnnotationCount` on each `CaesarAnnotation` rectangle.

#### Ref-Based Dependencies

Uses refs to avoid cascading context value changes:

```typescript
const caesarClientRef = useRef(caesarClient);
const accessTokenRef = useRef(accessToken);

useEffect(() => {
  caesarClientRef.current = caesarClient;
}, [caesarClient]);

useEffect(() => {
  accessTokenRef.current = accessToken;
}, [accessToken]);
```

This prevents the callback dependency chain from forcing parent component re-renders when token changes.

## Caesar Annotation Overlay

Located in `src/components/CaesarAnnotationOverlay/`

### CaesarAnnotationOverlay.tsx

Component for rendering Caesar ML annotations as interactive rectangles on image canvas with hover tooltips and dynamic zoom cursors.

#### Critical Refactoring: Extract Child Component

**Problem Fixed**: Originally called `useCaesarAnnotationTooltip` hook inside `.map()` loop, violating React's Rules of Hooks.

```typescript
// ❌ BROKEN: Hook call inside map loop
annotations.map((annotation) => {
  const tooltipHandlers = useCaesarAnnotationTooltip(...);  // ERROR
  return <Rect ... />;
})
```

**Solution**: Extract `CaesarAnnotationRect` child component.

```typescript
// ✅ CORRECT: Hook call at top level of component
function CaesarAnnotationRect({ annotation, ... }) {
  const tooltipHandlers = useCaesarAnnotationTooltip(...);  // Safe
  return <Rect ... />;
}

// Parent component
annotations.map((annotation) => (
  <CaesarAnnotationRect key={annotation.markId} annotation={annotation} ... />
))
```

#### Components

##### `CaesarAnnotationOverlay` (Parent)

- **Props**:
  - `annotations: CaesarAnnotation[]` — Caesar ML annotations
  - `strokeWidth?: number` — Stroke width for rectangles
  - `onAnnotationClick?: (geometry, annotationId) => void` — Click handler
  - `selectedId?: string` — Currently selected annotation ID (determines cursor type)
  - `toolCursor?: string` — Cursor to restore on leave
  - `setToolTip: (state: TooltipState) => void` — State setter for tooltip
  - `onMouseEnterRect?: () => void` — Callback when entering any rectangle
  - `onMouseLeaveRect?: () => void` — Callback when leaving any rectangle
- **Behavior**:
  - Filters rectangles and maps to child components
  - Passes `selectedId` to children for cursor selection logic
- **Type Safety**: Uses TypeScript type guard to ensure only rectangles passed to children

##### `CaesarAnnotationRect` (Child)

- **Props**: Same as parent, but `annotation` already typed as rectangle
- **Behavior**:
  - Calculates rectangle geometry (x, y, width, height from center-based Caesar format)
  - Determines selection state: `isSelected = selectedId === annotation.markId`
  - Determines `hasPreviousAnnotations = previousAnnotationCount > 0`
  - Creates tooltip handlers via `useCaesarAnnotationTooltip(setToolTip, toolCursor, tooltipLabel, isSelected)`
    - `tooltipLabel` includes ` (N previous annotations)` suffix only when `previousAnnotationCount > 0`
  - Renders Konva Rect with:
    - **Stroke color**: `#ff4444` (red) when `hasPreviousAnnotations`, otherwise `annotation.markColour`
    - **Stroke pattern**: `dash={[6, 3]}` when `hasPreviousAnnotations`, solid otherwise
    - Thicker border when selected (`SELECTED_STROKE_MULTIPLIER`)
    - Mouse/click handlers that update tooltip and selection state
  - **Visual differentiation**:
    - Boxes with prior volunteer annotations: red dashed stroke, tooltip shows count
    - Boxes with no prior annotations: original stroke colour, tooltip shows plain label
  - **Cursor behavior**:
    - Unselected rect: Shows magnifying glass with **+** (zoom in)
    - Selected rect: Shows magnifying glass with **−** (zoom out)
    - Cursor maintained across mousemove for better UX

### useCaesarAnnotationTooltip.ts

Custom hook for managing annotation hover tooltips and cursor changes.

#### Functions

##### `useCaesarAnnotationTooltip(setToolTip, toolCursor, markLabel, isSelected)`

- **Parameters**:
  - `setToolTip`: State setter for tooltip visibility/position
  - `toolCursor`: Default cursor (to restore on leave)
  - `markLabel`: Text to display in tooltip
  - `isSelected`: Whether this annotation is currently selected (boolean, optional)
- **Returns**: Object with handlers:
  - `handleMouseEnter(e)` — Show tooltip, set custom magnifying glass cursor
  - `handleMouseMove(e)` — Update tooltip position and maintain cursor
  - `handleMouseLeave(e)` — Hide tooltip, restore cursor

#### Tooltip and Cursor Behavior

**Tooltip:**
- **Position**: Calculated relative to canvas container
- **Visibility**: Only shown if `markLabel` exists
- **Text**: Shows the annotation label only (no icons)
- **Offset**: Positioned near mouse to avoid covering annotation

**Cursor (Dynamic):**
- **When unselected** (`!isSelected`): Shows **magnifying glass with +** (zoom in cursor)
  - SVG-based custom cursor with pointer arrow pointing to upper-left
  - Hotspot at (0,0) indicates exact click position
- **When selected** (`isSelected`): Shows **magnifying glass with −** (zoom out cursor)
  - Same pointer design, but with minus symbol instead of plus
- **On leave**: Restores default cursor from `toolCursor` param

#### Implementation Details

The cursor is maintained across both `handleMouseEnter` and `handleMouseMove` events, ensuring the magnifying glass cursor remains visible as the user moves their mouse within the annotation's hit buffer zone (not just over the exact line). This provides better UX feedback about clickable regions.

```typescript
const handleMouseEnter = useCallback((e) => {
  // ... tooltip setup
  if (container) {
    container.style.cursor = getAnnotationCursor(isSelected);
  }
}, [markLabel, isSelected, setToolTip]);

const handleMouseMove = useCallback((e) => {
  // ... tooltip position update
  // Keep cursor consistent as user moves within hit buffer zone
  container.style.cursor = getAnnotationCursor(isSelected);
}, [markLabel, isSelected, setToolTip]);
```

**Cursor Generation:**
The `getAnnotationCursor(isSelected: boolean)` function returns an SVG-based data URI:
- **Zoom In (isSelected=false)**: SVG magnifying glass with + symbol, hotspot (0,0)
- **Zoom Out (isSelected=true)**: SVG magnifying glass with − symbol, hotspot (0,0)

## Hooks Pattern Lessons

### ✅ Do This

```typescript
function MyComponent() {
  const token = useAuth();           // 1. Call hooks first
  const data = useFetchData(token);  // 2. All unconditionally
  const handlers = useHandlers(data); // 3. In same order

  if (!token) return <Empty />;      // 4. Then guard/conditional render
  
  return <Content />;
}
```

### ❌ Don't Do This

```typescript
function MyComponent() {
  const token = useAuth();  // This changes on re-render
  
  if (!token) {
    return <Empty />;       // ❌ Guards before hooks
  }
  
  // ❌ These hooks only called sometimes
  const data = useFetchData(token);
  const handlers = useHandlers(data);
  
  return <Content />;
}
```

```typescript
function MyComponent() {
  return (
    <>
      {items.map((item) => {
        // ❌ Hooks in loop — count changes with items.length
        const handler = useItemHandler(item);
        return <Item ... />;
      })}
    </>
  );
}
```

```typescript
function MyComponent() {
  // ✅ Correct: Extract to child component
  return (
    <>
      {items.map((item) => (
        <ItemComponent key={item.id} item={item} />
      ))}
    </>
  );
}

function ItemComponent({ item }) {
  // ✅ Hooks called unconditionally at component top level
  const handler = useItemHandler(item);
  return <Item ... />;
}
```

## Integration Points

### Data Flow

```
AuthContext (token)
    ↓
ZooniverseImageLoader (useAuth)
    ├→ useCaesarClient → caesarService.createCaesarClient
    ├→ useCaesarReductions → caesarService.fetchCaesarReductions
    ├→ useSubjectLoader → panoptesService.getQueuedSubjects
    │                       imageService.loadImageAsDataUrl
    │                       imageService.normalizeImageForDisplay
    │                       classificationStore.setSubject
    │
    └→ onSubjectProcessed callback (processCaesarReductions)
        └→ caesarReductionStore.setAnnotations

ImageCanvas
    ├→ classificationStore (current image)
    │
    └→ CaesarAnnotationOverlay
        ├→ caesarReductionStore (annotations)
        └→ CaesarAnnotationRect (per annotation)
            └→ useCaesarAnnotationTooltip
```

### State Management

- **useAuth()** — OAuth token (AuthContext)
- **classificationStore** (Zustand) — Current image + dimensions
- **caesarReductionStore** (Zustand) — Caesar annotations for current subject
- **useSubjectLoader** (local refs) — Subject queue state

## ImageCanvas Component Details

### Brush Cursor Tracking

The brush cursor (visual circle showing brush radius) is implemented with smooth 60fps tracking using `requestAnimationFrame` for synchronization with the display refresh cycle.

### Cursor Management

The canvas maintains multiple cursor states based on context:

- **Default**: `default` or tool-specific cursor (crosshair, grab)
- **Over Caesar annotation (unselected)**: Custom SVG magnifying glass with **+** symbol
- **Over Caesar annotation (selected)**: Custom SVG magnifying glass with **−** symbol

The `toolCursor` prop is set to `'auto'` when hovering over rectangles (instead of `'not-allowed'`), allowing the `CaesarAnnotationOverlay` and its tooltip hook to take full control of the cursor.

#### Show/Hide Instructions Toggle — Cursor Suppression

The Show/Hide instructions toggle buttons in the top-right corner of the canvas overlay the Konva stage. When the pointer enters these buttons, `isHoveringToolHelpToggle` state is set to `true`, which:

- Forces `toolCursor` to `'default'` (overrides crosshair, grab, etc.)
- Suppresses the `BrushCursor` overlay circle (sets `isBrushCursorVisible` to `false`)

This prevents the custom tool cursor from bleeding through the toggle buttons and gives them normal browser pointer behavior.

### Tool Instructions Panel

The instructions panel (`ToolHelpOverlay`) displays contextual guidance for the currently active tool (SAM point and modifier brush tools).

#### Single Persistent Instance

Rather than conditionally mounting/unmounting separate panels per tool, a single `ToolHelpOverlay` is always present when `shouldShowToolHelp` is true:

```typescript
const shouldShowToolHelp = tool === 'point' || tool === 'modifier_brush';
```

This eliminates the flickering that occurred when switching between tools (React was unmounting + remounting the component).

#### Fade Animation on Tool Switch

The inner `ToolHelpContent` wrapper is keyed by the current tool name. When the tool changes, React replaces the keyed element and triggers the CSS `fadeIn` animation:

```typescript
<ToolHelpContent key={tool}>
  {/* tool-specific instruction content */}
</ToolHelpContent>
```

The animation is `0.12s ease-in-out` and is defined as a `@keyframes` in `ImageCanvas/styled.ts`.

## Caesar Annotation Overlay: Cursor Utilities

Located in `src/components/CaesarAnnotationOverlay/constants.ts`

### Cursor Constants and Functions

#### `getAnnotationCursor(isZoomingOut: boolean): string`

Returns a CSS cursor string with SVG data URI and hotspot coordinates.

**Parameters:**
- `isZoomingOut`: `true` shows magnifying glass with − (zoom out), `false` shows magnifying glass with + (zoom in)

**Returns:**
- CSS cursor string: `url("data:image/svg+xml,...")  0 0, auto`
- Format: `url(svgDataUri) hotspotX hotspotY, fallback`
- Hotspot (0,0) is the tip of the pointer arrow in the upper-left corner

#### SVG Cursor Design

Both cursors follow the same design:

1. **Pointer Arrow**: Triangle pointing upper-left (0,0) to (7,2) to (2,7)
   - Black fill
   - Positioned at canvas origin to indicate exact click position
   - Hotspot set to (0,0) at arrow tip

2. **Magnifying Glass**: Circle (cx=10, cy=10, r=8) with diagonal handle
   - Black stroke, 2px width
   - Lens: `<circle cx='10' cy='10' r='8'/>`
   - Handle: `<line x1='16' y1='16' x2='24' y2='24'/>`

3. **Zoom Symbol** (inside lens):
   - **Zoom In (+)**: Vertical line (10,6 to 10,14) + Horizontal line (6,10 to 14,10)
   - **Zoom Out (−)**: Horizontal line only (6,10 to 14,10)
   - Black stroke, 1.5px width, rounded line caps

#### Browser Compatibility

SVG-based cursors are supported in all modern browsers (Chrome, Firefox, Safari, Edge). The URL-encoded format avoids base64 overhead and ensures proper parsing across browser engines.

**If cursor doesn't display:**
- Fallback to `auto` cursor automatically
- Ensures usability even if custom cursors fail
- Browser DevTools can verify data URI is valid via Network tab

**Performance Optimization** (Uses `requestAnimationFrame`):
- Previous approach: Updated brush cursor position on every `mousemove` event (potentially 100+ times per second), which caused React state batching delays and visual lag
- Current approach: Captures latest mouse position on `mousemove`, then updates React state on `requestAnimationFrame` (60fps max)
- **Benefit**: Cursor tracks at display refresh rate with no perceivable lag, eliminates React batching delays

**Implementation Details** (`src/components/ImageCanvas/ImageCanvas.tsx`):
```typescript
let lastX = 0, lastY = 0;
let frameId: number | null = null;

const handleMouseMove = (e: MouseEvent) => {
  lastX = e.clientX;
  lastY = e.clientY;
  
  // Schedule update on next animation frame
  if (frameId === null) {
    frameId = requestAnimationFrame(() => setBrushCursorPos({ x: lastX, y: lastY }));
  }
};

document.addEventListener('mousemove', handleMouseMove);
```

**Component Hierarchy**:
- `ImageCanvas` — Main canvas component, tracks mouse position
- `BrushCursor` — Fixed position overlay circle, follows cursor (positioned with state)
  - Renders at `x, y` viewport coordinates
  - Size based on active brush (brush vs modifier_brush)
  - Color-coded: lime green for brush, cyan for modifier brush
  - Only visible when brush tool active and not in debug mode

### Warning Banner & Mask Editing UX

The toolbar provides contextual feedback and controls for mask editing workflows:

#### No Rectangle Warning Banner

When a user attempts to draw or modify a mask without selecting a Caesar rectangle:

- **Banner displays**: ⚠️ "You have not selected a bounding box so we assume you are annotating an artifact or contaminant that was completely missed by the machine learning model."
- **Position**: Bottom-right of canvas (inside CanvasWrapper with position:absolute)
- **Buttons**:
  - "Okay" — Dismisses banner with fade-out animation (reappears on next attempt)
  - "Do not remind me again" — Suppresses banner for the session (won't reappear even on subsequent attempts)
- **Animation**: 100ms fade-out using CSS keyframes, coordinated with state updates via setTimeout
- **State Flow**:
  ```
  User draws without rectangle
    ↓
  setNoRectangleWarning(true)
    ↓
  useEffect resets banner visibility (unless suppressWarningForSession is true)
    ↓
  Banner shows with fade-in animation
    ↓
  User clicks "Okay" → triggers fade-out, then hides
  User clicks "Do not remind me again" → sets suppressWarningForSession, triggers fade-out
  ```

#### Mask Editing Buttons

The undo/redo/save/back buttons now appear whenever there's a mask to work with, not just when a rectangle is clicked:

- **Visibility Logic**: `(activeAnnotationId || !disableUndoRedo)`
  - `activeAnnotationId`: Rectangle was selected (per-annotation editing)
  - `!disableUndoRedo`: Mask history exists (global or annotation editing)
- **Button Enable/Disable**: `disableUndoRedo = currentMaskUrl === null && maskHistory.length === 0`
  - Buttons enabled if: SAM generated mask OR user created mask via drawing
  - Buttons disabled if: No mask available

#### Marking Message

A contextual message displays between the zoom/pan controls and the mask editing buttons:

- **When rectangle selected**: "Marking a [object_type]"
  - Extracts object type from selected Caesar annotation's `markLabel`
  - Provides user with clear context about what annotation they're editing
- **When drawing without rectangle**: "Marking a new object"
  - Informs user they're creating a new annotation outside the ML predictions
- **Layout**: Flex: 1 to expand and center in available space between Pan button and button group
- **Styling**: Primary teal color (#00979d) with bold font weight for visibility

**Implementation Details**:
```typescript
// In ImageCanvas.tsx
const selectedAnnotationLabel: string | undefined = selectedCaesarAnnotation && caesarReducedAnnotations
  ? (caesarReducedAnnotations
      .filter((a): a is Extract<typeof a, { toolType: 'rectangle' }> => a.toolType === 'rectangle')
      .find(a => a.markId === selectedCaesarAnnotation)?.markLabel as string | undefined)
  : undefined;

// Passed to CanvasToolbar and rendered conditionally
{(activeAnnotationId || !disableUndoRedo) && (
  <MarkingMessage>
    {selectedAnnotationLabel ? `Marking a ${selectedAnnotationLabel}` : 'Marking a new object'}
  </MarkingMessage>
)}
```

## Performance Considerations

### Memoization

- `useCaesarClient` memoizes GraphQL client (recreated only if token changes)
- `useCaesarReductions` uses ref pattern to prevent callback recreation
- `useSubjectLoader` stores queue in ref (doesn't trigger renders)
- `CaesarAnnotationRect` wrapped in .filter().map() to minimize re-renders

### Optimization Opportunities

- [ ] Memoize `CaesarAnnotationRect` with `React.memo()`
- [ ] Implement subject preloading (load next subject while current is displayed)
- [ ] Add Caesar annotation caching with TTL
- [ ] Virtual scrolling for large annotation lists

---

## ToolPalette Component

Located in `src/components/ToolPalette/ToolPalette.tsx`.

Renders the tool selection panel: point/brush/modifier tool buttons, brush size slider, model selector, and the Clear SAM Points button.

### Modifier Controls — Disabled State

The modifier mode toggle (`ModifierToggle`) and the modifier size slider (`RangeSlider`) are disabled when the modifier brush tool is not the active tool:

```typescript
const isModifierToolActive = tool === 'modifier_brush';
// ...
<ModifierToggle disabled={!isModifierToolActive} $inactive={!isModifierToolActive} />
<RangeSlider disabled={!isModifierToolActive} />
```

This prevents users from accidentally changing modifier settings while on another tool. Visual feedback:
- Both controls get `opacity: 0.7` when disabled
- `ModifierToggle` background turns `neutral.dark` (grey) and its `Add`/`Subtract` text switches to `text.secondary` color
- `cursor: not-allowed` is applied to `ModifierToggle` when `$inactive`

### Label Alignment

The "Modifier mode:" and "Modifier size:" row labels share a common `minWidth: 110px` inline style so their left edges align consistently regardless of text length.

### Clear SAM Points Button

The Clear SAM Points button is **always rendered** in the palette. It is enabled only when the active rect has SAM point annotations, and disabled (greyed out) otherwise:

```typescript
const hasSamPointsForActiveRect = annotations.some(
  (a) => a.type === 'point' && a.annotationId === activeRectId
);
// ...
<ClearButton
  onClick={() => clearSamPoints(activeRectId)}
  disabled={!hasSamPointsForActiveRect}
>
  Clear SAM points
</ClearButton>
```

Rendering the button unconditionally (rather than with `{hasSamPointsForActiveRect && ...}`) prevents layout jitter when SAM points are added or removed — the button always occupies its space.

The `:hover` style on `ClearButton` is guarded with `:not(:disabled)` so the red fill does not appear on hover while the button is disabled.

`clearSamPoints` is rect-scoped — it only removes `type: 'point'` annotations whose `annotationId` matches the given rect. This ensures clicking the button never affects SAM points belonging to other rects.

**When the button becomes active:**
- You have placed at least one SAM point while annotating a new object (no bounding box selected)
- You have selected a bounding box that already has SAM points associated with it

---

## UserRectsOverlay Component

Located in `src/components/UserRectsOverlay/UserRectsOverlay.tsx`.

Renders user-drawn bounding rectangles as a react-konva layer on top of the image canvas.

### Stroke Colour

User-defined rectangles render with a **blue** stroke (`#44aaff`) to distinguish them visually from:
- Caesar ML annotation boxes (which use their workflow-defined `markColour`, typically orange/yellow)
- Caesar boxes with previous volunteer annotations (which render in red `#ff4444` with a dashed line)

The colour is set in `classificationStore.addUserRect()` on creation.

### Dashed Stroke — Unsaved Changes Indicator

The stroke style of each rect reflects whether that rect has unsaved mask changes:

```typescript
const maskState = perAnnotationMasks[rectId];
const hasUnsavedChanges = !!maskState && maskState.historyIndex !== maskState.lastSavedHistoryIndex;
// ...
<Rect dash={hasUnsavedChanges ? [5, 5] : undefined} />
```

- **Dashed** (`[5, 5]`) — `historyIndex` differs from `lastSavedHistoryIndex`: changes exist since last save
- **Solid** (no `dash` prop) — indices match: mask is clean / has been saved

This is purely a rendering concern; the `markStroke: 'dashed'` field stored on the `UserRectState` in the classification store is used only for Caesar export compatibility and does not drive the visual state.

`lastSavedHistoryIndex` is updated via `markPerAnnotationMaskSaved(rectId)` in the store whenever a mask is exported or submitted.
