# Types Organization & Documentation

## Overview

The application uses a **hybrid types organization strategy**:

- **Centralized (`src/types/`)** — Domain-wide types used across multiple components
- **Localized (`src/components/*/types.ts`)** — Component-specific types and props

This document explains each type, usage patterns, and the rationale for where types live.

---

## Table of Contents

1. [Centralized Types](#centralized-types)
   - [annotations.ts](#annotationsts)
   - [panoptes.ts](#panoptests)
   - [tools.ts](#toolsts)
2. [Component-Local Types](#component-local-types)
3. [Type Organization Strategy](#type-organization-strategy)
4. [Adding New Types](#adding-new-types)
5. [Type Usage Patterns](#type-usage-patterns)

---

## Centralized Types

These types are in `src/types/` because they're used across **multiple components, stores, or services**.

### annotations.ts

Defines all annotation-related types used throughout the drawing and ML annotation system.

#### Annotation Tools

**`AnnotationTool`** — Union of all available drawing tools

```typescript
type AnnotationTool = 'point' | 'freehand' | 'brush' | 'sam2' | 'modifier_brush';
```

**Used in**: 5+ files (useCanvasHandlers, useAnnotationEffects, BrushCursor, ToolPalette, ImageCanvas, App)

**Purpose**: Identifies which tool is currently selected. Used to determine rendering behavior and interaction handlers.

**Example**:

```typescript
const [tool, setTool] = useState<AnnotationTool>('point');

if (tool === 'sam2') {
  // Handle SAM2 segmentation
}
```

---

#### User-Drawn Annotations

**`PointAnnotation`** — Single point mark with foreground/background label

```typescript
interface PointAnnotation {
  type: 'point';
  x: number;
  y: number;
  label: 0 | 1; // 0 = background, 1 = foreground
  id?: string;
}
```

**`PolylineAnnotation`** — Connected series of points

```typescript
interface PolylineAnnotation {
  type: 'polyline';
  points: Array<{ x: number; y: number }>;
  id?: string;
}
```

**`BrushStroke`** — Single brush stroke with multiple points and radius

```typescript
interface BrushStroke {
  points: Array<{ x: number; y: number }>;
  radius: number;
}
```

**`BrushAnnotation`** — Collection of brush strokes

```typescript
interface BrushAnnotation {
  type: 'brush';
  strokes: BrushStroke[];
  id?: string;
}
```

**`Sam2MaskAnnotation`** — SAM2 segmentation result from prompts

```typescript
interface Sam2MaskAnnotation {
  type: 'sam2_mask';
  maskUrl?: string; // Data URI or URL to segmentation mask
  prompts: Array<{ x: number; y: number; label: 0 | 1 }>;
  id?: string;
}
```

**`DrawingAnnotation`** — Union of all user-drawn annotation types

```typescript
type DrawingAnnotation =
  | PointAnnotation
  | PolylineAnnotation
  | BrushAnnotation
  | Sam2MaskAnnotation;
```

**Used in**: classificationStore (3+ files)

**Purpose**: Represents all user interactions with drawing tools. Stored in `classificationStore.annotations[]`.

**Example**:

```typescript
const { addAnnotation } = useClassificationStore();

addAnnotation({
  type: 'point',
  x: 150,
  y: 200,
  label: 1, // foreground
  // id auto-assigned
});

// Later, build submission
const annotations: DrawingAnnotation[] = store.annotations;
```

---

#### Machine Learning Annotations

**`CaesarAnnotation`** — Single ML annotation from Capitol Analysis Engine (Caesar)

```typescript
export type CaesarAnnotation = {
  toolType: "rectangle";
  x_center: number;
  y_center: number;
  width: number;
  height: number;
  markId: string;
  [key: string]: unknown;
} | {
  toolType: "custom";
  data: unknown; // Fallback for unknown reducer shapes
};
```

**Used in**: 5 files (useCaesarReductions, CaesarAnnotationOverlay, caesarReductionStore, caesarService, CaesarAnnotationOverlay/types.ts)

**Purpose**: Represents ML-generated suggestions displayed as overlays. Read-only for user (used for reference).

**Fields**:
- `toolType` — Type of annotation ('rectangle', 'custom')
- `x_center`, `y_center` — Center coordinates in image space
- `width`, `height` — Bounding box dimensions
- `markId` — Unique identifier from Caesar
- Additional fields via `[key: string]` for extensibility

**Example**:

```typescript
const { annotations } = useCaesarAnnotationStore();

return (
  <>
    {annotations.map((ann) => {
      if (ann.toolType === "rectangle") {
        return (
          <RectangleOverlay
            x={ann.x_center - ann.width / 2}
            y={ann.y_center - ann.height / 2}
            width={ann.width}
            height={ann.height}
          />
        );
      }
      return null;
    })}
  </>
);
```

---

**`CaesarAnnotations`** — API response wrapper

```typescript
export type CaesarAnnotations = {
  data: CaesarAnnotation[];
};
```

**Used in**: caesarService.ts (1 file)

**Purpose**: Matches Caesar API response structure.

---

### panoptes.ts

Defines all Zooniverse Panoptes API types. Aligned with CSSI IFE Interoperability spec.

#### Subject & Workflow

**`SubjectLocation`** — Mapping of MIME types to URLs

```typescript
interface SubjectLocation {
  [mimeType: string]: string; // e.g. { "image/jpeg": "https://..." }
}
```

**`Subject`** — Zooniverse subject (image, video, etc.) being classified

```typescript
interface Subject {
  id: string;
  locations: SubjectLocation[];
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}
```

**Used in**: 3 files (useSubjectLoader, panoptesService, ImageLoader/types.ts)

**Purpose**: Represents the item user is classifying. Contains image URLs and metadata.

**Example**:

```typescript
const { subject } = useSubjectLoader();
const imageUrl = subject.locations[0]['image/jpeg'];
```

---

**`WorkflowTask`** — Single task in classification workflow (e.g., "Identify species")

```typescript
interface WorkflowTask {
  type: 'single' | 'multiple' | 'drawing';
  question?: string;
  instruction?: string;
  answers?: Array<{ value: string; label: string; next?: string }>;
  tools?: Array<{ type: string; label: string; value?: string; color?: string }>;
  next?: string | null;
  required?: boolean;
}
```

**`Workflow`** — Complete workflow defining classification interface

```typescript
interface Workflow {
  id: string;
  display_name: string;
  workflow_version: string;
  first_task: string;
  tasks: Record<string, WorkflowTask>;
  links?: { project: string; subject_sets: string[] };
}
```

**Used in**: panoptesService.ts (1 file)

**Purpose**: Defines the UI structure and flow of classification tasks.

---

#### Classification Submission

**`Annotation`** — Single annotation in classification

```typescript
interface Annotation {
  task: string;
  value: string | string[] | number[] | Record<string, unknown> | CompressedMask | unknown[];
}
```

**`ClassificationMetadata`** — Timing and tracking metadata

```typescript
interface ClassificationMetadata {
  started_at: string;        // ISO timestamp
  finished_at: string;       // ISO timestamp
  user_agent: string;        // Browser info
  user_language: string;     // User's language
  workflow_version: string;  // Workflow version used
}
```

**`Classification`** — Complete classification object submitted to Panoptes

```typescript
interface Classification {
  completed?: boolean;
  metadata: ClassificationMetadata;
  annotations: Annotation[];
  links: {
    subjects: string[];
    workflow: string;
    project: string;
  };
}
```

**Used in**: classificationStore, panoptesService (2 files)

**Purpose**: Represents the complete submission to Panoptes API. Built by `classificationStore.buildPanoptesClassification()`.

**Example**:

```typescript
const { buildPanoptesClassification } = useClassificationStore();
const classification = await buildPanoptesClassification('projectId', 'workflowId');

// Submit to Panoptes API
await panoptesService.submitClassification(classification);
```

---

### tools.ts

Shared tool and canvas infrastructure types used across multiple components.

**`BrushMode`** — Brush interaction mode

```typescript
type BrushMode = "add" | "subtract";
```

**Used in**: 5 files (ImageMask constants, BrushEditableImage, ToolPalette, App, canvas handlers)

**Purpose**: Determines how brush strokes are applied to masks — painting/adding or erasing/subtracting. Flows through the component hierarchy: App state → ToolPalette → ImageCanvas → ImageMask.

---

**`BrushEditableImageHandle`** — Imperative ref interface for canvas control

```typescript
interface BrushEditableImageHandle {
  pointerDown: (e: KonvaEventObject<PointerEvent>) => void;
  pointerMove: (e: KonvaEventObject<PointerEvent>) => void;
  pointerUp: () => void;
  undo: () => void;
  redo: () => void;
}
```

**Used in**: 4 files (BrushEditableImage, ImageCanvas/types, App.tsx)

**Purpose**: Allows parent App component to control brush canvas operations without managing internal state. Created as imperative ref in BrushEditableImage and held in App.tsx.

**Note**: These types were moved here from `components/ImageMask/types.ts` because they're cross-cutting concerns used across multiple components and represent shared UI interaction infrastructure.

---

## Component-Local Types

These types in `src/components/*/types.ts` are specific to their component and not used elsewhere.

### ImageCanvas/types.ts

```typescript
// Component props
interface ImageCanvasProps {
  tool: AnnotationTool;
  brushProps: BrushProps;
  onPointClick?: (x: number, y: number, label: 0 | 1) => void;
  onUndo?: () => void;
  showPoints?: boolean;
}

// Brush tool configuration (moved from tools.ts)
interface BrushProps {
  brushSize: number;
  predModBrushSize: number;
  predModBrushMode: string;
  predModBrushRef: RefObject<BrushEditableImageHandle> | null;
}

// Canvas viewport transformation
interface ViewportState {
  zoom: number;
  pan: { x: number; y: number };
}

interface StageSize {
  width: number;
  height: number;
}
```

**Why local**: 
- `ImageCanvasProps` is component-specific props
- `BrushProps` is only used within ImageCanvas ecosystem (useCanvasHandlers, useAnnotationEffects, ToolPalette)
- Internal render state (ViewportState, StageSize)

---

### CaesarAnnotationOverlay/types.ts

```typescript
// Tooltip display state (moved from tools.ts)
interface TooltipState {
  visible: boolean;
  x: number;    // Screen-space X (pixels)
  y: number;    // Screen-space Y (pixels)
  text: string;
}

// Component props
interface CaesarAnnotationOverlayProps {
  annotations: CaesarAnnotation[];
  stroke?: string;
  strokeWidth?: number;
  onAnnotationClick?: (...) => void;
  selectedId?: string;
  toolCursor?: string;
  setToolTip: Dispatch<SetStateAction<TooltipState>>;
}

interface AnnotationRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

**Why local**: 
- `CaesarAnnotationOverlayProps` is component-specific props
- `TooltipState` is only used by Caesar tooltip system
- `AnnotationRect` is Caesar-specific geometry

---

### Other Component Types

- **Login/types.ts** — Login form props
- **UserProfile/types.ts** — Profile display props
- **ImageLoader/types.ts** — Image loader component props
- **ImageMask/types.ts** — Mask editor component props
- **TaskSidebar/types.ts** — Task display props

---

## Type Organization Strategy

### Decision Framework

Use this decision tree to determine where to define a new type:

```
Is this type used by multiple files/components?
├─ YES → Centralized (src/types/)
│    └─ Is it domain-specific (annotations, API, tools)?
│         ├─ Annotations → src/types/annotations.ts
│         ├─ Panoptes API → src/types/panoptes.ts
│         └─ Tools/UI → src/types/tools.ts
│
└─ NO → Component-local (src/components/Component/types.ts)
     └─ Place in the component's own types.ts file
```

### Current State Assessment

| Location | Count | Examples | Strategy |
|----------|-------|----------|----------|
| `src/types/` | 12 types | AnnotationTool, DrawingAnnotation, CaesarAnnotation, Subject, Classification, BrushMode, BrushEditableImageHandle | **Keep** — shared across multiple components, cross-cutting concerns |
| Component local | 8 files | ToolPaletteProps, ImageCanvasProps, LoginProps, BrushEditableImageProps | **Keep** — component-specific props and configs |

### Future Refactoring Opportunities

#### ✅ Completed: Move `BrushProps` to `components/ImageCanvas/types.ts`

**Status**: DONE ✓

**What was done**:
- Moved `BrushProps` interface to `src/components/ImageCanvas/types.ts`
- Updated imports in:
  - `useCanvasHandlers.ts` → `import from './types'`
  - `useAnnotationEffects.ts` → `import from './types'`
  - `ToolPalette/types.ts` → `import from '../ImageCanvas/types'`

---

#### ✅ Completed: Move `TooltipState` to `components/CaesarAnnotationOverlay/types.ts`

**Status**: DONE ✓

**What was done**:
- Moved `TooltipState` interface to `src/components/CaesarAnnotationOverlay/types.ts`
- Updated imports in:
  - `useCaesarAnnotationTooltip.ts` → `import from './types'`

---

#### ✅ Completed: Move `BrushMode` and `BrushEditableImageHandle` to `src/types/tools.ts`

**Status**: DONE ✓

**What was done**:
- Moved `BrushMode` type from `components/ImageMask/types.ts` to `src/types/tools.ts`
- Moved `BrushEditableImageHandle` interface from `components/ImageMask/types.ts` to `src/types/tools.ts`
- Updated imports in:
  - `ImageMask/constants.ts` → `import from '@/types/tools'`
  - `ImageMask/BrushEditableImage.tsx` → `import from '@/types/tools'`
  - `ImageMask/types.ts` → `import from '@/types/tools'` (for type annotation)
  - `ImageCanvas/types.ts` → `import from '@/types/tools'`
  - `App.tsx` → `import from '@/types/tools'`

**Rationale**: These types represent shared UI interaction infrastructure used across 5+ files in multiple components (App, ToolPalette, ImageCanvas, ImageMask). They're cross-cutting concerns, not component-specific.

---

#### Keep Centralized: Core API & Domain Types

✅ **Keep in `src/types/`**:
- `AnnotationTool` — Used across canvas, palette, effects, storage
- `DrawingAnnotation` — Used in store and multiple components
- `CaesarAnnotation` — Used in store, service, multiple components
- `Subject`, `Classification` — API types used in service and store

**Rationale**: These types enable communication between major systems and should remain centralized for consistency and discoverability.

## Adding New Types

### Checklist for New Type Definitions

1. **Is it reused across multiple files?**
   - Used in 2+ files in different components/systems? → Centralize in `src/types/`
   - Used in only 1 component or closely-related ecosystem? → Keep in component-local `types.ts`

2. **Does it fit an existing domain?**
   - Drawing/annotations? → `src/types/annotations.ts`
   - Zooniverse/Panoptes API? → `src/types/panoptes.ts`
   - Component props or UI state? → `src/components/Component/types.ts`
   - Tool configuration/shared props? → Component-local `types.ts` (prefer colocation)

3. **Add comprehensive documentation**
   - JSDoc comment explaining purpose and use case
   - `@example` with real usage
   - `@see` cross-references to related types and locations
   - Note any considerations for moving/refactoring

4. **Export consistently**
   - Centralized types: `export type` or `export interface`
   - Component types: `export interface` or `export type`
   - Always add JSDoc above each type definition

### Example: Adding a New Annotation Type

```typescript
// ❌ Bad: No documentation, unclear usage
export interface PolygonAnnotation {
  type: 'polygon';
  points: number[][];
}

// ✅ Good: Well-documented
/**
 * Closed polygon annotation for complex shape marking
 * @example
 * {
 *   type: 'polygon',
 *   points: [[x1, y1], [x2, y2], [x3, y3], [x1, y1]],
 *   id: 'uuid'
 * }
 */
export interface PolygonAnnotation {
  type: 'polygon';
  points: Array<[number, number]>; // Closed shape, last point = first point
  id?: string;
}
```

Then update `DrawingAnnotation` to include it:

```typescript
export type DrawingAnnotation =
  | PointAnnotation
  | PolylineAnnotation
  | BrushAnnotation
  | Sam2MaskAnnotation
  | PolygonAnnotation; // Added
```

---

## Type Usage Patterns

### Pattern 1: Fetching and Typing with Services

```typescript
// panoptesService.ts uses centralized types
import type { Subject, Workflow, Classification } from '@/types/panoptes';

export async function getSubject(projectId: string, id: string): Promise<Subject> {
  const response = await fetch(...);
  return response.json() as Subject;
}

// Component uses service result
const subject = await panoptesService.getSubject(projectId, id);
```

### Pattern 2: Store with Multiple Type Sources

```typescript
// classificationStore.ts uses both annotations and panoptes types
import type { DrawingAnnotation } from '@/types/annotations';
import type { Classification, Annotation as PanoptesAnnotation } from '@/types/panoptes';

export const useClassificationStore = create<ClassificationState>((set) => ({
  annotations: [] as DrawingAnnotation[],
  
  buildPanoptesClassification: async (): Promise<Classification> => {
    // Mix user annotations and Panoptes API types
  }
}));
```

### Pattern 3: Component with Local + Shared Types

```typescript
// CaesarAnnotationOverlay.tsx uses both
import type { CaesarAnnotation } from '@/types/annotations'; // Shared
import type { CaesarAnnotationOverlayProps } from './types'; // Local

export function CaesarAnnotationOverlay(props: CaesarAnnotationOverlayProps) {
  const { annotations }: { annotations: CaesarAnnotation[] } = props;
  // ...
}
```

### Pattern 4: Union Types for Flexibility

```typescript
// annotations.ts defines union of all annotation types
export type DrawingAnnotation = 
  | PointAnnotation 
  | PolylineAnnotation 
  | BrushAnnotation 
  | Sam2MaskAnnotation;

// Store can accept any type
addAnnotation: (ann: DrawingAnnotation) => void

// Components can narrow type
if (annotation.type === 'point') {
  // TypeScript knows annotation is PointAnnotation here
  const label = annotation.label; // OK
}
```

---

## Related Documentation

- [STORES.md](STORES.md) — How stores use these types
- [COMPONENTS.md](COMPONENTS.md) — Component structure and props
- [ARCHITECTURE.md](SOLUTION_ARCHITECTURE.md) — System design overview
