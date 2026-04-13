import styled, { keyframes } from 'styled-components';
import { theme } from '@/theme/zooniverseTheme';

export const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

export const fadeOut = keyframes`
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
`;

export const Container = styled.div`
  background: ${theme.colors.secondary};
  border-radius: ${theme.borders.radius.lg};
  padding: ${theme.spacing.lg};
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 700px;
  min-height: 70vh;
  overflow: visible;
`;

export const CanvasWrapper = styled.div`
  width: 100%;
  height: auto;
  min-height: calc(70vh - 60px);
  max-height: calc(70vh - 60px);
  position: relative;
  overflow: hidden;
  background: ${theme.colors.background.surface};
  border-radius: ${theme.borders.radius.lg};
  display: block;
`;

export const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: calc(${theme.spacing.xs});
  margin-bottom: ${theme.spacing.md};
`;

export const ToolbarButton = styled.button<{ $active?: boolean }>`
  padding: 6px 12px;
  border: 1px solid ${(props) => props.$active ? theme.colors.primary : theme.colors.border};
  border-radius: ${theme.borders.radius.base};
  background: ${(props) => props.$active ? theme.colors.primary : theme.colors.secondary};
  color: ${(props) => props.$active ? theme.colors.secondary : theme.colors.text.inverse};
  cursor: pointer;
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  transition: all ${theme.transitions.base};

  &:hover:not(:disabled) {
    background: ${theme.colors.primary};
    color: ${theme.colors.secondary};
    border-color: ${theme.colors.primary};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const UndoButton = styled(ToolbarButton)`
  padding: 8px 16px;
  background: ${theme.colors.primary};
  color: ${theme.colors.secondary};
  border: none;
  border-radius: ${theme.borders.radius.base};
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  cursor: pointer;
  transition: all ${theme.transitions.base};

  &:hover {
    background: ${theme.colors.border};
    opacity: 0.8;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

export const RedoButton = styled(ToolbarButton)`
  padding: 8px 16px;
  background: ${theme.colors.primary};
  color: ${theme.colors.secondary};
  border: none;
  border-radius: ${theme.borders.radius.base};
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  cursor: pointer;
  transition: all ${theme.transitions.base};

  &:hover {
    background: ${theme.colors.border};
    opacity: 0.8;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

export const IdentifyButton = styled(ToolbarButton)`
  padding: 8px 16px;
  background: ${theme.colors.primary};
  color: ${theme.colors.secondary};
  border: none;
  border-radius: ${theme.borders.radius.base};
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  cursor: pointer;
  transition: all ${theme.transitions.base};

  &:hover {
    background: ${theme.colors.border};
    opacity: 0.8;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

export const ToolbarLabel = styled.span`
  font-size: ${theme.typography.size.sm};
  color: ${theme.colors.text.secondary};
  min-width: 48px;
  text-align: center;
`;

export const Placeholder = styled.div`
  width: 100%;
  height: calc(70vh - 60px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${theme.colors.background.surface};
  border-radius: ${theme.borders.radius.lg};
  color: ${theme.colors.text.secondary};
  font-size: ${theme.typography.size.base};
`;

export const DebugBanner = styled.div`
  background: ${theme.colors.error};
  color: ${theme.colors.text.inverse};
  padding: 6px 12px;
  border-radius: ${theme.borders.radius.base};
  margin-bottom: ${theme.spacing.md};
  font-size: ${theme.typography.size.sm};
`;

export const DebugImage = styled.img`
  max-width: 100%;
  max-height: 600px;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: ${theme.borders.radius.lg};
  border: 3px solid ${theme.colors.error};
  display: block;
`;

export const WarningBanner = styled.div<{ $isLeaving?: boolean }>`
  background: ${theme.colors.error};
  color: ${theme.colors.text.inverse};
  padding: 12px 16px;
  border-radius: ${theme.borders.radius.base};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  flex-wrap: wrap;
  position: absolute;
  bottom: ${theme.spacing.lg};
  right: ${theme.spacing.lg};
  max-width: 600px;
  z-index: 10;
  animation: ${(props) => props.$isLeaving ? fadeOut : fadeIn} 0.1s ease-in-out;
`;

export const WarningWrapper = styled.div`
  position: relative;
  width: 100%;
`;

export const MaskHistoryButtonsContainer = styled.div`
  position: relative;
  display: flex;
  margin-left: auto;
  gap: calc(${theme.spacing.sm} / 2);
  z-index: 20;
  transition: top 0.1s ease-out, right 0.1s ease-out;
`;

export const MarkingBanner = styled.div`
  background: ${theme.colors.secondary};
  color: ${theme.colors.text.inverse};
  border: 1px solid ${theme.colors.border};
  padding: 12px 16px;
  border-radius: ${theme.borders.radius.base};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  position: absolute;
  top: ${theme.spacing.lg};
  left: ${theme.spacing.lg};
  max-width: 400px;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  animation: ${fadeIn} 0.1s ease-in-out;
`;

export const SaveButton = styled.button`
  padding: 8px 16px;
  background: ${theme.colors.primary};
  color: ${theme.colors.secondary};
  border: none;
  border-radius: ${theme.borders.radius.base};
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  cursor: pointer;
  transition: all ${theme.transitions.base};

  &:hover {
    background: ${theme.colors.border};
    opacity: 0.8;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

export const DismissButton = styled.button`
  padding: 6px 14px;
  background: transparent;
  color: ${theme.colors.text.inverse};
  border: 1px solid ${theme.colors.text.inverse};
  border-radius: ${theme.borders.radius.base};
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  cursor: pointer;
  transition: all ${theme.transitions.base};
  flex-shrink: 0;
  white-space: nowrap;

  &:hover {
    background: ${theme.colors.text.inverse};
    color: ${theme.colors.error};
  }

  &:active {
    opacity: 0.8;
  }
`;

export const BackButton = styled.button`
  padding: 8px 16px;
  background: ${theme.colors.primary};
  color: ${theme.colors.secondary};
  border: none;
  border-radius: ${theme.borders.radius.base};
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  cursor: pointer;
  transition: all ${theme.transitions.base};

  &:hover {
    background: ${theme.colors.border};
    opacity: 0.8;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;
