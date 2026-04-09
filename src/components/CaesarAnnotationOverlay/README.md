# CaesarAnnotationOverlay Component

## Overview

CaesarAnnotationOverlay is a React/Konva component that renders Caesar ML model predictions as interactive rectangle overlays on the canvas. It displays machine learning annotations with hover tooltips, click handlers, and visual selection highlighting.

The component integrates with Zooniverse's Caesar ML system to show model-generated object detection boxes that users can inspect, interact with, and refine during classification.

**File Structure:**
- `CaesarAnnotationOverlay.tsx` — Main component (62 lines)
- `types.ts` — TypeScript interfaces and type definitions
- `constants.ts` — Magic numbers and configuration values
- `rectangleGeometry.ts` — Utility functions for coordinate calculations
- `useCaesarAnnotationTooltip.ts` — Custom hook for tooltip and cursor handling

## Architecture

### Component Hierarchy

```
CaesarAnnotationOverlay (main component)
├── Rect component (per annotation) × N
│   ├── stroke color (from annotation)
│   ├── strokeWidth (1px, 2px if selected)
│   ├── hit detection (5px padding)
│   └── Event handlers:
│       ├── onMouseEnter → show tooltip, pointer cursor
│       ├── onMouseMove → update tooltip position
│       ├── onMouseLeave → hide tooltip, restore cursor
│       └── onClick → call onAnnotationClick callback
```

### Data Flow

1. **Annotation Input**
   - Receives array of CaesarAnnotation objects
   - Each has: x_center, y_center, width, height, markColour, markLabel, markId

2. **Geometry Transformation**
   - Caesar format (center-based) → Konva format (top-left based)
   - `calculateRectangleGeometry()` converts coordinates

3. **Rectangle Rendering**
   - Each annotation becomes a Konva Rect
   - Stroke color from annotation.markColour
   - Stroke width depends on selection state

4. **Interaction**
   - Hover: Show label tooltip, change cursor
   - Move: Update tooltip position following mouse
   - Leave: Hide tooltip, restore cursor
   - Click: Trigger onAnnotationClick callback

5. **Selection**
   - selectedId prop determines which box shows thicker border

## Types

### CaesarAnnotationOverlayProps

```typescript
interface CaesarAnnotationOverlayProps {
  annotations: CaesarAnnotation[];              // ML predictions to display
  stroke?: string;                              // Unused, colors from annotation
  strokeWidth?: number;                         // Stroke width (default: 1px)
  onAnnotationClick?: (annotation, id) => void; // Click handler
  selectedId?: string;                          // ID of selected annotation
  toolCursor?: string;                          // Cursor to restore on leave
  setToolTip: Dispatch<SetStateAction<TooltipState>>;  // Tooltip state setter
}
```

### AnnotationRect

Internal type for rectangle geometry:

```typescript
interface AnnotationRect {
  x: number;       // Top-left X coordinate
  y: number;       // Top-left Y coordinate
  width: number;   // Rectangle width
  height: number;  // Rectangle height
}
```

## Constants

Located in `constants.ts`:

| Constant | Value | Purpose |
|----------|-------|---------|
| DEFAULT_ANNOTATION_STROKE_WIDTH | 1 | Box border thickness |
| ANNOTATION_HIT_STROKE_MULTIPLIER | 5 | Click detection padding (5x stroke) |
| SELECTED_STROKE_MULTIPLIER | 2 | Selected box border multiplier |
| ANNOTATION_HOVER_CURSOR | "pointer" | Cursor when hovering box |
| ANNOTATION_DEFAULT_CURSOR | "default" | Cursor when not hovering |

## Utility Functions

### calculateRectangleGeometry(xCenter, yCenter, width, height)

Converts Caesar center-based format to top-left Konva format:

```typescript
const rect = calculateRectangleGeometry(100, 100, 50, 50);
// { x: 75, y: 75, width: 50, height: 50 }
```

### getTooltipPosition(stageX, stageY, containerRect)

Converts stage coordinates to absolute screen coordinates for tooltip positioning:

```typescript
const screenPos = getTooltipPosition(10, 20, containerRect);
// { x: containerLeft + 10, y: containerTop + 20 }
```

## Custom Hook: useCaesarAnnotationTooltip

Located in `useCaesarAnnotationTooltip.ts`

Manages tooltip visibility, positioning, and cursor changes:

```typescript
const {
  handleMouseEnter,  // Show tooltip, pointer cursor
  handleMouseMove,   // Update tooltip position
  handleMouseLeave   // Hide tooltip, restore cursor
} = useCaesarAnnotationTooltip(setToolTip, toolCursor, markLabel);
```

**Features:**
- Only shows tooltip if markLabel exists
- Updates tooltip position dynamically as mouse moves
- Handles cursor changes (pointer on hover, restore on leave)
- Uses DOMRect for window-relative positioning

## Usage

### Basic Implementation

```tsx
import { CaesarAnnotationOverlay } from '@/components/CaesarAnnotationOverlay';
import { useState } from 'react';

function Canvas() {
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, text: '' });
  const [selectedId, setSelectedId] = useState<string>();

  const annotations = [
    {
      toolType: 'rectangle',
      x_center: 100,
      y_center: 100,
      width: 50,
      height: 50,
      markId: 'box-1',
      markColour: '#FF0000',
      markLabel: 'Person'
    },
  ];

  return (
    <>
      <CaesarAnnotationOverlay
        annotations={annotations}
        selectedId={selectedId}
        setToolTip={setTooltip}
        onAnnotationClick={(geom, id) => {
          console.log('Clicked:', id, geom);
          setSelectedId(id);
        }}
      />
      {tooltip.visible && (
        <div style={{ position: 'absolute', left: tooltip.x, top: tooltip.y }}>
          {tooltip.text}
        </div>
      )}
    </>
  );
}
```

### Integration with ImageCanvas

```tsx
function App() {
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, text: '' });
  const [selectedAnnotation, setSelectedAnnotation] = useState<string>();

  const annotations = useCaesarAnnotationStore((s) => s.annotations);

  return (
    <Stage>
      <Layer>
        {/* Image layer */}
        <Image image={imageUrl} />

        {/* Caesar ML annotations overlay */}
        <CaesarAnnotationOverlay
          annotations={annotations}
          selectedId={selectedAnnotation}
          setToolTip={setTooltip}
          onAnnotationClick={(geometry, id) => setSelectedAnnotation(id)}
        />
      </Layer>
    </Stage>
  );
}
```

## Interactions

### Hover
- Mouse enters box → Show tooltip with markLabel, change cursor to pointer
- Tooltip follows mouse pointer
- Mouse leaves box → Hide tooltip, restore original cursor

### Selection
- Click box → Trigger onAnnotationClick callback with geometry and ID
- Selected box has double-thickness stroke (2px if base is 1px)

### Visual Feedback
- Box renders with color from markColour (typically from Caesar/workflow config)
- Selected box highlighted with thicker border
- Hover area extends 5px beyond visible stroke (easier to click)

## Performance Characteristics

### Rendering
- **Per Annotation:** One Konva Rect element
- **Memory:** ~1KB per annotation object
- **Redraw:** Only when props change (annotations, selectedId)

### Memoization
- Custom hooks use useCallback to prevent re-renders
- Event handlers stable across renders if dependencies unchanged

### Hit Detection
- Large hit area (5x stroke width) reduces precision required
- All rectangles listening (Konva handles event optimization)

## Store Integration

### Input: Caesar Annotation Store

```typescript
const annotations = useCaesarAnnotationStore((s) => s.annotations);
// Array of CaesarAnnotation from Caesar ML API
```

### Output: None

Component is pure presentation layer, no store writes. Interactions via callbacks to parent.

## Debugging

### Visual Debug
- Add console.log in event handlers to track interactions
- Check if annotations are present in store
- Verify markColour values (should be valid CSS colors)

### Coordinate Debug
- Log geometry before rendering:
  ```typescript
  const geo = calculateRectangleGeometry(x, y, w, h);
  console.log('Geometry:', geo);  // Should be top-left coordinates
  ```

### Tooltip Debug
- Verify markLabel exists for each annotation
- Check if setToolTip is being called
- Inspect tooltip state in DevTools

## Testing Checklist

### Rendering
- [ ] Component renders without errors
- [ ] One Rect per annotation
- [ ] Rectangles have correct dimensions
- [ ] Stroke colors match annotation.markColour

### Interactions - Hover
- [ ] Tooltip appears on hover
- [ ] Tooltip text matches markLabel
- [ ] Tooltip follows mouse pointer
- [ ] Cursor changes to pointer on hover
- [ ] Cursor restores on leave
- [ ] Tooltip hides on leave

### Interactions - Click
- [ ] Clicking annotation triggers onAnnotationClick
- [ ] Callback receives correct geometry
- [ ] Callback receives correct annotation ID

### Selection
- [ ] Selected annotation has thicker border (2x strokeWidth)
- [ ] Non-selected annotations have normal border
- [ ] Selection updates when selectedId prop changes

### Hit Detection
- [ ] Can click boxes near edges (5px padding)
- [ ] Small boxes still clickable
- [ ] No false hits outside visible area

## Related Components

- **ImageCanvas.tsx** — Container that renders annotations on canvas
- **useCaesarAnnotationStore.ts** — Zustand store managing annotations
- **caesarService.ts** — Fetches Caesar ML predictions from API
- **TooltipComponent** — Renders tooltip based on TooltipState

## Future Enhancements

1. **Visual Variants**
   - Dashed stroke option for uncertain predictions
   - Opacity based on confidence score
   - Fill with transparent color option

2. **Interactions**
   - Drag to move boxes
   - Resize handles for refinement
   - Edit label on double-click

3. **Performance**
   - Canvas-based rendering for large numbers
   - Culling boxes outside viewport
   - Batch updates for multiple annotations

4. **Accessibility**
   - Keyboard navigation through boxes
   - ARIA labels for screen readers
   - Focus indicators

## Notes

- Component renders as Konva Rect primitives (not shapes)
- fillEnabled={false} ensures transparent fill, only stroke visible
- listening={true} enables mouse events for all boxes
- Caesar predictions are read-only (for display) not editable
- Component requires TooltipState context from parent
