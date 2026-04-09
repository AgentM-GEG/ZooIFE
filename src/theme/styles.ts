import styled from 'styled-components';
import { theme } from '@/theme/zooniverseTheme';

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

/**
 * ButtonActive — Button with toggle/active state styling
 * Changes background and border based on $active prop
 * Used in tool palettes and selection controls
 */
export const ButtonActive = styled.button<{ $active?: boolean }>`
  padding: ${theme.spacing.sm} ${theme.spacing.lg};
  border: 1px solid ${(props) => props.$active ? theme.colors.primary : theme.colors.border};
  border-radius: ${theme.borders.radius.base};
  background: ${(props) => props.$active ? theme.colors.primary : theme.colors.secondary};
  color: ${(props) => props.$active ? theme.colors.secondary : theme.colors.text.inverse};
  cursor: pointer;
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  transition: all ${theme.transitions.base};
  text-align: left;
  width: 100%;

  &:hover:not(:disabled) {
    background: ${theme.colors.primary};
    color: ${theme.colors.secondary};
    border-color: ${theme.colors.primary};
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: ${theme.colors.secondary};
    color: ${theme.colors.neutral.dark};
    border-color: ${theme.colors.border};
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

// ============================================================================
// APP LAYOUT COMPONENTS
// ============================================================================

/**
 * AppContainer — Main app wrapper
 * Full viewport height with default background and typography
 */
export const AppContainer = styled.div`
  min-height: 100vh;
  background-color: ${theme.colors.background.default};
  color: ${theme.colors.text.primary};
  font-family: ${theme.typography.fontFamily};
  display: flex;
  flex-direction: column;
`;

/**
 * AppHeader — Main application header
 * Contains title, subtitle, and controls
 */
export const AppHeader = styled.header`
  padding: ${theme.spacing.lg};
  border-bottom: ${theme.borders.width.thin} solid ${theme.colors.border};
  background-color: ${theme.colors.secondary};
  color: ${theme.colors.text.inverse};
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
`;

/**
 * HeaderLeft — Left section of header (title/subtitle)
 */
export const HeaderLeft = styled.div`
  flex: 1;
`;

/**
 * HeaderTitle — Main header title
 */
export const HeaderTitle = styled.h1`
  margin: 0;
  font-size: ${theme.typography.heading.h2.fontSize};
  font-weight: ${theme.typography.fontWeight.medium};
`;

/**
 * HeaderSubtitle — Subtitle text under header title
 */
export const HeaderSubtitle = styled.p`
  margin: ${theme.spacing.xs} 0 ${theme.spacing.md};
  color: ${theme.colors.neutral.light};
  font-size: ${theme.typography.size.sm};
`;

/**
 * HeaderContent — Center section with controls
 */
export const HeaderContent = styled.div`
  display: flex;
  gap: ${theme.spacing.md};
  align-items: center;
`;

/**
 * HeaderRight — Right section (user controls)
 */
export const HeaderRight = styled.div`
  display: flex;
  align-items: center;
`;

/**
 * AppMain — Main content area
 * Flex layout with left/center/right sections
 */
export const AppMain = styled.main`
  display: flex;
  gap: ${theme.spacing.xl};
  padding: ${theme.spacing.xl};
  align-items: flex-start;
  flex: 1;
  overflow: hidden;
`;

/**
 * AppLeftAside — Left sidebar area
 * Constrained width with scroll capability
 */
export const AppLeftAside = styled.aside`
  flex-shrink: 0;
  width: 15%;
  min-width: 280px;
`;

/**
 * CanvasSection — Main canvas/content area
 * Scrollable with shadow and border
 */
export const CanvasSection = styled.section`
  flex: 1;
  min-width: 0;
  overflow: auto;
  max-height: calc(100vh - 120px);
  background-color: ${theme.colors.background.surface};
  border-radius: ${theme.borders.radius.lg};
  box-shadow: ${theme.shadows.sm};
`;

/**
 * AppRightAside — Right sidebar area
 * Fixed width for task sidebar
 */
export const AppRightAside = styled.aside`
  flex-shrink: 0;
  width: 320px;
`;
