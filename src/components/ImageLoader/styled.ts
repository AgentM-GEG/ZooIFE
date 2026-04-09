import styled from 'styled-components';
import { theme } from '@/theme/zooniverseTheme';

/**
 * Inline block container for the image loader button.
 */
export const Container = styled.div`
  display: inline-block;
`;

/**
 * Primary action button for loading next subject.
 * Secondary background with primary border, transitions to inverted on hover.
 */
export const Button = styled.button`
  padding: ${theme.spacing.sm} ${theme.spacing.lg};
  background: ${theme.colors.secondary};
  border: 1px solid ${theme.colors.primary};
  border-radius: ${theme.borders.radius.base};
  color: ${theme.colors.text.inverse};
  cursor: pointer;
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  transition: all ${theme.transitions.base};

  &:hover {
    background: ${theme.colors.primary};
    color: ${theme.colors.secondary};
  }

  &:active {
    transform: scale(0.95);
  }
`;

/**
 * Hidden file input for local image uploads.
 * Used with ref to trigger native file picker dialog.
 */
export const HiddenInput = styled.input`
  display: none;
`;
