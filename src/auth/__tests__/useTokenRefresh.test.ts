/**
 * Unit tests for useTokenRefresh hook
 * 
 * These tests use MOCKED fetch and OAuth server to test the refresh logic
 * in isolation, ensuring all code paths work correctly.
 * 
 * For validation against real Zooniverse tokens, see:
 * useTokenRefresh.integration.test.ts (optional integration tests)
 * 
 * Unit tests are preferred because they:
 * - Don't depend on external services
 * - Run fast and deterministically
 * - Can test all error conditions (401, timeouts, retries, etc.)
 * - Work offline and in CI/CD without credentials
 * 
 * To run ONLY unit tests:
 *   npm run test -- useTokenRefresh.test.ts
 * 
 * To run unit + integration tests:
 *   VITE_ZOONIVERSE_TEST_REFRESH_TOKEN="..." npm run test
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTokenRefresh } from '../useTokenRefresh';
import { TOKEN_REFRESH } from '../constants';
import type { TokenSet } from '../tokenStore';

// Mock fetch globally
const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

// Mock console methods to avoid noise in test output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeEach(() => {
  console.log = vi.fn();
  console.error = vi.fn();
  vi.clearAllTimers();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  fetchMock.mockClear();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

const mockTokenSet: TokenSet = {
  access_token: 'mock_access_token',
  refresh_token: 'mock_refresh_token',
  expires_in: 3600,
};

const mockRefreshedTokenSet: TokenSet = {
  access_token: 'new_access_token',
  refresh_token: 'new_refresh_token',
  expires_in: 3600,
};

describe('useTokenRefresh', { timeout: 30000 }, () => {
  describe('refreshToken', () => {
    it('should successfully refresh token', async () => {
      const onTokenRefreshed = vi.fn();
      const mockResponse = { ok: true, json: () => Promise.resolve(mockRefreshedTokenSet) };
      fetchMock.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() =>
        useTokenRefresh(mockTokenSet, { onTokenRefreshed })
      );

      let refreshResult = false;
      await act(async () => {
        refreshResult = await result.current.refreshToken();
      });

      expect(refreshResult).toBe(true);
      expect(onTokenRefreshed).toHaveBeenCalledWith(mockRefreshedTokenSet);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:8080/oauth/refresh',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: mockTokenSet.refresh_token }),
        })
      );
    });

    it('should retry with exponential backoff on failure', async () => {
      const onTokenRefreshed = vi.fn();
      const mockError = new Error('Network error');

      // First two calls fail, third succeeds
      fetchMock
        .mockRejectedValueOnce(mockError)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockRefreshedTokenSet) });

      const { result } = renderHook(() =>
        useTokenRefresh(mockTokenSet, { onTokenRefreshed })
      );

      let refreshResult = false;
      await act(async () => {
        const promise = result.current.refreshToken();
        // Advance through retry delays: 1s + 2s + fetch time
        await vi.advanceTimersByTimeAsync(100);
        await vi.advanceTimersByTimeAsync(1000);
        await vi.advanceTimersByTimeAsync(100);
        await vi.advanceTimersByTimeAsync(2000);
        await vi.advanceTimersByTimeAsync(100);
        refreshResult = await promise;
      });

      expect(refreshResult).toBe(true);
      expect(onTokenRefreshed).toHaveBeenCalledWith(mockRefreshedTokenSet);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('should call onRefreshFailed after max retries exceeded', async () => {
      const onTokenRefreshed = vi.fn();
      const onRefreshFailed = vi.fn();
      const mockError = new Error('Network error');

      // All calls fail
      fetchMock.mockRejectedValue(mockError);

      const { result } = renderHook(() =>
        useTokenRefresh(mockTokenSet, { onTokenRefreshed, onRefreshFailed })
      );

      let refreshResult = false;
      await act(async () => {
        const promise = result.current.refreshToken();
        // Advance through retry delays
        await vi.advanceTimersByTimeAsync(1000);
        await vi.advanceTimersByTimeAsync(2000);
        await vi.advanceTimersByTimeAsync(4000);
        refreshResult = await promise;
      });

      expect(refreshResult).toBe(false);
      expect(onRefreshFailed).toHaveBeenCalledTimes(1);
      expect(onTokenRefreshed).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(TOKEN_REFRESH.MAX_RETRIES);
    });

    it('should not refresh if no refresh token available', async () => {
      const onTokenRefreshed = vi.fn();
      const onRefreshFailed = vi.fn();

      const { result } = renderHook(() =>
        useTokenRefresh(null, { onTokenRefreshed, onRefreshFailed })
      );

      let refreshResult = false;
      await act(async () => {
        refreshResult = await result.current.refreshToken();
      });

      expect(refreshResult).toBe(false);
      expect(onRefreshFailed).toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should prevent concurrent refresh attempts', async () => {
      const onTokenRefreshed = vi.fn();
      let resolveFirstFetch: any;
      const firstFetchPromise = new Promise((resolve) => {
        resolveFirstFetch = resolve;
      });

      fetchMock.mockReturnValueOnce(firstFetchPromise);

      const { result } = renderHook(() =>
        useTokenRefresh(mockTokenSet, { onTokenRefreshed })
      );

      let firstRefresh: any;
      let secondRefresh: any;

      await act(async () => {
        firstRefresh = result.current.refreshToken();
        // Try to refresh again before first finishes
        secondRefresh = result.current.refreshToken();
      });

      // Resolve first fetch
      resolveFirstFetch({ ok: true, json: () => Promise.resolve(mockRefreshedTokenSet) });

      const firstResult = await firstRefresh;
      const secondResult = await secondRefresh;

      expect(firstResult).toBe(true);
      expect(secondResult).toBe(false); // Second call should be skipped
      expect(fetchMock).toHaveBeenCalledTimes(1); // Only one fetch should occur
    });

    it('should handle refresh errors with non-ok response', async () => {
      const onTokenRefreshed = vi.fn();
      const onRefreshFailed = vi.fn();

      const mockResponse = { ok: false, status: 401 };
      fetchMock
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() =>
        useTokenRefresh(mockTokenSet, { onTokenRefreshed, onRefreshFailed })
      );

      let refreshResult = false;
      await act(async () => {
        const promise = result.current.refreshToken();
        // Advance through retry delays
        await vi.advanceTimersByTimeAsync(1000);
        await vi.advanceTimersByTimeAsync(2000);
        await vi.advanceTimersByTimeAsync(4000);
        refreshResult = await promise;
      });

      expect(refreshResult).toBe(false);
      expect(onRefreshFailed).toHaveBeenCalled();
      expect(onTokenRefreshed).not.toHaveBeenCalled();
    });
  });

  describe('scheduleRefresh', () => {
    it('should schedule refresh before token expiry', async () => {
      const onTokenRefreshed = vi.fn();
      const mockResponse = { ok: true, json: () => Promise.resolve(mockRefreshedTokenSet) };
      fetchMock.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() =>
        useTokenRefresh(mockTokenSet, { onTokenRefreshed })
      );

      const expiresIn = 3600; // 1 hour
      const expectedDelay = (expiresIn - TOKEN_REFRESH.BUFFER_SECONDS) * 1000; // 5 minutes before expiry

      await act(async () => {
        result.current.scheduleRefresh(expiresIn);
      });

      // Fast-forward to refresh deadline
      await act(async () => {
        vi.advanceTimersByTime(expectedDelay);
      });

      // Give fetch time to complete
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(fetchMock).toHaveBeenCalled();
      expect(onTokenRefreshed).toHaveBeenCalledWith(mockRefreshedTokenSet);
    });

    it('should refresh immediately if token expires soon', async () => {
      const onTokenRefreshed = vi.fn();
      const mockResponse = { ok: true, json: () => Promise.resolve(mockRefreshedTokenSet) };
      fetchMock.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() =>
        useTokenRefresh(mockTokenSet, { onTokenRefreshed })
      );

      await act(async () => {
        // Token expires in 60 seconds (less than 5-minute buffer)
        result.current.scheduleRefresh(60);
        // Give time for immediate refresh to execute
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(fetchMock).toHaveBeenCalled();
      expect(onTokenRefreshed).toHaveBeenCalledWith(mockRefreshedTokenSet);
    });

    it('should clear previous timer when scheduling new refresh', async () => {
      const onTokenRefreshed = vi.fn();
      const mockResponse = { ok: true, json: () => Promise.resolve(mockRefreshedTokenSet) };
      fetchMock.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() =>
        useTokenRefresh(mockTokenSet, { onTokenRefreshed })
      );

      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

      await act(async () => {
        result.current.scheduleRefresh(3600);
        result.current.scheduleRefresh(7200); // Schedule again
      });

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('cancelRefresh', () => {
    it('should cancel pending refresh', async () => {
      fetchMock.mockClear();
      const onTokenRefreshed = vi.fn();
      const mockResponse = { ok: true, json: () => Promise.resolve(mockRefreshedTokenSet) };
      fetchMock.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() =>
        useTokenRefresh(mockTokenSet, { onTokenRefreshed })
      );

      await act(async () => {
        // Schedule refresh in 1 hour
        result.current.scheduleRefresh(3600);
        // Immediately cancel before time advances
        result.current.cancelRefresh();
        // Now advance time past when refresh would have fired
        vi.advanceTimersByTime(1000 * 3600);
      });

      // Fetch should not be called since we cancelled
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should cleanup on unmount', async () => {
      const onTokenRefreshed = vi.fn();
      const mockResponse = { ok: true, json: () => Promise.resolve(mockRefreshedTokenSet) };
      fetchMock.mockResolvedValueOnce(mockResponse);

      const { result, unmount } = renderHook(() =>
        useTokenRefresh(mockTokenSet, { onTokenRefreshed })
      );

      await act(async () => {
        result.current.scheduleRefresh(3600);
      });

      unmount();

      // Advance past the scheduled refresh time
      await act(async () => {
        vi.advanceTimersByTime(1000 * 3600);
      });

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle JSON parsing error gracefully', async () => {
      fetchMock.mockReset();
      const onTokenRefreshed = vi.fn();
      const onRefreshFailed = vi.fn();

      // Mock json parsing error - first attempt fails to parse JSON
      fetchMock.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      }));
      // Retry attempts also fail
      fetchMock.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      }));
      fetchMock.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      }));

      const { result } = renderHook(() =>
        useTokenRefresh(mockTokenSet, { onTokenRefreshed, onRefreshFailed })
      );

      await act(async () => {
        const promise = result.current.refreshToken();
        // Allow time for all retry attempts with exponential backoff
        await vi.advanceTimersByTimeAsync(10000);
        await promise;
      });

      // Should not succeed in getting token
      expect(onTokenRefreshed).not.toHaveBeenCalled();
      // Fetch should be attempted 3 times (1 initial + 2 retries)
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('should handle network timeout', async () => {
      fetchMock.mockReset();
      const onTokenRefreshed = vi.fn();
      const onRefreshFailed = vi.fn();

      const timeoutError = new Error('Network timeout');
      // All attempts timeout
      fetchMock.mockImplementationOnce(async () => {
        throw timeoutError;
      });
      fetchMock.mockImplementationOnce(async () => {
        throw timeoutError;
      });
      fetchMock.mockImplementationOnce(async () => {
        throw timeoutError;
      });

      const { result } = renderHook(() =>
        useTokenRefresh(mockTokenSet, { onTokenRefreshed, onRefreshFailed })
      );

      await act(async () => {
        const promise = result.current.refreshToken();
        // Allow time for retries with backoff
        await vi.advanceTimersByTimeAsync(10000);
        await promise;
      });

      // Should not succeed
      expect(onTokenRefreshed).not.toHaveBeenCalled();
      // Fetch should be attempted 3 times
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('should use correct exponential backoff delays', async () => {
      const onTokenRefreshed = vi.fn();
      const onRefreshFailed = vi.fn();
      const delayedError = new Error('Network error');

      fetchMock
        .mockRejectedValueOnce(delayedError)
        .mockRejectedValueOnce(delayedError)
        .mockRejectedValueOnce(delayedError);

      const { result } = renderHook(() =>
        useTokenRefresh(mockTokenSet, { onTokenRefreshed, onRefreshFailed })
      );

      await act(async () => {
        const promise = result.current.refreshToken();
        // Advance through retries: 1s, 2s, 4s = 7 seconds total
        await vi.advanceTimersByTimeAsync(1000);
        await vi.advanceTimersByTimeAsync(2000);
        await vi.advanceTimersByTimeAsync(4000);
        await promise;
      });

      expect(fetchMock).toHaveBeenCalledTimes(TOKEN_REFRESH.MAX_RETRIES);
    });

    it('should use environment-configured base URL', async () => {
      fetchMock.mockReset();
      fetchMock.mockResolvedValueOnce({ 
        ok: true, 
        json: async () => mockRefreshedTokenSet 
      });

      const onTokenRefreshed = vi.fn();
      const { result } = renderHook(() =>
        useTokenRefresh(mockTokenSet, { onTokenRefreshed })
      );

      await act(async () => {
        await result.current.refreshToken();
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const fetchCall = fetchMock.mock.calls[0];
      expect(fetchCall[0]).toMatch(/oauth\/refresh$/);
      expect(onTokenRefreshed).toHaveBeenCalled();
    });
  });
});
