import styled from 'styled-components';
import { theme } from '@/theme/zooniverseTheme';

export const UserProfileContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
`;

export const Avatar = styled.img`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid ${theme.colors.text.inverse};
`;

export const DefaultAvatar = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid ${theme.colors.text.inverse};
  background-color: ${theme.colors.neutral.dark};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  svg {
    width: 20px;
    height: 20px;
    color: ${theme.colors.text.inverse};
  }
`;

export const DisplayName = styled.span`
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  color: ${theme.colors.text.inverse};
  white-space: nowrap;
`;
