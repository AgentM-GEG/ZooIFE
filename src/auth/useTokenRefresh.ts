/**
 * Custom hook for managing OAuth token refresh
 */
import { useRef, useCallback, useEffect } from 'react';
import { TOKEN_REFRESH, OAUTH_SERVER } from '@/auth/constants';
import type { TokenSet } from '@/auth/tokenStore';

interface UseTokenRefreshOptions {
  /** Called when token is successfully refreshed */
  onTokenRefreshed: (newToken: TokenSet) => void;
  /** Called when refresh fails after all retries */
  onRefreshFailed?: () => void;
}

/**
 * Custom hook for managing OAuth token refresh with exponential backoff retry.
 * Handles scheduling and executing token refresh operations.
 *
 * @param token - Current token, or null if not authenticated
 * @param options - Configuration callbacks
 * @returns Object with refresh scheduling functions
 */
export function useTokenRefresh(
  token: TokenSet | null,
  options: UseTokenRefreshOptions
) {
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRefreshingRef = useRef(false);
  const { onTokenRefreshed, onRefreshFailed } = options;

  /**
   * Refresh token with exponential backoff retry
   */
  const refreshToken = useCallback(
    async (retryCount = 0): Promise<boolean> => {
      // Skip if already refreshing
      if (isRefreshingRef.current) {
        console.log('[useTokenRefresh] Refresh already in progress, skipping');
        return false;
      }

      // Can't refresh without a refresh token
      if (!token?.refresh_token) {
        console.error('[useTokenRefresh] No refresh token available');
        if (retryCount === 0) onRefreshFailed?.();
        return false;
      }

      isRefreshingRef.current = true;

      try {
        const url = `${OAUTH_SERVER.BASE_URL}${OAUTH_SERVER.REFRESH_ENDPOINT}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: token.refresh_token }),
        });

        isRefreshingRef.current = false;

        if (!res.ok) {
          throw new Error(`Refresh failed with status ${res.status}`);
        }

        const newTokenSet = (await res.json()) as TokenSet;
        onTokenRefreshed(newTokenSet);
        console.log('[useTokenRefresh] Token refreshed successfully');
        return true;
      } catch (err) {
        isRefreshingRef.current = false;
        console.error(
          `[useTokenRefresh] Token refresh error (attempt ${retryCount + 1}/${TOKEN_REFRESH.MAX_RETRIES}):`,
          err
        );

        if (retryCount < TOKEN_REFRESH.MAX_RETRIES - 1) {
          // Retry with exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, retryCount) * TOKEN_REFRESH.RETRY_DELAY_BASE_MS;
          console.log(`[useTokenRefresh] Retrying refresh in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return refreshToken(retryCount + 1);
        } else {
          // All retries exhausted
          console.error(
            `[useTokenRefresh] Token refresh failed after ${TOKEN_REFRESH.MAX_RETRIES} attempts`
          );
          onRefreshFailed?.();
          return false;
        }
      }
    },
    [token, onTokenRefreshed, onRefreshFailed]
  );

  /**
   * Schedule token refresh before expiry
   */
  const scheduleRefresh = useCallback(
    (expiresIn: number) => {
      // Clear existing timer
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      const delaySeconds = Math.max(0, expiresIn - TOKEN_REFRESH.BUFFER_SECONDS);

      console.log(
        `[useTokenRefresh] Scheduling refresh in ${delaySeconds}s (token expires in ${expiresIn}s)`
      );

      if (delaySeconds <= 0) {
        // Token expires very soon or already expired, refresh immediately
        refreshToken();
      } else {
        // Schedule refresh at deadline
        refreshTimerRef.current = setTimeout(() => {
          console.log('[useTokenRefresh] Refresh deadline reached, refreshing token...');
          refreshToken();
        }, delaySeconds * 1000);
      }
    },
    [refreshToken]
  );

  /**
   * Cancel any pending refresh operations (cleanup on unmount or token change)
   */
  const cancelRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelRefresh();
    };
  }, [cancelRefresh]);

  return {
    scheduleRefresh,
    refreshToken,
    cancelRefresh,
  };
}
