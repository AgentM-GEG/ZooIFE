import styled from 'styled-components';
import { theme } from './zooniverseTheme';

/**
 * Reusable styled components for the Zooniverse design system
 */

// ============================================================================
// BUTTONS
// ============================================================================

export const Button = styled.button`
  padding: ${theme.spacing.sm} ${theme.spacing.lg};
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  border: ${theme.borders.width.thin} solid transparent;
  border-radius: ${theme.borders.radius.base};
  cursor: pointer;
  transition: all ${theme.transitions.base};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.spacing.sm};
  white-space: nowrap;

  &:active {
    transform: scale(0.95);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const ButtonPrimary = styled(Button)`
  background-color: ${theme.colors.primary};
  color: ${theme.colors.text.inverse};
  border-color: ${theme.colors.primary};

  &:hover:not(:disabled) {
    background-color: ${theme.colors.primaryLight};
    border-color: ${theme.colors.primaryLight};
  }

  &:focus {
    outline: 2px solid ${theme.colors.primary};
    outline-offset: 2px;
  }
`;

export const ButtonSecondary = styled(Button)`
  background-color: transparent;
  color: ${theme.colors.primary};
  border-color: ${theme.colors.primary};

  &:hover:not(:disabled) {
    background-color: ${theme.colors.primaryLight};
    color: ${theme.colors.secondary};
  }

  &:focus {
    outline: 2px solid ${theme.colors.primary};
    outline-offset: 2px;
  }
`;

export const ButtonDanger = styled(Button)`
  background-color: ${theme.colors.error};
  color: ${theme.colors.text.inverse};
  border-color: ${theme.colors.error};

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:focus {
    outline: 2px solid ${theme.colors.error};
    outline-offset: 2px;
  }
`;

export const ButtonText = styled(Button)`
  background-color: transparent;
  color: ${theme.colors.primary};
  border: none;

  &:hover:not(:disabled) {
    color: ${theme.colors.secondary};
  }

  &:focus {
    outline: 2px solid ${theme.colors.primary};
    outline-offset: 2px;
  }
`;

// ============================================================================
// FORM ELEMENTS
// ============================================================================

export const Input = styled.input`
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  border: ${theme.borders.width.thin} solid ${theme.colors.border};
  border-radius: ${theme.borders.radius.sm};
  background-color: ${theme.colors.background.surface};
  color: ${theme.colors.text.primary};
  transition: all ${theme.transitions.base};

  &:focus {
    outline: none;
    border-color: ${theme.colors.primary};
    box-shadow: 0 0 0 3px ${theme.colors.primaryLight}80;
  }

  &:disabled {
    background-color: ${theme.colors.neutral.light};
    color: ${theme.colors.neutral.dark};
    cursor: not-allowed;
  }
`;

export const Select = styled.select`
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  border: ${theme.borders.width.thin} solid ${theme.colors.border};
  border-radius: ${theme.borders.radius.sm};
  background-color: ${theme.colors.background.surface};
  color: ${theme.colors.text.primary};
  cursor: pointer;
  transition: all ${theme.transitions.base};

  &:focus {
    outline: none;
    border-color: ${theme.colors.primary};
    box-shadow: 0 0 0 3px ${theme.colors.primaryLight}80;
  }

  &:disabled {
    background-color: ${theme.colors.neutral.light};
    color: ${theme.colors.neutral.dark};
    cursor: not-allowed;
  }
`;

export const TextArea = styled.textarea`
  padding: ${theme.spacing.md};
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  border: ${theme.borders.width.thin} solid ${theme.colors.border};
  border-radius: ${theme.borders.radius.sm};
  background-color: ${theme.colors.background.surface};
  color: ${theme.colors.text.primary};
  transition: all ${theme.transitions.base};
  resize: vertical;

  &:focus {
    outline: none;
    border-color: ${theme.colors.primary};
    box-shadow: 0 0 0 3px ${theme.colors.primaryLight}80;
  }

  &:disabled {
    background-color: ${theme.colors.neutral.light};
    color: ${theme.colors.neutral.dark};
    cursor: not-allowed;
  }
`;

export const Label = styled.label`
  display: block;
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  color: ${theme.colors.text.primary};
  margin-bottom: ${theme.spacing.xs};
`;

// ============================================================================
// CONTAINERS & LAYOUT
// ============================================================================

export const Card = styled.div`
  background-color: ${theme.colors.background.surface};
  border: ${theme.borders.width.thin} solid ${theme.colors.border};
  border-radius: ${theme.borders.radius.lg};
  padding: ${theme.spacing.lg};
  box-shadow: ${theme.shadows.sm};
  transition: all ${theme.transitions.base};

  &:hover {
    box-shadow: ${theme.shadows.md};
  }
`;

export const Container = styled.div`
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 ${theme.spacing.lg};
`;

export const Flex = styled.div<{ gap?: string; direction?: string; align?: string; justify?: string }>`
  display: flex;
  flex-direction: ${(props) => props.direction || 'row'};
  align-items: ${(props) => props.align || 'center'};
  justify-content: ${(props) => props.justify || 'flex-start'};
  gap: ${(props) => props.gap || theme.spacing.md};
`;

export const Grid = styled.div<{ columns?: number; gap?: string }>`
  display: grid;
  grid-template-columns: repeat(${(props) => props.columns || 1}, 1fr);
  gap: ${(props) => props.gap || theme.spacing.lg};
`;

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const Heading = styled.h1`
  font-family: ${theme.typography.fontFamily};
  font-weight: ${theme.typography.fontWeight.medium};
  color: ${theme.colors.text.primary};
  margin: 0;
  line-height: ${theme.typography.lineHeight.tight};
`;

export const Heading1 = styled(Heading)`
  font-size: ${theme.typography.heading.h1.fontSize};
  letter-spacing: ${theme.typography.heading.h1.letterSpacing};
`;

export const Heading2 = styled(Heading)`
  font-size: ${theme.typography.heading.h2.fontSize};
`;

export const Heading3 = styled(Heading)`
  font-size: ${theme.typography.heading.h3.fontSize};
`;

export const Heading4 = styled(Heading)`
  font-size: ${theme.typography.heading.h4.fontSize};
`;

export const Heading5 = styled(Heading)`
  font-size: ${theme.typography.heading.h5.fontSize};
`;

export const Heading6 = styled(Heading)`
  font-size: ${theme.typography.heading.h6.fontSize};
`;

export const Text = styled.p<{ size?: string; weight?: number; color?: string }>`
  font-family: ${theme.typography.fontFamily};
  font-size: ${(props) => props.size || theme.typography.size.base};
  font-weight: ${(props) => props.weight || theme.typography.fontWeight.regular};
  color: ${(props) => props.color || theme.colors.text.primary};
  margin: 0;
  line-height: ${theme.typography.lineHeight.normal};
`;

export const TextSmall = styled(Text)`
  font-size: ${theme.typography.size.sm};
  color: ${theme.colors.text.secondary};
`;

// ============================================================================
// PANELS & SIDEBARS
// ============================================================================

export const Panel = styled.div<{ bg?: string }>`
  background-color: ${(props) => props.bg || theme.colors.background.surface};
  border: ${theme.borders.width.thin} solid ${theme.colors.border};
  border-radius: ${theme.borders.radius.lg};
  padding: ${theme.spacing.lg};
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md};
`;

export const Sidebar = styled(Panel)<{ bg?: string }>`
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  min-width: 280px;
`;

export const PanelSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
`;

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

export const Badge = styled.span<{ variant?: 'success' | 'error' | 'warning' | 'info' }>`
  display: inline-flex;
  padding: ${theme.spacing.xs} ${theme.spacing.md};
  border-radius: ${theme.borders.radius.full};
  font-size: ${theme.typography.size.xs};
  font-weight: ${theme.typography.fontWeight.medium};
  background-color: ${(props) => {
    switch (props.variant) {
      case 'success':
        return theme.colors.success;
      case 'error':
        return theme.colors.error;
      case 'warning':
        return theme.colors.warning;
      case 'info':
        return theme.colors.info;
      default:
        return theme.colors.primary;
    }
  }};
  color: ${theme.colors.text.inverse};
`;

export const Divider = styled.hr`
  border: none;
  border-top: ${theme.borders.width.thin} solid ${theme.colors.border};
  margin: ${theme.spacing.md} 0;
`;

export const Spacer = styled.div<{ size?: string }>`
  height: ${(props) => props.size || theme.spacing.md};
`;
