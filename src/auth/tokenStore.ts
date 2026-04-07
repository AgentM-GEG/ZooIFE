export type TokenSet = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

type StoredTokenSet = TokenSet & {
  token_expires_at?: number; // timestamp when token expires
};

const STORAGE_KEY = "zoo_tokens";

let token: TokenSet | null = null;
let tokenExpiresAt: number = 0; // timestamp in milliseconds

/**
 * Set the stored authentication token and persist to localStorage.
 * @param t - TokenSet or null to clear the token
 */
export function setToken(t: TokenSet | null) {
  token = t;

  if (t && t.expires_in) {
    // Calculate when token expires (current time + expires_in seconds)
    tokenExpiresAt = Date.now() + t.expires_in * 1000;
  } else {
    tokenExpiresAt = 0;
  }

  // Persist to localStorage
  if (t) {
    const stored: StoredTokenSet = {
      ...t,
      token_expires_at: tokenExpiresAt,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * Get the currently stored authentication token.
 * @returns Stored TokenSet or null if not authenticated
 */
export function getToken() {
  return token;
}

/**
 * Load token from localStorage (called on app startup).
 * @returns Stored TokenSet or null if nothing in storage
 */
export function loadTokenFromStorage(): TokenSet | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as StoredTokenSet;
    const expiresAt = parsed.token_expires_at;

    // Check if token has expired
    if (expiresAt && Date.now() > expiresAt) {
      // Token expired; clear storage
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    // Token is valid; update module-level state
    const tokenSet: TokenSet = {
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
      expires_in: parsed.expires_in,
    };
    token = tokenSet;
    tokenExpiresAt = expiresAt || 0;
    return tokenSet;
  } catch (err) {
    console.error("Failed to load token from storage:", err);
    return null;
  }
}

/**
 * Get seconds until token expiry, or 0 if already expired.
 * @returns Seconds until expiry, or 0 if no token or expired
 */
export function getTokenExpiry(): number {
  if (!tokenExpiresAt || Date.now() >= tokenExpiresAt) {
    return 0;
  }
  return Math.floor((tokenExpiresAt - Date.now()) / 1000);
}

/**
 * Clear stored token (used on logout).
 */
export function clearStorage() {
  token = null;
  tokenExpiresAt = 0;
  localStorage.removeItem(STORAGE_KEY);
}

