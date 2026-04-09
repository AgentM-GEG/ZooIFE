/**
 * Authentication configuration and constants
 */

/**
 * OAuth server endpoints (local development server)
 */
export const OAUTH_SERVER = {
  BASE_URL: import.meta.env.VITE_OAUTH_SERVER_BASE || 'http://localhost:8080',
  EXCHANGE_ENDPOINT: '/oauth/exchange',
  REFRESH_ENDPOINT: '/oauth/refresh',
} as const;

/**
 * Zooniverse OAuth endpoints
 */
export const ZOONIVERSE_OAUTH = {
  AUTHORIZE_URL: 'https://panoptes.zooniverse.org/oauth/authorize',
  CLIENT_ID: import.meta.env.VITE_REACT_APP_CLIENT_ID,
  REDIRECT_URI: import.meta.env.VITE_OAUTH_REDIRECT_URI || 'http://localhost:5173/auth/callback',
  SCOPES: ['user', 'project', 'classification', 'subject'],
} as const;

/**
 * Token refresh configuration
 */
export const TOKEN_REFRESH = {
  /** Time before expiry to trigger refresh (in seconds) */
  BUFFER_SECONDS: 300, // 5 minutes
  /** Maximum retry attempts for failed refresh */
  MAX_RETRIES: 3,
  /** Base delay for exponential backoff (in milliseconds) */
  RETRY_DELAY_BASE_MS: 1000,
} as const;

/**
 * localStorage configuration
 */
export const STORAGE = {
  TOKENS_KEY: 'zoo_tokens',
} as const;

/**
 * Query parameter names for OAuth flow
 */
export const OAUTH_PARAMS = {
  CODE: 'code',
  STATE: 'state',
  ERROR: 'error',
  ERROR_DESCRIPTION: 'error_description',
} as const;
