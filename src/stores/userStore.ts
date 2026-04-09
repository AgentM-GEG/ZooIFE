import { create } from 'zustand';

/**
 * User profile details from Zooniverse Panoptes API.
 * Extended based on Panoptes user response schema.
 *
 * @see https://panoptes.zooniverse.org/api/users
 */
export interface UserDetails {
  /** Unique user ID from Panoptes */
  id: string;
  /** Username (unique login identifier) */
  login: string;
  /** Display name shown in UI */
  display_name: string;
  /** User's email address (if shared) */
  email?: string;
  /** Avatar image URL */
  avatar_url?: string;
  /** Name to appear on publications */
  credited_name?: string;
  /** User roles (admin, moderator, etc) */
  roles?: string[];
  /** Last update timestamp */
  updated_at?: string;
  /** Account creation timestamp */
  created_at?: string;
  /** Allow additional fields from API */
  [key: string]: unknown;
}

/**
 * State interface for user store
 */
interface UserState {
  /** Current logged-in user or null */
  user: UserDetails | null;
  /** Loading state for async operations */
  isLoading: boolean;
  /** Error message from last operation */
  error: string | null;

  // Actions
  /**
   * Set the current user
   * @param user User details object
   */
  setUser: (user: UserDetails) => void;
  /**
   * Set loading state
   * @param loading True if loading, false otherwise
   */
  setLoading: (loading: boolean) => void;
  /**
   * Set error message
   * @param error Error message or null to clear
   */
  setError: (error: string | null) => void;
  /**
   * Clear user and reset to initial state
   */
  clearUser: () => void;
}

/**
 * Global Zustand store for logged-in user details.
 *
 * Populated from Panoptes API after successful OAuth authentication.
 * Used by components to display user profile information and access control.
 *
 * @example
 * ```tsx
 * const { user, isLoading, setUser } = useUserStore();
 * ```
 */
export const useUserStore = create<UserState>((set) => ({
  user: null,
  isLoading: false,
  error: null,

  setUser: (user) => set({ user, error: null }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  clearUser: () => set({ user: null, error: null }),
}));
