# Authentication System

This document describes the authentication layer for ZooIFE, which handles OAuth 2.0 authentication with Zooniverse, token management, refresh scheduling, and user details fetching.

## Overview

The authentication system provides:

- **OAuth 2.0 Flow** — Authorization Code grant with Zooniverse platform
- **Token Management** — Secure storage, expiry tracking, and refresh
- **Automatic Refresh** — Schedules token refresh before expiry with exponential backoff
- **User Details** — Fetches and caches user profile information
- **React Integration** — Context-based API for components

## Architecture

### Files

The auth folder contains four files:

#### `AuthContext.tsx`
Main authentication provider component. Manages OAuth flow, token state, refresh scheduling, and user data fetching.

**Responsibilities**:
- OAuth authorization request
- OAuth callback handling (code exchange)
- Token state management
- Token refresh scheduling
- User details fetching

#### `tokenStore.ts`
Token persistence layer. Handles localStorage caching, expiry tracking, and validity checks.

**Responsibilities**:
- Token storage/retrieval from localStorage
- Expiry timestamp tracking
- Token expiry validation
- Module-level token state

#### `useTokenRefresh.ts`
Custom React hook for token refresh logic. Extracted for modularity and reusability.

**Responsibilities**:
- Scheduling token refresh before expiry
- Refresh with exponential backoff retry
- Callback handling (success/failure)
- Timer cleanup

#### `constants.ts`
Centralized configuration constants. Makes OAuth endpoints, timeouts, and URLs configurable via environment variables.

**Responsibilities**:
- OAuth server endpoints
- Zooniverse OAuth configuration
- Token refresh settings (buffer, max retries)
- localStorage keys
- OAuth parameter names

## OAuth Flow

### 1. User Initiates Login

```typescript
const { login } = useAuth();
login();  // redirects to Zooniverse
```

**Process**:
1. Build authorization URL with client ID, redirect URI, requested scopes
2. Set `window.location.href` to Zooniverse OAuth authorize endpoint
3. User logs in to Zooniverse and grants permissions
4. Zooniverse redirects back to `http://localhost:5173/auth/callback?code=...`

### 2. OAuth Callback Handling

`AuthContext` automatically detects the `?code=` parameter:

```
Browser: http://localhost:5173/?code=ABC123
    ↓
AuthContext useEffect detects code query parameter
    ↓
POST /oauth/exchange to local OAuth server (port 8080)
    ↓
Server exchanges code for tokens
    ↓
Receives: { access_token, refresh_token, expires_in }
    ↓
Store in localStorage and React state
    ↓
Clean URL (window.history.replaceState)
```

**Code Exchange Endpoint** (local OAuth server):
- URL: `http://localhost:8080/oauth/exchange`
- Method: `POST`
- Body: `{ code: string }`
- Response: `{ access_token, refresh_token, expires_in }`

**Strict Mode Safety**: Uses `hasHandledCallback` ref to ensure code isn't exchanged twice when React Strict Mode replays the effect.

### 3. Token Storage

Tokens are stored in browser localStorage:

```typescript
// Storage key: 'zoo_tokens'
// Structure:
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "expires_in": 3600,
  "token_expires_at": 1723456789012  // timestamp in milliseconds
}
```

On app startup, tokens are auto-loaded from localStorage if valid (not expired).

## Token Refresh

### Automatic Refresh Scheduling

When a token is set with `expires_in`, `AuthContext` automatically schedules a refresh:

```
Token expires in: 3600 seconds (1 hour)
Refresh buffer: 300 seconds (5 minutes)
Refresh scheduled in: 3300 seconds (55 minutes)
    ↓
After 55 minutes, refresh triggers automatically
    ↓
POST /oauth/refresh with refresh_token
    ↓
Receive new access_token
    ↓
Store and reschedule next refresh
```

**Refresh Endpoint** (local OAuth server):
- URL: `http://localhost:8080/oauth/refresh`
- Method: `POST`
- Body: `{ refresh_token: string }`
- Response: `{ access_token, refresh_token, expires_in }`

### Refresh with Exponential Backoff

If refresh fails, it retries with exponential backoff:

```
Attempt 1: Immediate
    ↓ Fails
Attempt 2: Wait 1 second
    ↓ Fails
Attempt 3: Wait 2 seconds
    ↓ Fails after 3 total attempts
Logout user
```

Configuration in `constants.ts`:
```typescript
TOKEN_REFRESH = {
  BUFFER_SECONDS: 300,        // 5 minutes before expiry
  MAX_RETRIES: 3,             // 3 attempts total
  RETRY_DELAY_BASE_MS: 1000,  // 1 second base delay
}
```

## User Details Fetching

When token changes, user details are automatically fetched from Zooniverse:

```
Token state changes
    ↓
useEffect triggers
    ↓
Decode JWT to extract user ID
    ↓
POST /api/users/{userId} with bearer token
    ↓
Receive user profile
    ↓
Store in userStore (Zustand)
```

User data is cached in the `userStore` Zustand store and available via:

```typescript
const { user, loading, error } = useUserStore();
```

## Configuration

### Environment Variables

The auth system is configured via environment variables in `.env`:

```bash
# Zooniverse OAuth (from OAuth application registration)
VITE_REACT_APP_CLIENT_ID=your-client-id
VITE_OAUTH_REDIRECT_URI=http://localhost:5173/auth/callback

# OAuth server (local Python server)
VITE_OAUTH_SERVER_BASE=http://localhost:8080
```

### Configurable Constants

Edit `src/auth/constants.ts` to change:

```typescript
OAUTH_SERVER = {
  BASE_URL: 'http://localhost:8080',
  EXCHANGE_ENDPOINT: '/oauth/exchange',
  REFRESH_ENDPOINT: '/oauth/refresh',
}

ZOONIVERSE_OAUTH = {
  AUTHORIZE_URL: 'https://panoptes.zooniverse.org/oauth/authorize',
  CLIENT_ID: '...',
  REDIRECT_URI: 'http://localhost:5173/auth/callback',
  SCOPES: ['user', 'project', 'classification', 'subject'],
}

TOKEN_REFRESH = {
  BUFFER_SECONDS: 300,       // Refresh 5 min before expiry
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE_MS: 1000,
}
```

## Usage in Components

### Get Current Auth State

```typescript
import { useAuth } from '@/auth/AuthContext';

function MyComponent() {
  const { token, login, logout } = useAuth();
  
  if (!token) {
    return <button onClick={login}>Login</button>;
  }
  
  return (
    <div>
      Logged in as {token.access_token.substring(0, 20)}...
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### Get Access Token for API Calls

```typescript
const { token } = useAuth();

if (token?.access_token) {
  const user = await getUserDetails(userId, token.access_token);
}
```

### Get User Details

```typescript
import { useUserStore } from '@/stores/userStore';

function Profile() {
  const { user, loading, error } = useUserStore();
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return <div>Not logged in</div>;
  
  return <div>Welcome, {user.login}!</div>;
}
```

## Error Handling

### Token Refresh Failures

When token refresh fails after all retries:
1. `onRefreshFailed` callback is triggered
2. User is automatically logged out
3. Token and user details cleared from stores
4. Components re-render showing login prompt

### User Details Fetch Failures

If user details fail to load:
1. Error is caught and stored in userStore
2. User remains logged in (token valid)
3. Components can display error message
4. Retry will happen on next token change/refresh

### localStorage Issues

If localStorage fails (quota exceeded, private browsing):
1. `loadTokenFromStorage` catches error and logs it
2. Returns null (treated as not authenticated)
3. App works but tokens won't persist across page reloads

## Security Considerations

### Token Storage

- **XSS Vulnerability**: Tokens stored in localStorage can be accessed by malicious JavaScript
- **Mitigation**: Implement Content Security Policy (CSP) headers, sanitize user input
- **Alternative**: Could use HttpOnly cookies (requires server cooperation)

### Token Transmission

- **Bearer Token**: Tokens are sent in `Authorization: Bearer <token>` header
- **HTTPS Only**: In production, ensure all API calls use HTTPS
- **CORS**: Backend must trust the frontend origin

### Refresh Token

- **Long-lived**: Refresh tokens are valid for extended periods
- **Stored**: Stored in localStorage (same XSS risk as access token)
- **Rotation**: Zooniverse may rotate refresh tokens on use (recommended)

### OAuth Callback

- **Strict Mode Safe**: Uses ref guard to prevent double token exchange
- **State Parameter**: Current implementation doesn't use CSRF state parameter (should add for production)

## Refactoring Changes

### From Previous Implementation

The auth system was refactored to improve maintainability:

**Before**:
- Configuration magic strings scattered throughout AuthContext
- Token refresh logic mixed with component logic
- Difficult to reuse refresh logic in other components
- Hard to configure for different environments

**After**:
- All configuration in `constants.ts`
- Token refresh extracted to `useTokenRefresh` hook
- Easier to test, reuse, and modify
- Configurable via environment variables

### Key Improvements

1. **constants.ts** — Centralized configuration
   - No more magic strings in components
   - Configurable via environment variables
   - Easy to change endpoints, timeouts, etc.

2. **useTokenRefresh.ts** — Custom hook for refresh logic
   - Decoupled from AuthContext
   - Reusable in other contexts (e.g., multiple auth providers)
   - Easier to test in isolation
   - Clear callback-based API

3. **AuthContext.tsx** — Simplified to orchestration
   - Focuses on OAuth flow and state management
   - Uses useTokenRefresh for refresh logic
   - Uses tokenStore for persistence
   - Much smaller and easier to understand

4. **tokenStore.ts** — Uses constants
   - Uses STORAGE.TOKENS_KEY instead of hardcoded string
   - Makes storage configurable

## Future Enhancements

- [ ] Add CSRF state parameter to OAuth flow (security improvement)
- [ ] Implement HttpOnly cookie alternative for token storage
- [ ] Add logout confirmation dialog
- [ ] Implement silent token refresh (before expiry) in background
- [ ] Add multi-tab logout synchronization
- [ ] Support social login providers (providers other than Zooniverse)
- [ ] Add 2FA support if Zooniverse adds it
- [ ] Implement device code flow for CLI/mobile apps

## Testing

### Unit Testing useTokenRefresh

```typescript
import { renderHook, act } from '@testing-library/react';
import { useTokenRefresh } from '@/auth/useTokenRefresh';

it('schedules refresh before expiry', () => {
  const token = { 
    access_token: 'test',
    refresh_token: 'test',
    expires_in: 3600
  };
  
  const onTokenRefreshed = jest.fn();
  const { result } = renderHook(() => 
    useTokenRefresh(token, { onTokenRefreshed })
  );
  
  act(() => {
    result.current.scheduleRefresh(3600);
  });
  
  // Verify timer is set for 3300 seconds (3600 - 300 buffer)
});
```

### Integration Testing AuthProvider

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '@/auth/AuthContext';

it('exchanges code for tokens on callback', async () => {
  // Mock window.location.search to include code
  delete window.location;
  window.location = { search: '?code=ABC123' } as any;
  
  render(
    <AuthProvider>
      <TestComponent />
    </AuthProvider>
  );
  
  await waitFor(() => {
    expect(localStorage.getItem('zoo_tokens')).toBeTruthy();
  });
});
```

## Debugging

### Check Current Token

In browser console:
```javascript
// View stored token
JSON.parse(localStorage.getItem('zoo_tokens'))

// Check expiry
const token = JSON.parse(localStorage.getItem('zoo_tokens'));
const expiresAt = new Date(token.token_expires_at);
console.log('Expires at:', expiresAt);
console.log('Expires in:', (expiresAt - new Date()) / 1000, 'seconds');
```

### Enable Verbose Logging

AuthContext logs detailed messages with `[AuthContext]` prefix:
- Token loaded from localStorage
- Refresh scheduled
- Refresh succeeded
- Refresh failed with retry info
- Token exchange errors

Check browser DevTools Console for these logs.

### Simulate Token Expiry

In browser console:
```javascript
// Clear token to simulate logout
localStorage.removeItem('zoo_tokens')
// Refresh page
location.reload()
```

## References

- [OAuth 2.0 Authorization Code Flow](https://datatracker.ietf.org/doc/html/rfc6749#section-1.3.1)
- [Zooniverse API Documentation](https://panoptes.zooniverse.org/apidocs)
- [React Context API](https://react.dev/reference/react/useContext)
- [localStorage Security](https://owasp.org/www-community/attacks/xss/#stored-xss-attacks)
