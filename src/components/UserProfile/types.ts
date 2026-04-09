/**
 * User profile component types and interfaces
 */

export interface UserProfileProps {
  // Component is self-contained, no props required
}

export interface UserDisplayInfo {
  avatar_url?: string;
  display_name?: string;
  login: string;
}
