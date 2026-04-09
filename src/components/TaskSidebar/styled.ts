import styled from 'styled-components';
import { theme } from '@/theme/zooniverseTheme';

/**
 * Main sidebar container for task display.
 * Scrollable vertical layout with max height constraint.
 */
export const Sidebar = styled.div`
  width: 320px;
  padding: ${theme.spacing.lg};
  background: ${theme.colors.background.surface};
  border: ${theme.borders.width.thin} solid ${theme.colors.border};
  border-radius: ${theme.borders.radius.lg};
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.lg};
  max-height: calc(100vh - 120px);
  overflow-y: auto;
`;

/**
 * Sidebar title/heading element.
 */
export const Title = styled.h3`
  margin: 0;
  color: ${theme.colors.text.primary};
  font-size: ${theme.typography.heading.h4.fontSize};
  font-weight: ${theme.typography.fontWeight.medium};
`;

/**
 * Container for a single task question and options.
 */
export const TaskBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
`;

/**
 * Task question label with primary text styling.
 */
export const Question = styled.label`
  color: ${theme.colors.text.primary};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  cursor: default;
`;

/**
 * Container for task answer options (radio/checkbox list).
 * Displays options in vertical column layout.
 */
export const OptionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xs};
`;

/**
 * Single option label with checkbox/radio.
 * Shows hover effect to indicate interactivity.
 */
export const OptionLabel = styled.label`
  color: ${theme.colors.text.secondary};
  font-size: ${theme.typography.size.sm};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};

  input {
    cursor: pointer;
  }

  &:hover {
    color: ${theme.colors.text.primary};
  }
`;

/**
 * Freeform text input area for text tasks.
 * Styled with primary focus color and placeholder styling.
 */
export const TextArea = styled.textarea`
  padding: ${theme.spacing.md};
  border-radius: ${theme.borders.radius.base};
  border: ${theme.borders.width.thin} solid ${theme.colors.border};
  background: ${theme.colors.secondary};
  color: ${theme.colors.text.inverse};
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  resize: vertical;
  transition: all ${theme.transitions.base};

  &:focus {
    outline: none;
    border-color: ${theme.colors.primary};
    box-shadow: 0 0 0 3px ${theme.colors.primaryLight}40;
  }

  &::placeholder {
    color: ${theme.colors.neutral.dark};
  }
`;

/**
 * Submit button for completing classification.
 * Primary color styling with hover and press effects.
 */
export const SubmitButton = styled.button`
  padding: ${theme.spacing.md} ${theme.spacing.lg};
  background: ${theme.colors.primary};
  border: none;
  border-radius: ${theme.borders.radius.base};
  color: ${theme.colors.secondary};
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  cursor: pointer;
  margin-top: auto;
  transition: all ${theme.transitions.base};

  &:hover {
    opacity: 0.9;
  }

  &:active {
    transform: scale(0.95);
  }
`;
