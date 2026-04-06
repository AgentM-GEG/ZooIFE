export type TokenSet = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

let token: TokenSet | null = null;

/**
 * Set the stored authentication token.
 * @param t - TokenSet or null to clear the token
 */
export function setToken(t: TokenSet | null) {
  token = t;
}

/**
 * Get the currently stored authentication token.
 * @returns Stored TokenSet or null if not authenticated
 */
export function getToken() {
  return token;
}
