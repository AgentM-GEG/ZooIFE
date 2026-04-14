# Stores Documentation

## Overview

The application uses **Zustand** for state management, organized into three independent stores:

- **userStore** — Logged-in user information from Panoptes API
- **classificationStore** — Subject classification state (annotations, masks, answers)
- **caesarAnnotationStore** — Machine learning annotations from Caesar API

Each store is lightweight and focused on a single domain, making them easy to understand, test, and modify.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [User Store](#user-store)
3. [Classification Store](#classification-store)
4. [Caesar Annotation Store](#caesar-annotation-store)
5. [Common Patterns](#common-patterns)
6. [Best Practices](#best-practices)
7. [Testing](#testing)
8. [Debugging](#debugging)

---

## Architecture Overview

### Store Separation

Stores are organized by **concern domain**, not by feature:

```
src/stores/
├── userStore.ts              # User authentication & profile
├── classificationStore.ts    # Subject classification workflow
├── caesarReductionStore.ts   # ML annotations (read-only display)
├── constants.ts              # Shared constants
└── utils/
    └── history.ts            # Undo/redo utility functions
```

### Design Principles

- **Lightweight**: Each store manages only its domain
- **Typed**: Full TypeScript support with strict interfaces
- **Immutable**: State updates via pure functions (Zustand pattern)
- **Composable**: Stores are independent but can be used together
- **Testable**: Pure selectors and actions are easy to unit test
- **Observable**: Easy to subscribe to specific state slices

---

## User Store

Manages logged-in user details from Zooniverse Panoptes API.

### Location

`src/stores/userStore.ts`

### State

**UserDetails** — User profile from Panoptes API

```typescript
interface UserDetails {
  id: string;                    // Unique user ID
  login: string;                 // Username (unique)
  display_name: string;          // Display name in UI
  email?: string;                // User's email
  avatar_url?: string;           // Avatar image URL
  credited_name?: string;        // Name for publications
  roles?: string[];              // admin, moderator, etc
  updated_at?: string;           // Last update timestamp
  created_at?: string;           // Account creation timestamp
[key: string]: unknown;         // Additional API fields
}
```

**UserState** — Store state

```typescript
interface UserState {
  user: UserDetails | null;      // Current logged-in user
  isLoading: boolean;            // Loading state
  error: string | null;          // Error message
  
  // Actions
  setUser: (user: UserDetails) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearUser: () => void;
}
```

### Actions

#### `setUser(user: UserDetails)`

Set the current user and clear any errors.

```typescript
const { setUser } = useUserStore();
setUser({
  id: '123',
  login: 'janedoe',
  display_name: 'Jane Doe',
  avatar_url: 'https://...',
});
```

#### `setLoading(loading: boolean)`

Set loading state during async operations (fetching user data).

```typescript
const { setLoading } = useUserStore();
setLoading(true);
// ... fetch user
setLoading(false);
```

#### `setError(error: string | null)`

Set error message from failed operations, or null to clear.

```typescript
const { setError } = useUserStore();
setError('Failed to load user profile');
// ... or clear
setError(null);
```

#### `clearUser()`

Clear user on logout.

```typescript
const { clearUser } = useUserStore();
clearUser(); // Sets user to null, clears error
```

### Usage Example

```typescript
// In AuthContext or auth hook:
const { setUser, setLoading, setError, clearUser } = useUserStore();

// Fetch user after login
setLoading(true);
try {
  const userData = await fetch('/api/users/me');
  setUser(userData);
} catch (err) {
  setError('Failed to load user');
} finally {
  setLoading(false);
}

// On logout
clearUser();

// In component:
const { user, isLoading } = useUserStore();
if (isLoading) return <Spinner />;
if (!user) return <LoginPrompt />;
return <UserProfile user={user} />;
```

---

## Classification Store

The largest store managing the complete classification workflow for a single subject.

### Location

`src/stores/classificationStore.ts`

### State Organization

State is organized into logical sections:

#### Subject & Image

```typescript
subjectId: string | null;        // Current subject ID
imageUrl: string | null;         // Image URL or data URI
imageDimensions: {               // Image dimensions
  width: number;
  height: number;
} | null;
```

#### Metadata

```typescript
startedAt: string;               // ISO timestamp when started
finishedAt: string | null;       // ISO timestamp when finished
```

#### Drawing Annotations

```typescript
annotations: DrawingAnnotation[]; // User-drawn marks
```

Each annotation has:
- `type`: 'point' | 'polyline' | 'brush' | 'sam2_mask'
- `annotationId?: string` — Which rect this annotation belongs to (`'-1'` = unmarked)
- Position/shape data specific to type
- Auto-assigned `id` (UUID)

**Example point annotation:**
```typescript
{
  type: 'point',
  x: 150,
  y: 200,
  label: 1,                          // 0 = background, 1 = foreground
  id: 'uuid-123',                    // Auto-assigned
  annotationId: 'caesar-rect-456'    // or '-1' for unmarked
}
```

**Example brush annotation:**
```typescript
{
  type: 'brush',
  strokes: [
    {
      points: [{x: 10, y: 20}, {x: 15, y: 25}, ...],
      radius: 10
    }
  ],
  id: 'uuid-789',
  annotationId: '-1'  // Whole image, no specific rect
}
```

#### Task Answers

```typescript
taskAnswers: Record<string, string | string[]>;
```

Answers to sidebar classification questions (e.g., "What is this organism?").

#### Global / Debug Mask State

```typescript
globalCompositeMask: string | null;            // Composite of all visible annotation masks
compositeExcludingActiveMask: string | null;   // Composite excluding active annotation (reference layer)
debugImageUrl: string | null;                  // Debug visualization image
debugMasks: Array<{ idx: number; iou: number; url: string; is_selected: boolean }> | null;
maskSelectionInfo: {
  selected_idx: number;
  selected_iou: number;
  all_iou_scores: number[];
  has_background_prompts: boolean;
} | null;
```

#### Per-Annotation Masks

```typescript
perAnnotationMasks: Record<string, PerAnnotationMaskState>;
activeAnnotationId: string | null;

interface PerAnnotationMaskState {
  maskUrl: string | null;
  history: HistoryEntry[];
  historyIndex: number;
  samPointHistory?: {
    allSamPoints: Array<{ x: number; y: number; label: 0 | 1 }>;
    activePointsPerHistoryIndex: number[][];
  };
}
```

Independent segmentation for individual annotations. `samPointHistory` keeps prompt overlays synchronized with mask history during undo/redo.

### Actions

#### Subject Management

**`setSubject(id, imageUrl, dimensions?)`**

Load a new subject and reset classification state.

```typescript
const { setSubject } = useClassificationStore();
setSubject(
  '12345',
  'https://..../image.jpg',
  { width: 800, height: 600 }
);
```

Automatically:
- Resets mask history
- Updates `startedAt` timestamp
- Clears annotations (kept or reset depending on workflow)

#### Annotation Actions

**`addAnnotation(annotatoin: DrawingAnnotation)`**

Add a drawn annotation, auto-assigning UUID.

```typescript
const { addAnnotation } = useClassificationStore();
addAnnotation({
  type: 'point',
  x: 150,
  y: 200,
  label: 'head',
  // id auto-assigned
});
```

**`removeAnnotation(id: string)`**

Remove an annotation by ID.

```typescript
const { removeAnnotation } = useClassificationStore();
removeAnnotation('uuid-here');
```

**`undoLastAnnotation(): DrawingAnnotation | undefined`**

Undo the last annotation and return it.

```typescript
const { undoLastAnnotation } = useClassificationStore();
const removed = undoLastAnnotation();
```

**`clearAnnotations()`**

Clear all annotations and masks.

```typescript
const { clearAnnotations } = useClassificationStore();
clearAnnotations();
```

#### Task Answer Actions

**`setTaskAnswer(taskId: string, value: string | string[])`**

Set answer for a sidebar task.

```typescript
const { setTaskAnswer } = useClassificationStore();
setTaskAnswer('species-id', 'monarch');
setTaskAnswer('patterns', ['orange', 'black', 'white']);
```

#### Global Mask Actions

**`setGlobalCompositeMask(url: string | null)`**

Set the displayed composite of all visible annotation masks.

**`setCompositeExcludingActiveMask(url: string | null)`**

Set the reference composite that excludes the active annotation.

**`setDebugImage(url: string | null)`**

Show debug visualization (coordinate points received by server).

```typescript
const { setDebugImage } = useClassificationStore();
setDebugImage('data:image/png;base64,...');
```

#### Per-Annotation Mask Actions

**`setActiveAnnotation(annotationId: string | null)`**

Mark which annotation's mask is being edited.

```typescript
const { setActiveAnnotation } = useClassificationStore();
setActiveAnnotation('annotation-uuid');
// User now edits this specific annotation's mask
setActiveAnnotation(null); // Return to global view
```

**`setPerAnnotationMask(annotationId, url)`**

Set mask for a specific annotation.

```typescript
const { setPerAnnotationMask } = useClassificationStore();
setPerAnnotationMask('annotation-uuid', 'data:image/png;...');
```

**`pushPerAnnotationMaskHistory(annotationId, entry, samPoints?)`**

Add a per-annotation history entry (`'sam'` or `'modifier_brush'`).
When provided, `samPoints` updates `samPointHistory` so point overlays can be reconstructed at each history index.

```typescript
const { pushPerAnnotationMaskHistory } = useClassificationStore();
pushPerAnnotationMaskHistory(
  'annotation-uuid',
  { type: 'sam', imageData },
  points
);
```

**`undoPerAnnotationMask(annotationId): ImageData | null`**

Undo per-annotation mask.

```typescript
const { undoPerAnnotationMask } = useClassificationStore();
undoPerAnnotationMask('annotation-uuid');
```

**`redoPerAnnotationMask(annotationId): ImageData | null`**

Redo per-annotation mask.

```typescript
const { redoPerAnnotationMask } = useClassificationStore();
redoPerAnnotationMask('annotation-uuid');
```

**`syncAnnotationsToHistoryIndex(annotationId)`**

Rebuild point annotations to match the active SAM points at the current history index.

**`clearSamPoints(annotationId)`**

Clear currently rendered SAM point annotations for an annotation without deleting underlying mask history.

**`saveMask(annotationId)`**

Save per-annotation mask and return to global view.

```typescript
const { saveMask } = useClassificationStore();
saveMask('annotation-uuid');
// activeAnnotationId set to null
```

#### Building Submissions

**`buildPanoptesAnnotations(): Promise<PanoptesAnnotation[]>`**

Build Panoptes-compatible annotations array from current classification state.

Exports:
1. **Rect Annotations** (task: `'rect-annotations'`) - Comprehensive per-rect data
2. **Drawing Annotations** (task: `'drawing-{index}'`) - User-drawn marks
3. **Task Answers** (task: `{taskId}`) - Sidebar task responses

```typescript
const { buildPanoptesAnnotations } = useClassificationStore();
const annotations = await buildPanoptesAnnotations();
// [
//   {
//     task: 'rect-annotations',
//     value: [
//       {
//         annotationId: 'caesar-rect-123',
//         samPoints: [...],
//         latestSamMask: {...},
//         compositeMask: {...},
//       },
//       {
//         annotationId: '-1',  // unmarked objects
//         samPoints: [...],
//         latestSamMask: {...},
//         compositeMask: {...},
//       }
//     ]
//   },
//   { task: 'drawing-0', value: {...} },
//   { task: 'species-id', value: 'monarch' },
// ]
```

See [Rect-Annotations Structure](#rect-annotations-structure) below for detailed format.

---

## Rect-Annotations Structure

Per-rect annotations bundle all SAM-related data for each classified region (Caesar rectangle or unmarked object).

### Motivation

Encapsulates one annotation per rectangle, containing:
1. **SAM points** placed for that rect
2. **Latest SAM mask** from the most recent SAM prediction
3. **Composite mask** at current undo/redo position

This enables analysis of mask refinement, point effectiveness, and modifier brush impact per rect.

### Format

```typescript
interface RectAnnotation {
  annotationId: string;  // Caesar rect ID or '-1' for unmarked
  samPoints: Array<{
    x: number;
    y: number;
    label: 0 | 1;       // 0 = background, 1 = foreground
  }>;
  latestSamMask: CompressedMask | null;   // Most recent SAM prediction
  compositeMask: CompressedMask | null;   // Current composite at historyIndex
}

interface CompressedMask {
  width: number;
  height: number;
  rle: number[] | string;  // RLE-encoded binary mask (default: gzip-base64)
  encoding: 'array' | 'base64' | 'gzip-base64';
  maskType: 'sam' | 'modifier_brush' | 'composite';  // Origin of mask
}
```

### annotationId

- **Caesar rectangle ID** (e.g., `'mark_123'`) — Masks for specific bounding boxes
- **`'-1'`** — Whole image masks or artifacts/contaminants (no specific rect selected)

### samPoints Array

All foreground (label: 1) and background (label: 0) SAM prompts placed for this rect, in order of placement.

**Structure:**
```typescript
{
  x: number;              // X coordinate in image
  y: number;              // Y coordinate in image
  label: 0 | 1;           // 0 = background, 1 = foreground
  pointId: number;        // Index (0-based) showing order placed for this rect
}
```

**Example:**
```json
{
  "annotationId": "caesar-rect-456",
  "samPoints": [
    { "x": 150, "y": 200, "label": 1, "pointId": 0 },  // First point
    { "x": 50, "y": 50, "label": 0, "pointId": 1 }     // Second point
  ],
  ...
}
```

**pointId use cases:**
- Replay point placement sequence
- Audit decision-making process
- Debug SAM prompt effectiveness by order

### latestSamMask

The most recent SAM2 prediction mask for this rect (searching history backwards).

- **null** if no SAM predictions exist for this rect
- **CompressedMask** in gzip-base64 format (default)

**CompressedMask structure:**
```typescript
{
  width: number;                      // Image width in pixels
  height: number;                     // Image height in pixels
  encoding: 'array' | 'base64' | 'gzip-base64';  // Compression format
  maskType: 'sam' | 'modifier_brush' | 'composite';  // Origin of mask
  rle: number[] | string;             // RLE-encoded binary mask
}
```

**maskType field:**
- `'sam'` — Mask came from SAM2 model prediction
- `'modifier_brush'` — Mask is a user brush stroke refinement
- `'composite'` — Mask is bitwise OR of all masks (SAM + brush) up to historyIndex

Use maskType to identify which masks are model predictions vs user edits.

**Encoding types:**
- `'array'` — RLE as number array, smallest code size
- `'base64'` — RLE bytes base64-encoded, medium size
- `'gzip-base64'` — (Default) RLE bytes gzipped then base64, smallest transmission size

The combined mask at current undo/redo history position:
- **SAM mask + all modifier brush strokes** applied up to `historyIndex`
- **null** if no history for this rect

Represents the final user-approved segmentation state.

### Full Example

```json
{
  "task": "rect-annotations",
  "value": [
    {
      "annotationId": "caesar-rect-abc123",
      "samPoints": [
        { "x": 200, "y": 300, "label": 1 },
        { "x": 150, "y": 150, "label": 0 }
      ],
      "latestSamMask": {
        "width": 800,
        "height": 600,
        "encoding": "gzip-base64",
        "rle": "H4sIAB5K4WYC..."
      },
      "compositeMask": {
        "width": 800,
        "height": 600,
        "encoding": "gzip-base64",
        "rle": "H4sIAB5K4WYC..."
      }
    },
    {
      "annotationId": "-1",
      "samPoints": [
        { "x": 400, "y": 200, "label": 1 }
      ],
      "latestSamMask": null,
      "compositeMask": null
    }
  ]
}
```

In this example:
- First rect (caesar-rect-abc123) has 2 SAM points, latest prediction, and composite from edits
- Unmarked object rect ('-1') has 1 point but no predictions or edits yet

**`buildPanoptesClassification(projectId?, workflowId?): Promise<Classification>`**

Build complete Classification object ready for submission to Panoptes.

```typescript
const { buildPanoptesClassification } = useClassificationStore();
const classification = await buildPanoptesClassification(
  '12345', // projectId
  '67890'  // workflowId
);
// {
//   metadata: { user_agent, started_at, finished_at, ... },
//   annotations: [...],
//   links: { subjects: [...], workflow: '67890', project: '12345' }
// }
```

#### Reset

**`reset()`**

Reset all state to initial values.

```typescript
const { reset } = useClassificationStore();
reset(); // Fresh classification state
```

### Usage Example

```typescript
// In component handling classification workflow:
const {
  imageUrl,
  annotations,
  setSubject,
  addAnnotation,
  buildPanoptesClassification,
} = useClassificationStore();

// Load subject
useEffect(() => {
  setSubject(subjectId, imageUrl, dimensions);
}, [subjectId]);

// Add annotation on click
const handleClick = (x, y) => {
  addAnnotation({ type: 'point', x, y, label: 'marked' });
};

// Submit classification
const handleSubmit = async () => {
  const classification = await buildPanoptesClassification();
  await submitToServer(classification);
};
```

---

## Caesar Annotation Store

Manages machine learning annotations from Capitol Analysis Engine (Caesar).

### Location

`src/stores/caesarReductionStore.ts`

Note: Despite the filename, this exports `useCaesarAnnotationStore`.

### State

**CaesarAnnotationState**

```typescript
interface CaesarAnnotationState {
  annotations: CaesarAnnotation[];        // ML annotations
  selectedAnnotationId: string | null;    // Hover selection
  
  // Actions
  setAnnotations: (ann: CaesarAnnotation[]) => void;
  clearAnnotations: () => void;
  setSelectedAnnotationId: (id: string | null) => void;
}
```

### Actions

#### `setAnnotations(annotations: CaesarAnnotation[])`

Replace all annotations (called after fetching from Caesar API).

```typescript
const { setAnnotations } = useCaesarAnnotationStore();
const caesarData = await fetchCaesarAnnotations(subjectId);
setAnnotations(caesarData);
```

#### `clearAnnotations()`

Clear all annotations.

```typescript
const { clearAnnotations } = useCaesarAnnotationStore();
clearAnnotations(); // On new subject, logout, etc
```

#### `setSelectedAnnotationId(id: string | null)`

Set selected annotation for highlighting.

```typescript
const { setSelectedAnnotationId } = useCaesarAnnotationStore();
onMouseEnter={(ann) => setSelectedAnnotationId(ann.id)};
onMouseLeave={() => setSelectedAnnotationId(null)};
```

### Usage Example

```typescript
// In component rendering Caesar annotations:
const { annotations, selectedAnnotationId, setSelectedAnnotationId } = useCaesarAnnotationStore();

// Fetch and store annotations on subject load
useEffect(() => {
  const fetchAnnotations = async () => {
    const data = await caesarService.getAnnotations(subjectId);
    useCaesarAnnotationStore.getState().setAnnotations(data);
  };
  fetchAnnotations();
}, [subjectId]);

// Render annotations
return (
  <>
    {annotations.map((ann) => (
      <AnnotationOverlay
        key={ann.id}
        annotation={ann}
        isSelected={selectedAnnotationId === ann.id}
        onMouseEnter={() => setSelectedAnnotationId(ann.id)}
        onMouseLeave={() => setSelectedAnnotationId(null)}
      />
    ))}
  </>
);
```

---

## Common Patterns

### Selector Pattern

Zustand supports selector functions to extract specific state:

```typescript
// Single value
const imageUrl = useClassificationStore(s => s.imageUrl);

// Multiple values (object)
const { imageUrl, annotations } = useClassificationStore(s => ({
  imageUrl: s.imageUrl,
  annotations: s.annotations,
}));

// All state
const allState = useClassificationStore();
```

### Getting State Outside Components

Use `.getState()` to access state outside render:

```typescript
const state = useClassificationStore.getState();
const annotations = state.annotations;
```

### Getting State Outside Components and Modifying

```typescript
// Get state and call action
const classifications = useClassificationStore.getState();
const result = await classifications.buildPanoptesClassification();
```

### Subscribing to Changes

```typescript
// Subscribe to entire store
const unsubscribe = useClassificationStore.subscribe(
  state => console.log('Store changed:', state)
);

// Subscribe to specific selector
const unsubscribe = useClassificationStore.subscribe(
  state => state.annotations,
  annotations => console.log('Annotations changed:', annotations)
);

// Clean up
unsubscribe();
```

### Testing Store Actions

```typescript
import { useClassificationStore } from '@/stores/classificationStore';

describe('classificationStore', () => {
  beforeEach(() => {
    useClassificationStore.getState().reset();
  });

  it('should add annotations', () => {
    const { addAnnotation, annotations } = useClassificationStore.getState();
    addAnnotation({ type: 'point', x: 10, y: 20, label: 'test' });
    
    expect(useClassificationStore.getState().annotations).toHaveLength(1);
  });
});
```

---

## Best Practices

### 1. Use Selectors in Components

Always use selectors to avoid unnecessary re-renders:

✅ **Good** — Only re-renders when `imageUrl` changes:

```typescript
const imageUrl = useClassificationStore(s => s.imageUrl);
```

❌ **Bad** — Re-renders on any store change:

```typescript
const store = useClassificationStore();
const imageUrl = store.imageUrl;
```

### 2. Don't Store Derived Data

Don't duplicate data that can be computed:

❌ **Bad**:

```typescript
// Don't store annotation count
annotationCount: 0;

// In action:
setAnnotations: (anns) => set({
  annotations: anns,
  annotationCount: anns.length, // Redundant!
});
```

✅ **Good** — Compute on demand:

```typescript
const annotationCount = useClassificationStore(
  s => s.annotations.length
);
```

### 3. Normalize Nested Data

For deeply nested data, consider flattening:

```typescript
// Good structure:
perAnnotationMasks: Record<string, PerAnnotationMaskState>

// Instead of trying to nest further:
// perAnnotationMasks: { [id]: { history: [...], current: {...} } }
```

### 4. Immutability

Always return new objects, never mutate:

✅ **Good**:

```typescript
set((state) => ({
  annotations: [...state.annotations, newAnnotation],
}));
```

❌ **Bad** — Mutating!:

```typescript
set((state) => {
  state.annotations.push(newAnnotation); // Don't do this!
  return state;
});
```

### 5. Handle Async Carefully

Zustand doesn't await state updates. Use separate loading state:

```typescript
const { setLoading, setError, setAnnotations } = useCaesarAnnotationStore();

setLoading(true);
try {
  const data = await fetchAnnotations();
  setAnnotations(data);
} catch (err) {
  setError(err.message);
} finally {
  setLoading(false);
}
```

### 6. Reset on Subject Change

Always reset classification state when subject changes:

```typescript
useEffect(() => {
  const { reset, setSubject } = useClassificationStore.getState();
  reset(); // Clear old subject's data
  setSubject(subjectId, imageUrl);
}, [subjectId]);
```

---

## Testing

### Unit Testing Store Actions

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useClassificationStore } from '@/stores/classificationStore';

describe('useClassificationStore', () => {
  beforeEach(() => {
    useClassificationStore.getState().reset();
  });

  describe('annotations', () => {
    it('should add annotation with auto-generated ID', () => {
      const { addAnnotation } = useClassificationStore.getState();
      
      addAnnotation({ type: 'point', x: 10, y: 20, label: 'test' });
      
      const { annotations } = useClassificationStore.getState();
      expect(annotations).toHaveLength(1);
      expect(annotations[0].id).toBeDefined();
      expect(annotations[0].type).toBe('point');
    });

    it('should remove annotation by ID', () => {
      const { addAnnotation, removeAnnotation } = useClassificationStore.getState();
      addAnnotation({ type: 'point', x: 10, y: 20, label: 'test' });
      const id = useClassificationStore.getState().annotations[0].id!;
      
      removeAnnotation(id);
      
      expect(useClassificationStore.getState().annotations).toHaveLength(0);
    });
  });

  describe('mask history', () => {
    it('should undo per-annotation mask', () => {
      const { pushPerAnnotationMaskHistory, undoPerAnnotationMask } = useClassificationStore.getState();
      const imageData = new ImageData(10, 10);
      const entry = { type: 'modifier_brush' as const, imageData };
      
      pushPerAnnotationMaskHistory('-1', entry);
      pushPerAnnotationMaskHistory('-1', entry);
      
      const previous = undoPerAnnotationMask('-1');
      expect(previous).toBeDefined();
    });
  });
});
```

### Component Testing

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useClassificationStore } from '@/stores/classificationStore';

describe('ClassificationComponent', () => {
  it('should update store when adding annotation', async () => {
    const { rerender } = render(<ClassificationComponent />);
    
    // Reset store before test
    useClassificationStore.getState().reset();
    
    // Interact with component
    const addButton = screen.getByRole('button', { name: /add/i });
    await userEvent.click(addButton);
    
    // Check store state
    rerender(<ClassificationComponent />);
    expect(useClassificationStore.getState().annotations).toHaveLength(1);
  });
});
```

---

## Debugging

### Console Inspection

```typescript
// In browser console:

// View entire store state
useClassificationStore.getState()

// Extract specific values
useClassificationStore.getState().annotations
useClassificationStore.getState().globalCompositeMask
useClassificationStore.getState().perAnnotationMasks

// Call an action
useClassificationStore.getState().addAnnotation({
  type: 'point',
  x: 100,
  y: 200,
  label: 'debug'
})

// View user store
useUserStore.getState()
```

### Enable Logging

Add logging middleware to Zustand for debugging:

```typescript
// In store creation:
const useStore = create<State>((set, get) => ({
  // ... store definition
}));

// Add logging in devtools
if (process.env.NODE_ENV === 'development') {
  useStore.subscribe((state) => {
    console.log('Store updated:', state);
  });
}
```

### Common Issues

**Issue**: State updates don't reflect in component

**Solution**: Use selector to subscribe properly:

```typescript
// Bad
const store = useClassificationStore();
const annotations = store.annotations; // Won't re-render on change

// Good
const annotations = useClassificationStore(s => s.annotations);
```

**Issue**: Async actions cause race conditions

**Solution**: Use loading state and cleanup:

```typescript
const { setLoading } = useClassificationStore();
const abortRef = useRef<AbortController>();

useEffect(() => {
  setLoading(true);
  abortRef.current = new AbortController();
  
  fetchData({ signal: abortRef.current.signal })
    .then(data => setAnnotations(data))
    .finally(() => setLoading(false));
  
  return () => abortRef.current?.abort();
}, []);
```

**Issue**: Store state persists between tests

**Solution**: Reset in beforeEach:

```typescript
beforeEach(() => {
  useClassificationStore.getState().reset();
  useUserStore.getState().clearUser();
  useCaesarAnnotationStore.getState().clearAnnotations();
});
```

---

## Related Documentation

- [AUTH.md](AUTH.md) — User authentication and `useUserStore`
- [SERVICES.md](SERVICES.md) — API integration with Caesar and Panoptes
- [COMPONENTS.md](COMPONENTS.md) — Component patterns using stores
- [Zustand Documentation](https://github.com/pmndrs/zustand)
