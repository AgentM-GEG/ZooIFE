import styled from 'styled-components';
import { theme } from '@/theme/zooniverseTheme';
import { ButtonActive, Label as ThemeLabel, Select as ThemeSelect } from '@/theme/styles';

/**
 * Main container for the tool palette.
 * Displays tools, brushes, and settings in a vertical flex layout.
 */
export const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.md};
  background: ${theme.colors.background.surface};
  border: ${theme.borders.width.thin} solid ${theme.colors.border};
  border-radius: ${theme.borders.radius.lg};
  width: 100%;
`;

// Re-export theme components for convenience
export const Label = ThemeLabel;
export const Button = ButtonActive;
export const Select = ThemeSelect;

/**
 * Clear/destructive action button.
 * Styled with error color and secondary background.
 */
export const ClearButton = styled(ButtonActive)`
  color: ${theme.colors.error};
  border-color: ${theme.colors.error};
  background: ${theme.colors.secondary};
  margin-top: ${theme.spacing.xs};

  &:hover {
    background: ${theme.colors.error};
    color: ${theme.colors.text.inverse};
  }
`;

/**
 * Undo button — hidden
 */
export const UndoButton = styled(ButtonActive)`
  display: none;
`;

/**
 * Redo button — hidden
 */
export const RedoButton = styled(ButtonActive)`
  display: none;
`;

/**
 * Hidden tool buttons (freehand and brush)
 */
export const HiddenToolButton = styled(ButtonActive)`
  display: none;
`;

/**
 * Hidden brush size container
 */
export const HiddenBrushSizeContainer = styled.div`
  display: none;
`;

/**
 * Checkbox wrapper with flex layout.
 * Aligns checkbox and label horizontally with proper spacing.
 */
export const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
  font-size: ${theme.typography.size.sm};
  color: ${theme.colors.text.primary};
  cursor: pointer;

  input {
    cursor: pointer;
  }
`;

/**
 * Flexible container for horizontal layout of controls.
 * Used for brush size slider with label.
 */
export const FlexContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
`;

/**
 * Range slider input for numeric values.
 * Inherits theme styling, flex-grows to fill container.
 */
export const RangeSlider = styled.input`
  cursor: pointer;
  flex: 1;
`;

/**
 * Container for prediction modifier tool controls.
 * Groups modifier brush controls in a column layout.
 */
export const PredModContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
  align-items: flex-start;
  margin-top: ${theme.spacing.md};
`;

/**
 * Range slider for modifier mode toggle (add/subtract).
 * Gradient swapover point dynamically moves based on mode to be hidden under thumb.
 */
export const ModifierToggle = styled.input<{ $mode: "add" | "subtract" }>`
  width: 40px;
  cursor: pointer;
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
  border-radius: ${theme.borders.radius.base};
  border: 1px solid ${theme.colors.text.inverse};
  height: 11px;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
`;

/**
 * Help text for keyboard shortcuts and instructions.
 * Secondary color, smaller font size, white-space preserved.
 */
export const HelpText = styled.span`
  font-size: 11px;
  line-height: 1.5;
  color: ${theme.colors.text.secondary};
  margin-top: ${theme.spacing.md};
  display: block;
  white-space: pre-line;
`;

/**
 * Group of buttons displayed vertically.
 * Used for tool buttons and action buttons.
 */
export const ButtonGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
  width: 100%;
`;
