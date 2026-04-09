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
  - `loadNextSubject: () => Promise<void>` — Load next subject handler

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

#### `loadNextSubject()` Implementation

```
1. Check token available
2. If queue empty or uninitialized:
   a. Fetch subjects from Panoptes queue
   b. Store in subjectsQueueRef
   c. Set hasInitializedRef = true
3. Dequeue first subject
4. Update remaining subjects count (state)
5. Call processSubject(subject)
   a. Load image as data URL
   b. Normalize image
   c. Get dimensions
   d. Store in classification store
   e. Call onSubjectProcessedRef.current(subjectId)
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
  1. fetchCaesarReductions(caesarClient, 'machineLearnt', subjectId, workflowId)
  2. getWorkflow(workflowId, accessToken, staging?)
  3. parseReductions(reductions, workflow)
     - Maps rectangle data to CaesarAnnotation objects
     - Extracts tool color/label from workflow definition
  4. Store annotations in caesarReductionStore
}
```

#### Parsing Logic

Caesar API returns nested arrays. `parseReductions` flattens and standardizes:

```typescript
// Input (nested):
reductions = [
  { data: [{ data: [rect1, rect2] }] },
  { data: [{ data: [rect3] }] },
]

// Output (flattened):
annotations = [
  { toolType: 'rectangle', x_center: ..., width: ..., markColour: 'red', markLabel: 'species' },
  { toolType: 'rectangle', ... },
  ...
]
```

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

Component for rendering Caesar ML annotations as interactive rectangles on image canvas.

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
  - `selectedId?: string` — Currently selected annotation ID
  - `toolCursor?: string` — Cursor to restore on hover
  - `setToolTip: (state: TooltipState) => void` — State setter for tooltip
- **Behavior**: Filters rectangles and maps to child components
- **Type Safety**: Uses TypeScript type guard to ensure only rectangles passed to children

##### `CaesarAnnotationRect` (Child)

- **Props**: Same as above, but `annotation` already typed as rectangle
- **Behavior**:
  - Calculates rectangle geometry (x, y, width, height from center-based Caesar format)
  - Creates tooltip handlers via `useCaesarAnnotationTooltip`
  - Renders Konva Rect with mouse/click handlers
  - Highlights when selected

### useCaesarAnnotationTooltip.ts

Custom hook for managing annotation hover tooltips.

#### Functions

##### `useCaesarAnnotationTooltip(setToolTip, toolCursor, markLabel)`

- **Parameters**:
  - `setToolTip`: State setter for tooltip visibility/position
  - `toolCursor`: Default cursor (to restore on leave)
  - `markLabel`: Text to display in tooltip
- **Returns**: Object with handlers:
  - `handleMouseEnter(e)` — Show tooltip, change cursor
  - `handleMouseMove(e)` — Update tooltip position
  - `handleMouseLeave(e)` — Hide tooltip, restore cursor

#### Tooltip Behavior

- **Position**: Calculated relative to canvas container
- **Visibility**: Only shown if `markLabel` exists
- **Cursor**: Changes to `pointer` on hover, restores on leave
- **Offset**: Tooltip positioned near mouse to avoid covering annotation

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
