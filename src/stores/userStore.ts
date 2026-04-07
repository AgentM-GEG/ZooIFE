import { create } from 'zustand';

/**
 * User profile details from Zooniverse Panoptes API.
 * Extended based on Panoptes user response schema.
 */
export interface UserDetails {
  id: string;
  login: string;
  display_name: string;
  email?: string;
  avatar_url?: string;
  credited_name?: string;
  roles?: string[];
  updated_at?: string;
  created_at?: string;
  [key: string]: unknown; // Allow additional fields from API
}

interface UserState {
  user: UserDetails | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: UserDetails) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearUser: () => void;
}

/**
 * Global Zustand store for logged-in user details.
 * Populated from Panoptes API after successful authentication.
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
