# ToolPalette Component Documentation

## Overview

The `ToolPalette` component provides the main interface for selecting annotation tools and configuring settings in the ZooIFE application. It includes tool selection, brush size controls, SAM model selection, and prediction modification options.

**Key Features:**
- Multiple annotation tool selection (point, freehand, brush)
- Brush size adjustment with range slider
- SAM segmentation model selection
- Prediction mask modification with add/subtract modes
- Undo/redo controls for mask editing
- Keyboard shortcut reference

---

## File Structure

```
ToolPalette/
├── ToolPalette.tsx       # Main component logic
├── types.ts              # TypeScript type definitions
├── styled.ts             # Styled components
├── constants.ts          # Tool and configuration constants
└── README.md             # This file
```

---

## Component Files

### `ToolPalette.tsx` (157 lines)
Main component that renders the tool palette UI and handles user interactions.

**Props:**
```typescript
interface ToolPaletteProps {
  tool: AnnotationTool;                    // Currently selected tool
  onToolChange: (tool: AnnotationTool) => void;
  brushProps: BrushProps;                  // Brush configuration and ref
  onBrushSizeChange: (brushSize: number) => void;
  onPredModBrushModeChange: (brushMode: string) => void;
  modelId: string;                         // Selected SAM model
  onModelChange: (id: string) => void;
  showPoints: boolean;                     // Point annotation visibility
  onShowPointsChange: (v: boolean) => void;
  onPredModBrushSizeChange: (brushSize: number) => void;
  coordinateFix: 'none' | 'flipX' | 'flipY' | 'flipBoth' | 'swapXY';
  onCoordinateFixChange: (fix: ...) => void;
  debugCoords: boolean;
  onDebugCoordsChange: (v: boolean) => void;
}
```

**Store Subscriptions:**
- `annotations` - list of user annotations
- `clearAnnotations()` - callback to clear all annotations
- `maskHistory` - array of mask states for undo/redo
- `maskHistoryIndex` - current position in mask history

**Key Features:**
- Tool selection buttons (point, freehand, brush)
- Brush size slider (1-10)
- Clear all annotations button
- SAM model dropdown
- Point visibility checkbox
- Prediction modification section:
  - Modifier brush toggle button
  - Add/Subtract mode toggle
  - Modifier brush size slider
- Undo/redo buttons with state-aware disabling
- Help text with keyboard shortcuts

---

### `types.ts` (22 lines)

**ToolPaletteProps**
Main props interface for the component. Defines all configuration and callback functions passed from parent.

**ToolOption**
```typescript
interface ToolOption {
  id: AnnotationTool;
  label: string;
}
```
Defines structure of tool entries used in UI rendering.

---

### `styled.ts` (167 lines)

All styled components with CSS-in-JS styling using styled-components library.

**Components:**

| Styled Component | Purpose |
|-----------------|---------|
| `Container` | Main wrapper with vertical flex layout and surface background |
| `Label` | Section labels and form field labels with secondary text color |
| `Button` | Primary button with active state styling and hover effects |
| `ClearButton` | Destructive action button styled with error color |
| `Select` | Dropdown select for model and option selection |
| `CheckboxLabel` | Checkbox wrapper with horizontal flex alignment |
| `FlexContainer` | Horizontal flex container for label + control pairs |
| `RangeSlider` | Number range input slider |
| `PredModContainer` | Vertical container grouping modifier tool controls |
| `ModifierToggle` | Special range slider with gradient background (add/subtract) |
| `HelpText` | Secondary text for keyboard shortcuts and instructions |
| `ButtonGroup` | Vertical column of buttons |

All styled components use the Zooniverse theme for consistent color, spacing, and typography.

---

### `constants.ts` (9 lines)

**TOOLS Array**
```typescript
const TOOLS: ToolOption[] = [
  { id: 'point', label: 'Point (SAM)' },
  { id: 'freehand', label: 'Freehand' },
  { id: 'brush', label: 'Brush' },
];
```

Defines available annotation tools for rendering in the UI.

---

## Usage Example

```tsx
import { ToolPalette } from '@/components/ToolPalette/ToolPalette';

<ToolPalette
  tool={tool}
  onToolChange={setTool}
  brushProps={brushProps}
  onBrushSizeChange={handleBrushSizeChange}
  onPredModBrushModeChange={handleModifierModeChange}
  modelId={modelId}
  onModelChange={setModelId}
  showPoints={showPoints}
  onShowPointsChange={setShowPoints}
  onPredModBrushSizeChange={handleModifierBrushSizeChange}
  coordinateFix={coordinateFix}
  onCoordinateFixChange={setCoordinateFix}
  debugCoords={debugCoords}
  onDebugCoordsChange={setDebugCoords}
/>
```

---

## Key Interactions

### Tool Selection
- Clicking a tool button triggers `onToolChange` callback
- Active tool is highlighted with primary color styling
- Affects canvas cursor and available interactions

### Brush Size Control
- Range slider adjusts brush size from 1-10
- `onChange` event triggers `onBrushSizeChange`
- Updates visual cursor size in real-time on canvas

### Model Selection
- Dropdown populated with models from `SEGMENT_MODELS`
- `onChange` triggers `onModelChange`
- Determines SAM model used for point-based segmentation

### Prediction Modification
- "Modify prediction" button toggles `modifier_brush` tool
- Add/Subtract toggle switches brush mode via `onPredModBrushModeChange`
- Modifier brush size slider controls eraser/addition brush radius
- Undo/Redo buttons disabled when history is empty

### History Management
```typescript
// Undo/Redo button state
const undoMaskPossible = maskHistoryIndex >= 0;
const redoMaskPossible = maskHistoryIndex < maskHistory.length - 1;
```

---

## Styling Architecture

All styled components use the centralized Zooniverse theme:
- **Colors**: primary, secondary, error, success, borders
- **Spacing**: xs, sm, md, lg
- **Typography**: size, fontWeight, fontFamily
- **Borders**: width, radius
- **Transitions**: smooth animations

Theme values imported from `@/theme/zooniverseTheme` ensure consistency across the application.

---

## Accessibility

- Buttons use semantic `<button>` elements with proper `onClick` handlers
- Form inputs (range sliders, checkboxes, selects) use native HTML elements
- Labels properly associated with form controls
- Disabled state clearly indicated on buttons
- Checkbox labels cursor:pointer for easy toggling

---

## Performance Considerations

- **Re-render Optimization**: Component re-renders only when props change
- **Event Handlers**: All callbacks are passed from parent (no closure creation)
- **Store Subscriptions**: Granular selector usage to minimize subscription updates
- **Styled Components**: Static component definitions (no per-render creation)

---

## Related Components

- **ImageCanvas**: Consumes tool and brush props, renders annotations
- **BrushEditableImage**: Handles brush drawing with ref callbacks
- **App Component**: Manages state and passes props to ToolPalette

---

## External Dependencies

- **styled-components**: CSS-in-JS styling
- **React**: Component framework
- **Zustand**: State management via `useClassificationStore`
- **@/services/sam2Service**: SAM model definitions

---

## Testing Checklist

- [ ] Tool buttons toggle active state correctly
- [ ] Brush size slider updates and callback fires
- [ ] Clear All button appears only when annotations exist
- [ ] SAM model dropdown populates and can be changed
- [ ] Point visibility checkbox can be toggled
- [ ] Modifier brush toggle switches to modifier_brush tool
- [ ] Add/Subtract toggle updates mode display
- [ ] Undo button disabled when history index < 0
- [ ] Redo button disabled when at end of history
- [ ] Keyboard shortcuts text displays correctly
- [ ] All buttons have proper hover and active styling
- [ ] Component responds to all prop changes

---

## Future Enhancements

- User-configurable brush colors
- Brush presets (small, medium, large)
- Advanced SAM model settings
- Tool keyboard shortcuts (1=point, 2=freehand, 3=brush)
- Brush size display indicator

---

**Last Updated:** April 8, 2026  
**Status:** Production  
**Module Size:** 333 lines → 157 lines (52% reduction after refactoring)
