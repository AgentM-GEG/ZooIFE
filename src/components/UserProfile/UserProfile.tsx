import styled from 'styled-components';
import { useUserStore } from '@/stores/userStore';
import { theme } from '@/theme/zooniverseTheme';

const UserProfileContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
`;

const Avatar = styled.img`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid ${theme.colors.text.inverse};
`;

const DefaultAvatar = styled.div`
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

const DisplayName = styled.span`
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  color: ${theme.colors.text.inverse};
  white-space: nowrap;
`;

/**
 * Displays the logged-in user's profile info in the header.
 * Shows avatar (if available) and display name.
 * Falls back to a default user icon if no avatar_url provided.
 */
export function UserProfile() {
  const { user, isLoading } = useUserStore();

  if (!user || isLoading) {
    return null;
  }

  return (
    <UserProfileContainer>
      {user.avatar_url ? (
        <Avatar
          src={user.avatar_url}
          alt={user.display_name || user.login}
          title={user.display_name || user.login}
        />
      ) : (
        <DefaultAvatar title={user.display_name || user.login}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </DefaultAvatar>
      )}
      <DisplayName>{user.display_name || user.login}</DisplayName>
    </UserProfileContainer>
  );
}
