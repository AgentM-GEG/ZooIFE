import { useUserStore } from '@/stores/userStore';
import { UserProfileContainer, Avatar, DefaultAvatar, DisplayName } from './styled';
import { DEFAULT_AVATAR_ICON_SIZE } from './constants';

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
            width={DEFAULT_AVATAR_ICON_SIZE}
            height={DEFAULT_AVATAR_ICON_SIZE}
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
