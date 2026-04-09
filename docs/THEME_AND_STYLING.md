# Theme and Styling Guide

## Overview

The application uses **styled-components** with a **design tokens pattern** to manage styling. The `src/theme/` folder provides centralized design tokens and reusable components, while individual components maintain their own styled files that reference these tokens.

## Current Architecture

### Design Tokens (`src/theme/zooniverseTheme.ts`)

Single source of truth for all design values. Exported as `theme` object.

**Colors** (45+ values):
- Primary/Secondary colors
- Neutral grays (white → black)
- Status colors (success, error, warning, info)
- Semantic colors (text, background, border)
- Accent colors

**Typography**:
```typescript
fontFamily, fontWeight, size, lineHeight, letterSpacing
heading (h1-h6 with complete style definitions)
```

**Spacing Scale**:
```
xs: 4px, sm: 8px, md: 12px, lg: 16px, xl: 24px, 2xl: 32px, 3xl: 48px
```

**Borders**:
```
radius: xs, sm, base, lg, xl (0px → 16px)
width: thin (1px), base (2px)
```

**Other Tokens**:
```
shadows (sm, base, md, lg, xl)
transitions (fast, base, slow)
```

**Export**:
```typescript
export const theme = {
  colors, typography, spacing, borders, shadows, transitions
}
```

---

### Reusable Components (`src/theme/styles.ts`)

Library of **25+ pre-built styled components** for common UI patterns.

**Buttons** (5 variants):
- `Button` — Base button
- `ButtonPrimary` — Primary action
- `ButtonSecondary` — Secondary action
- `ButtonDanger` — Destructive action (error state)
- `ButtonText` — Text-only button

```typescript
const PrimaryButton = () => (
  <ButtonPrimary onClick={handleSubmit}>
    Submit
  </ButtonPrimary>
);
```

**Forms** (4 components):
- `Input` — Text input with border, padding, focus states
- `Select` — Styled select dropdown
- `TextArea` — Multi-line text input
- `Label` — Form field labels

```typescript
<Label>Species</Label>
<Select>
  <option>Monarch</option>
</Select>
```

**Containers** (4 components):
- `Card` — Content card with shadow and padding
- `Container` — Generic flex container with no opinion
- `Flex` — Flexible layout with gap, direction, alignment
- `Grid` — CSS Grid with columns and gap

```typescript
<Flex direction="column" gap="lg">
  <Text>Item 1</Text>
  <Text>Item 2</Text>
</Flex>
```

**Typography** (6 components):
- `Heading` — Generic heading
- `Heading1-6` — Semantic heading levels
- `Text` — Body text
- `TextSmall` — Small secondary text

```typescript
<Heading2>Section Title</Heading2>
<Text>Body content</Text>
```

**Utilities** (3 components):
- `Badge` — Inline badge/tag with background
- `Divider` — Horizontal separator line
- `Spacer` — Vertical spacing utility

---

### Component-Local Styles

Each major component maintains its own `styled.ts` file with component-specific styled components.

**Files**:
- `src/components/ImageCanvas/styled.ts` — 16 components (Container, Toolbar, Buttons, Modals)
- `src/components/ToolPalette/styled.ts` — 12 components (Container, Buttons, Selects, Inputs)
- `src/components/TaskSidebar/styled.ts` — 8 components (Sidebar, TaskBlock, Buttons)
- `src/components/Login/styled.ts` — 2 components (Container, Button)
- `src/components/UserProfile/styled.ts` — 4 components
- `src/components/ImageLoader/styled.ts` — 3 components

**Rationale for Component-Local Styles**:
- Styles **tied to specific component structure**
- Example: ImageCanvas `CanvasWrapper` is only used by ImageCanvas
- Co-locates related code (component + styles)
- Reduces initial theme file bloat

**Pattern Used**:
```typescript
// src/components/ImageCanvas/styled.ts
import styled from 'styled-components';
import { theme } from '@/theme/zooniverseTheme';

export const CanvasWrapper = styled.div`
  width: 100%;
  height: 75vh;
  background: ${theme.colors.background.surface};
  border-radius: ${theme.borders.radius.lg};
  /* ... */
`;
```

---

### Inline App Styles

`src/App.tsx` defines 8 styled components inline:
- `AppContainer`, `Header`, `HeaderLeft`, `HeaderTitle`, `HeaderSubtitle`
- `HeaderContent`, `HeaderRight`, `CanvasSection`

**Status**: Should be moved to `src/theme/styles.ts` as they're reusable layout components.

---

## Current Issues & Analysis

### 1. Duplicate Component Definitions

**Issue**: Same UI component defined in multiple places with different implementations.

| Component | Locations | Problem |
|-----------|-----------|---------|
| `Button` | Login/styled.ts, ToolPalette/styled.ts, theme/styles.ts | 3 incompatible implementations |
| `Container` | Used 5 places — each with different purpose | Generic name, redefines across files |
| `Label` | ToolPalette/styled.ts, theme/styles.ts | Duplicate definitions |
| `Select` | ToolPalette/styled.ts, theme/styles.ts | Duplicate definitions |
| `TextArea` | TaskSidebar/styled.ts, theme/styles.ts | Duplicate definitions |

**Impact**:
- Inconsistent styling across similar UI elements
- Maintenance burden (fix bug in one, miss in another)
- Confusion about which to use

---

### 2. Component-to-Theme Mismatch

Some components define what **should be** in theme:
- `ToolPalette/styled.ts` has Button, Label, Select, ClearButton
- `theme/styles.ts` also has Button, Label, Select, TextArea

**Result**: Developers unsure whether to use theme components or define local

---

### 3. Inline AppHeader Styles

App.tsx has header styles inline instead of in theme or styled file.

```typescript
// ❌ Current: Inline in App.tsx
const Header = styled.header`
  padding: ${theme.spacing.lg};
  border-bottom: ${theme.borders.width.thin} solid ${theme.colors.border};
  /* ... */
`;

// ✅ Better: In theme/styles.ts as reusable
export const Header = styled.header`
  /* ... */
`;
```

---

## Recommendations: Hybrid Centralization Model

### The Question: All Styling in Theme Folder?

**Simple answer**: NO, but with nuance.

**Why NOT 100% Centralized**:
1. **Bloat** — theme/styles.ts already has 25+ components; adding 50+ more becomes unmaintainable
2. **Discovery** — Developers look in component folder for component styles (principle of least surprise)
3. **Component encapsulation** — Styles tightly coupled to component should live with component
4. **Co-location** — Component logic + styles together aid understanding

**Why SOME Centralization**:
1. **Design system** — Base, reusable UI components belong in theme
2. **Consistency** — Button variants should be defined once
3. **Tokens** — Colors, spacing, typography MUST be centralized
4. **Common patterns** — Container, Flex, Grid utilities benefit from centralization

---

## Recommended Architecture

### ✅ What Should Be in Theme Folder

**`src/theme/zooniverseTheme.ts`** (Design Tokens) — ✓ Current state is good
- All colors, typography, spacing, borders, shadows, transitions
- Single source of truth for all design values
- Used by all components

**`src/theme/styles.ts`** (Design System Components):

*Core UI Patterns* (reusable across entire app):
```
Buttons (5 variants: Primary, Secondary, Danger, Text, Loading)
Forms (4 components: Input, Select, TextArea, Label)
Containers (4 utilities: Card, Flex, Grid, Container)
Typography (6 levels: Heading1-6, Text, TextSmall)
Utilities (3: Badge, Divider, Spacer)
```

*Layout Patterns* (large-scale structure):
```
Header — App header
Sidebar — Generic sidebar container
Panel — Reusable panel with sections
Section — Content section with padding
```

**`src/theme/colors.ts`** (Optional: Split as app grows)
- Color utilities (lighten, darken, mix, etc.)
- Color scales (for branding variations)

**`src/theme/animations.ts`** (Optional: For complex animations)
- Keyframe animations (fade, slide, etc.)
- Transition definitions

---

### ✅ What Should Be Component-Local

**`src/components/[Component]/styled.ts`** — Component-specific styles

*Keep Local Because:*
- **Specific layout** — Unique to this component
- **Feature-specific** — Only used by this component
- **Co-location** — Easier maintenance with component code

*Examples*:
```
ImageCanvas:
  - CanvasWrapper (75vh height specific to this view)
  - Toolbar (canvas-specific toolbar layout)
  - MaskHistoryButtons (feature-specific)

ToolPalette:
  - PredModContainer (SAM2-specific pred/modifier UI)
  - CoordinateFixOptions (tool-specific settings)

TaskSidebar:
  - TaskBlock (task item layout)
  - OptionsContainer (options rendering)
```

---

### 🔧 Immediate Refactoring Needed

#### **1. Move App.tsx Header Styles to Theme**

```typescript
// Create: src/theme/styles.ts additions

export const AppHeader = styled.header`
  padding: ${theme.spacing.lg};
  border-bottom: ${theme.borders.width.thin} solid ${theme.colors.border};
  background-color: ${theme.colors.secondary};
  color: ${theme.colors.text.inverse};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const AppContainer = styled.div`
  min-height: 100vh;
  background-color: ${theme.colors.background.default};
  color: ${theme.colors.text.primary};
  font-family: ${theme.typography.fontFamily};
  display: flex;
  flex-direction: column;
`;

export const CanvasSection = styled.div`
  flex: 1;
  display: flex;
  gap: ${theme.spacing.lg};
  padding: ${theme.spacing.lg};
  overflow: hidden;
`;
```

**Impact**: Removes inline styles, makes app layout reusable

---

#### **2. Deduplicate Button Component**

Currently defined 3 ways. Consolidate in `theme/styles.ts`:

```typescript
// In theme/styles.ts - single source of truth
export const ButtonPrimary = styled.button`
  padding: ${theme.spacing.sm} ${theme.spacing.lg};
  background-color: ${theme.colors.primary};
  color: ${theme.colors.text.inverse};
  border: 1px solid ${theme.colors.primary};
  border-radius: ${theme.borders.radius.base};
  cursor: pointer;
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  transition: all ${theme.transitions.base};

  &:hover:not(:disabled) {
    background-color: ${theme.colors.primaryLight};
    border-color: ${theme.colors.primaryLight};
  }

  &:focus {
    outline: 2px solid ${theme.colors.primary};
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
```

**Remove from**: Login/styled.ts, ToolPalette/styled.ts, TaskSidebar/styled.ts

**Update components** to import from theme:
```typescript
import { ButtonPrimary } from '@/theme/styles';
```

---

#### **3. Unified Form Components**

**Keep in theme/styles.ts** (single source):
```typescript
export const Label = styled.label`
  font-size: ${theme.typography.size.xs};
  color: ${theme.colors.text.secondary};
  margin-bottom: ${theme.spacing.xs};
  display: block;
  font-weight: ${theme.typography.fontWeight.medium};
`;

export const Select = styled.select`
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border: ${theme.borders.width.thin} solid ${theme.colors.border};
  border-radius: ${theme.borders.radius.base};
  background: ${theme.colors.background.surface};
  /* ... */
`;

export const TextArea = styled.textarea`
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border: ${theme.borders.width.thin} solid ${theme.colors.border};
  /* ... */
`;
```

**Remove duplicates from**:
- ToolPalette/styled.ts
- TaskSidebar/styled.ts

**Update to import** from theme

---

### Summary: Architecture After Refactoring

```
src/theme/
├── zooniverseTheme.ts       ← Design tokens (immutable, no changes)
├── styles.ts                ← Reusable UI components (EXPANDED)
│   ├── Buttons (6 variants)
│   ├── Forms (Label, Input, Select, TextArea, etc.)
│   ├── Containers (Card, Flex, Grid, Panel)
│   ├── Typography (Heading1-6, Text, TextSmall)
│   ├── Layout (Header, Sidebar, AppContainer, CanvasSection)
│   └── Utilities (Badge, Divider, Spacer)
└── index.ts                 ← Export all (optional convenience)

src/components/
├── ImageCanvas/
│   ├── ImageCanvas.tsx
│   ├── styled.ts             ← Canvas-specific (Toolbar, CanvasWrapper, etc.)
│   └── ...
├── ToolPalette/
│   ├── ToolPalette.tsx
│   ├── styled.ts             ← Tool-specific (PredModContainer, etc.)
│   └── ...
└── ...
```

---

## Usage Guidelines

### When to Use Theme Components

✅ Use theme components when:
- Building common UI elements (buttons, inputs, containers)
- Styling layout structure (headers, sidebars)
- Creating form layouts
- Need consistency across app

```typescript
import { ButtonPrimary, Flex, Label } from '@/theme/styles';

function SettingsForm() {
  return (
    <Flex direction="column" gap="lg">
      <Label>Select Option</Label>
      <ButtonPrimary onClick={handleSubmit}>
        Save Settings
      </ButtonPrimary>
    </Flex>
  );
}
```

### When to Use Component-Local Styles

✅ Use component-local styles when:
- Styling is **specific to this component's structure**
- Component has **unique layout patterns** not reused elsewhere
- Styles are **tightly coupled to component logic**
- Component is **self-contained** (features, state management)

```typescript
// In src/components/ImageCanvas/styled.ts
export const CanvasWrapper = styled.div`
  width: 100%;
  height: 75vh;
  /* Specific to ImageCanvas - not used elsewhere */
`;

// Use in component
function ImageCanvas() {
  return (
    <CanvasWrapper>
      {/* ... */}
    </CanvasWrapper>
  );
}
```

---

## File Organization Best Practices

### Organizing Large Components

If a component has many styled components, organize by feature:

```
src/components/ImageCanvas/
├── ImageCanvas.tsx              (main component)
├── styled.ts                    (primary layout styles)
├── styled.canvas.ts             (canvas-specific styles)
├── styled.toolbar.ts            (toolbar feature styles)
└── styled.modals.ts             (modal overlay styles)
```

**Then import together**:
```typescript
// In ImageCanvas.tsx
import * as Canvas from './styled.canvas';
import * as Toolbar from './styled.toolbar';
```

### Large Theme Organization

As app grows, split theme into domains:

```
src/theme/
├── zooniverseTheme.ts           (tokens - never split)
├── styles/
│   ├── buttons.ts               (all button variants)
│   ├── forms.ts                 (all form components)
│   ├── containers.ts            (layout containers)
│   ├── typography.ts            (text components)
│   └── index.ts                 (export all)
└── index.ts
```

---

## Migration Path (If Desired)

### Phase 1: Consolidate Duplicates (Immediate)
1. Move App.tsx header styles → theme/styles.ts
2. Deduplicate Button → single theme definition
3. Deduplicate Label, Select, TextArea → remove from components

**Effort**: 2-3 hours
**Benefit**: Consistency, reduced maintenance

### Phase 2: Organize Component Styles (Optional)
1. Document which component-local styles are really component-specific
2. Create styled.*.ts files for large components
3. Update imports

**Effort**: 4-6 hours
**Benefit**: Better code organization

### Phase 3: Theme Reorganization (Optional, as app grows)
1. Split theme/styles.ts into domain files
2. Create theme/index.ts for re-export
3. Update all imports

**Effort**: 3-4 hours
**Benefit**: Easier navigation as app scales

---

## Current Status Assessment

| Aspect | Status | Action |
|--------|--------|--------|
| Design tokens centralized | ✅ Excellent | No changes needed |
| Reusable components in theme | ⚠️ Good, incomplete | Consolidate duplicates, move App header styles |
| Component-local styles | ✅ Good organization | Minor: Fix duplicates |
| Documentation | ❌ Missing | This doc + JSDoc comments |
| Consistency | ⚠️ Good, except buttons | Fix button duplications |
| Maintainability | ⚠️ Fair | Will improve after Phase 1 |

---

## Quick Reference

### Import Patterns

```typescript
// ✅ Use theme components
import { ButtonPrimary, Flex, Label } from '@/theme/styles';

// ✅ Use design tokens
import { theme } from '@/theme/zooniverseTheme';

// ✅ Use component styles
import { CanvasWrapper, Toolbar } from './styled';

// Color from theme
const color = theme.colors.primary;

// Spacing from theme
const gap = theme.spacing.lg;

// Typography from theme
const fontSize = theme.typography.size.base;
```

### Common Patterns

**Centered flex container**:
```typescript
<Flex justify="center" align="center" gap="lg">
  Content
</Flex>
```

**Form group**:
```typescript
<Flex direction="column" gap="sm">
  <Label>Field Name</Label>
  <Input type="text" />
</Flex>
```

**Styled with theme override**:
```typescript
const CustomButton = styled(ButtonPrimary)`
  width: 100%;
  padding: ${theme.spacing.lg};
`;
```

---

## Component-Specific Pattern: Modifier Toggle

### Dynamic Gradient Swapover

The modifier toggle slider in `ToolPalette` demonstrates an elegant pattern for cross-browser compatibility using dynamic styling.

**Problem**: Range input slider with static gradient backgrounds (green/red at 50% split) showed unpredictable behavior across browsers because:
- Chrome: Small default thumb doesn't cover the transition point
- Safari: Different gradient rendering
- Firefox: Inconsistent track behavior

**Solution** (Dynamic Gradient Swapover):
```typescript
// In styled.ts
export const ModifierToggle = styled.input<{ $mode: "add" | "subtract" }>`
  background: ${(props) => {
    const swapover = props.$mode === "subtract" ? "5%" : "95%";
    return `linear-gradient(
      to right,
      ${theme.colors.success} 0%,
      ${theme.colors.success} ${swapover},
      ${theme.colors.error} ${swapover},
      ${theme.colors.error} 100%
    )`;
  }};
  /* ... */
`;

// In component
<ModifierToggle
  type="range"
  min="0"
  max="1"
  step="1"
  $mode={brushProps.predModBrushMode as "add" | "subtract"}
  value={brushProps.predModBrushMode === "subtract" ? 0 : 1}
  onChange={(e) =>
    onPredModBrushModeChange(e.target.value === "0" ? "subtract" : "add")
  }
/>
```

**How It Works**:
- **Subtract mode**: Gradient swapover at 5% (left edge) → pure green visible, red hidden
- **Add mode**: Gradient swapover at 95% (right edge) → pure red visible, green hidden
- The transition point is always positioned where the thumb is, guaranteeing it's hidden
- As users drag or click, the gradient moves to stay aligned with the thumb position

**Benefits**:
- ✅ Works identically across all browsers (Chrome, Safari, Firefox, Edge)
- ✅ No browser-specific CSS or JavaScript workarounds needed
- ✅ Elegant solution: code is simple and maintainable
- ✅ Color feedback always visible and unambiguous

**Pattern Application**: This "dynamic positioned transition" pattern is useful for any UI element where you need to hide a visual seam or transition point.

---

## Related Documentation

- [TYPES.md](TYPES.md) — Type organization (related to component structure)
- [SOLUTION_ARCHITECTURE.md](SOLUTION_ARCHITECTURE.md) — System design
- [STORES.md](STORES.md) — State management
- [COMPONENTS.md](COMPONENTS.md) — Component guide (should reference styling)
