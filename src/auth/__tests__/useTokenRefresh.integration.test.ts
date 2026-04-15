/**
 * Integration tests for token refresh with real Zooniverse OAuth tokens
 * 
 * These tests are OPTIONAL and only run when VITE_ZOONIVERSE_TEST_REFRESH_TOKEN is set.
 * They validate against the real Zooniverse OAuth server, unlike the unit tests which mock the server.
 * 
 * To run integration tests:
 * 
 * 1. Obtain a valid refresh token from Zooniverse:
 *    - Complete the OAuth login flow in the app
 *    - Check browser localStorage for 'zoo_tokens'
 *    - Copy the 'refresh_token' value
 * 
 * 2. Set environment variable (do NOT commit this):
 *    export VITE_ZOONIVERSE_TEST_REFRESH_TOKEN="your-real-refresh-token"
 * 
 * 3. Run integration tests:
 *    VITE_ZOONIVERSE_TEST_REFRESH_TOKEN="..." npm run test -- integration
 * 
 * Or use a .env.local file (git-ignored):
 *    VITE_ZOONIVERSE_TEST_REFRESH_TOKEN=<token>
 *    npm run test -- integration
 * 
 * Why these tests are optional:
 * - Require external service (Zooniverse) to be available
 * - Depend on test tokens that can't be committed
 * - Network-dependent (slower, non-deterministic)
 * - Can't test error conditions (can't force Zooniverse to return 401)
 * 
 * Unit tests (useTokenRefresh.test.ts) are the primary test suite.
 * Integration tests are supplemental validation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTokenRefresh } from '../useTokenRefresh';
import type { TokenSet } from '../tokenStore';

// Skip all tests if no test token provided
const TEST_REFRESH_TOKEN = import.meta.env.VITE_ZOONIVERSE_TEST_REFRESH_TOKEN;
const SKIP_INTEGRATION = !TEST_REFRESH_TOKEN;

describe.skipIf(SKIP_INTEGRATION)(
  'useTokenRefresh Integration Tests (Real Zooniverse)',
  { timeout: 30000 },
  () => {
    beforeEach(() => {
      vi.clearAllTimers();
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    });

    it('should refresh real Zooniverse token successfully', async () => {
      const mockToken: TokenSet = {
        access_token: 'placeholder', // Not used for refresh
        refresh_token: TEST_REFRESH_TOKEN!,
        expires_in: 3600,
      };

      const onTokenRefreshed = vi.fn();
      const onRefreshFailed = vi.fn();

      const { result } = renderHook(() =>
        useTokenRefresh(mockToken, {
          onTokenRefreshed,
          onRefreshFailed,
        })
      );

      let refreshResult = false;
      await act(async () => {
        refreshResult = await result.current.refreshToken();
      });

      // Should succeed
      expect(refreshResult).toBe(true);

      // Should call success callback with new token
      expect(onTokenRefreshed).toHaveBeenCalledTimes(1);
      const newToken = onTokenRefreshed.mock.calls[0][0] as TokenSet;

      // New token should have required fields
      expect(newToken).toHaveProperty('access_token');
      expect(newToken).toHaveProperty('refresh_token');
      expect(newToken).toHaveProperty('expires_in');
      expect(newToken.access_token).toBeTruthy();
      expect(newToken.refresh_token).toBeTruthy();

      // Should not call failure callback
      expect(onRefreshFailed).not.toHaveBeenCalled();

      console.log('✓ Token refreshed successfully');
      console.log(`  New access token: ${newToken.access_token.substring(0, 20)}...`);
      console.log(`  Expires in: ${newToken.expires_in}s`);
    });

    it('should handle refresh error gracefully (if token is revoked)', async () => {
      // This test only runs if token exists but may be revoked
      const mockToken: TokenSet = {
        access_token: 'placeholder',
        refresh_token: TEST_REFRESH_TOKEN!,
        expires_in: 3600,
      };

      const onTokenRefreshed = vi.fn();
      const onRefreshFailed = vi.fn();

      const { result } = renderHook(() =>
        useTokenRefresh(mockToken, {
          onTokenRefreshed,
          onRefreshFailed,
        })
      );

      let refreshResult = false;
      await act(async () => {
        refreshResult = await result.current.refreshToken();
      });

      // If token is valid, refresh succeeds
      // If token is revoked/expired, refresh fails and calls onRefreshFailed
      if (!refreshResult) {
        expect(onRefreshFailed).toHaveBeenCalled();
        expect(onTokenRefreshed).not.toHaveBeenCalled();
        console.log('✓ Token revoked/expired (as expected if using old token)');
      } else {
        expect(onTokenRefreshed).toHaveBeenCalled();
        console.log('✓ Token still valid and refreshed successfully');
      }
    });

    it('should validate token format after refresh', async () => {
      const mockToken: TokenSet = {
        access_token: 'placeholder',
        refresh_token: TEST_REFRESH_TOKEN!,
        expires_in: 3600,
      };

      const onTokenRefreshed = vi.fn();

      const { result } = renderHook(() =>
        useTokenRefresh(mockToken, {
          onTokenRefreshed,
        })
      );

      await act(async () => {
        await result.current.refreshToken();
      });

      if (onTokenRefreshed.mock.calls.length > 0) {
        const newToken = onTokenRefreshed.mock.calls[0][0] as TokenSet;

        // JWT tokens are typically: header.payload.signature (3 parts, 2 dots)
        const parts = newToken.access_token.split('.');
        expect(parts.length).toBe(3);
        console.log('✓ Access token has valid JWT format');

        // expires_in should be a positive number
        expect(newToken.expires_in).toBeGreaterThan(0);
        console.log(`✓ Expiry is valid: ${newToken.expires_in}s`);
      }
    });
  }
);

// Describe what to do if tests are skipped
describe.skipIf(!SKIP_INTEGRATION)(
  'useTokenRefresh Integration Tests (Skipped)',
  () => {
    it('skipped - no test token configured', () => {
      // This runs if SKIP_INTEGRATION is true
      console.log(
        'ℹ️  Integration tests skipped (VITE_ZOONIVERSE_TEST_REFRESH_TOKEN not set)'
      );
      console.log(
        'To run integration tests, see comments in useTokenRefresh.integration.test.ts'
      );
    });
  }
);
