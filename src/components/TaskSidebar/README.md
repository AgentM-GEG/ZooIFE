# TaskSidebar Component

## Overview

The TaskSidebar component displays and manages Zooniverse workflow classification tasks. It renders classification questions with input fields for different task types (single-choice, multi-choice, free-text) and integrates with the classification store to track user answers.

**Current Status:** Component structure is refactored and ready for task UI implementation. Task rendering code is currently commented out pending workflow integration.

**File Structure:**
- `TaskSidebar.tsx` — Main component (88 lines)
- `types.ts` — TaskConfig interface definition
- `styled.ts` — Styled components (8 components)
- `constants.ts` — SAMPLE_TASKS array for development

## Architecture

### Component Hierarchy

```
TaskSidebar (main component)
├── Sidebar (styled container)
├── SubmitButton (styled submit button)
└── [Commented UI - ready for implementation]
    ├── Title (styled heading)
    └── TaskBlock (task container - repeats per task)
        ├── Question (styled question text)
        ├── OptionsContainer (styled options wrapper)
        │   └── OptionLabel (styled with input for each option)
        └── TextArea (styled for text tasks)
```

### Data Flow

1. **Store Integration**
   - Component subscribes to `classificationStore`
   - Reads `buildPanoptesClassification()` method for submission
   - When UI enabled: reads `taskAnswers`, `setTaskAnswer` for state management

2. **Task Configuration**
   - Tasks defined in `constants.ts` (SAMPLE_TASKS array)
   - Each task has: id, type, question, options (if applicable)
   - Three task types: 'single', 'multiple', 'text'

3. **Submission Flow**
   - User clicks "Submit Classification" button
   - `handleSubmit()` calls `buildPanoptesClassification(PROJECT_ID, WORKFLOW_ID)`
   - Returns annotations in Panoptes format
   - Currently logs to console (ready for API integration)

## Types

### TaskConfig

Defines the structure of a classification task:

```typescript
interface TaskConfig {
  id: string;                              // Unique task identifier
  type: 'single' | 'multiple' | 'text';   // Task type
  question: string;                        // Question text displayed to user
  options?: string[];                      // Answer options (not needed for text tasks)
}
```

## Styled Components

| Component | Purpose | Key Features |
|-----------|---------|--------------|
| `Sidebar` | Main container | 320px width, scrollable, theme surface background |
| `Title` | Section heading | H4 size, medium weight, primary text color |
| `TaskBlock` | Single task container | Column flex layout, medium gap spacing |
| `Question` | Question label | Primary text, slightly larger font |
| `OptionsContainer` | Options wrapper | Vertical flex layout, small gaps |
| `OptionLabel` | Single option | Flex with input, hover effect, pointer cursor |
| `TextArea` | Text input field | Theme secondary background, focus states, placeholder text |
| `SubmitButton` | Submit button | Primary color, hover/active effects, margin-top auto |

## Usage

### Basic Example

```tsx
import { TaskSidebar } from '@/components/TaskSidebar';

function App() {
  return (
    <div>
      <TaskSidebar />
    </div>
  );
}
```

### Store Integration

The component connects to the classification store for task management:

```typescript
const { buildPanoptesClassification } = useClassificationStore(s => ({
  buildPanoptesClassification: s.buildPanoptesClassification,
}));
```

When task UI is implemented, also subscribe to:
```typescript
taskAnswers: s.taskAnswers,           // Current user answers
setTaskAnswer: s.setTaskAnswer,        // Function to update answer
```

## Interactions

### Current (Submission Only)
- User clicks "Submit Classification" button
- Component calls `buildPanoptesClassification()`
- Result logged to console

### Commented (When Task UI Enabled)
- **Single-choice tasks:** Radio button selection changes task answer
- **Multi-choice tasks:** Checkbox toggles add/remove from answer array
- **Text tasks:** Textarea input updates text answer
- **Field-by-field validation:** Checked via store integration

## Styling

### Theme Integration
- All colors from `theme.colors.*`
- All spacing from `theme.spacing.*`
- Typography from `theme.typography.*`
- Transitions from `theme.transitions.*`

### Color Scheme
- **Questions:** Primary text color on surface background
- **Options:** Secondary text, hover to primary
- **TextArea:** Secondary background (usually dark), inverse text

### Focus States
- textarea: Primary border, 3px light primary shadow
- Submit button: Opacity reduction on hover

## Performance

- **Memoization:** Component does not use React.memo (can be added if re-renders become frequent)
- **Store Selectors:** Granular selector only extracts needed store values
- **Styled Components:** Definitions in separate file prevent recreation on render

### Optimization Opportunities
1. Memoize component if parent re-renders frequently
2. Extract task rendering into separate memoized TaskItem component when UI enabled
3. Debounce setTaskAnswer calls if needed for performance

## Dependencies

### External
- `styled-components` — CSS-in-JS styling
- `zustand` — Store subscription (`useClassificationStore`)

### Local
- `@/theme/zooniverseTheme` — Theme constants
- `@/stores/classificationStore` — Classification state management
- `@/services/panoptesService` — PROJECT_ID, WORKFLOW_ID constants

## Configuration

### SAMPLE_TASKS Array

Located in `constants.ts`, includes 3 example tasks:
1. Single-choice: "What best describes the highlighted region?" (Animal, Plant, Artifact, Unknown)
2. Multi-choice: "Select all that apply:" (Visible, Partially obscured, Needs review)
3. Text: "Additional comments (optional)"

Replace with actual workflow tasks from Panoptes API when integrating.

## Testing Checklist

### Rendering
- [ ] Component renders sidebar with submit button
- [ ] "Submit Classification" button is visible
- [ ] Sidebar has correct styling (320px width, background color, border)

### Store Integration
- [ ] Store selector receives correct values
- [ ] handleSubmit calls buildPanoptesClassification with correct PROJECT_ID and WORKFLOW_ID
- [ ] Console logs classification result

### Styling
- [ ] Button has primary background color
- [ ] Hover effect works (opacity change)
- [ ] Active effect works (scale down)
- [ ] Sidebar scrolls if content exceeds max-height

### Task UI (When Enabled)
- [ ] Radio buttons work for single-choice tasks
- [ ] Checkboxes work for multi-choice tasks
- [ ] Textarea captures text input
- [ ] Selected answers persist when scrolling
- [ ] Submit button location updates with form height

## Future Enhancements

1. **Task Rendering**
   - Uncomment task rendering code when ready
   - Connect to Panoptes workflow tasks instead of SAMPLE_TASKS
   - Add task completion indicators

2. **Validation**
   - Client-side validation for required fields
   - Error message display
   - Submit button disabled until all tasks complete

3. **Accessibility**
   - ARIA labels for form elements
   - Keyboard navigation support
   - Focus management

4. **Styling**
   - Dark mode variants
   - Task progress indicator
   - Task completion animations

## Related Components

- **App.tsx** — Parent component that configures layout
- **classificationStore.ts** — Zustand store managing task state and classifications
- **panoptesService.ts** — Panoptes API integration with PROJECT_ID, WORKFLOW_ID

## Notes

- Task UI rendering is currently commented out (lines 140-180 approximately)
- Uncomment and implement when workflow integration is ready
- buildPanoptesClassification currently logs to console; integrate with API when ready
