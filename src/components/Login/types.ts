/**
 * Login component types and interfaces
 */

export interface LoginProps {
  // Component is self-contained, no props required
}

export interface AuthState {
  token?: string | null;
  login: () => void;
  logout: () => void;
}
