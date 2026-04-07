import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useRef
} from "react";
import { setToken as storeToken, TokenSet, loadTokenFromStorage, clearStorage } from "@/auth/tokenStore";
import { getUserDetails } from "@/services/panoptesService";
import { useUserStore } from "@/stores/userStore";
import { decodeJWT } from "@/utils/jwt/jwt";


interface AuthContextValue {
  token: TokenSet | null;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  login: () => { },
  logout: () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<TokenSet | null>(null);

  // Prevent the OAuth callback effect from running twice (Strict Mode safe).
  const hasHandledCallback = useRef(false);

  // Track refresh timer and prevent concurrent refresh requests
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRefreshingRef = useRef(false);

  const CLIENT_ID = import.meta.env.VITE_REACT_APP_CLIENT_ID;

  // ----------------
  // Get user details
  // ----------------
  useEffect(() => {
    const fetchUserDetails = async () => {
      const decoded = decodeJWT(token?.access_token || "");
      const userId = decoded.payload?.data?.id?.toString();

      if (!token || !userId) {
        useUserStore.getState().clearUser();
        return;
      }

      try {
        useUserStore.getState().setLoading(true);
        const user = await getUserDetails(userId, token.access_token);
        console.log("User details fetched:", user);
        useUserStore.getState().setUser(user);
      } catch (err) {
        console.error("Failed to fetch user details:", err);
        useUserStore.getState().setError(
          err instanceof Error ? err.message : "Failed to fetch user details"
        );
      } finally {
        useUserStore.getState().setLoading(false);
      }
    };

    fetchUserDetails();
  }, [token]);

  // --------------------------------
  // Load token from storage on mount
  // --------------------------------
  useEffect(() => {
    const storedToken = loadTokenFromStorage();
    if (storedToken) {
      setToken(storedToken);
      console.log("[AuthContext] Token loaded from localStorage");
    }
  }, []);

  // --------------------------
  // Refresh token with retry
  // --------------------------
  const refreshToken = async (retryCount = 0): Promise<boolean> => {
    if (isRefreshingRef.current) {
      console.log("[AuthContext] Refresh already in progress, skipping");
      return false;
    }

    if (!token?.refresh_token) {
      console.error("[AuthContext] No refresh token available");
      return false;
    }

    isRefreshingRef.current = true;
    const maxRetries = 3;

    try {
      const res = await fetch("http://localhost:8080/oauth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: token.refresh_token })
      });

      isRefreshingRef.current = false;

      if (!res.ok) {
        throw new Error(`Refresh failed with status ${res.status}`);
      }

      const newTokenSet = await res.json() as TokenSet;
      setToken(newTokenSet);
      storeToken(newTokenSet);
      console.log(`[AuthContext] Token refreshed successfully`);
      return true;

    } catch (err) {
      isRefreshingRef.current = false;
      console.error(`[AuthContext] Token refresh error (attempt ${retryCount + 1}/${maxRetries}):`, err);

      if (retryCount < maxRetries - 1) {
        // Retry with exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`[AuthContext] Retrying refresh in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return refreshToken(retryCount + 1);
      } else {
        // All retries exhausted, logout
        console.error("[AuthContext] Token refresh failed after 3 attempts, logging out");
        logout();
        return false;
      }
    }
  };

  // ----------------------------------
  // Schedule refresh before expiry
  // ----------------------------------
  const scheduleRefresh = (expiresIn: number) => {
    // Clear existing timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    const REFRESH_BUFFER_SECONDS = 300; // 5 minutes before expiry
    const delaySeconds = Math.max(0, expiresIn - REFRESH_BUFFER_SECONDS);

    console.log(`[AuthContext] Scheduling refresh in ${delaySeconds}s (token expires in ${expiresIn}s)`);

    if (delaySeconds <= 0) {
      // Token expires very soon or already expired, refresh immediately
      refreshToken();
    } else {
      // Schedule refresh at deadline
      refreshTimerRef.current = setTimeout(() => {
        console.log("[AuthContext] Refresh deadline reached, refreshing token...");
        refreshToken();
      }, delaySeconds * 1000);
    }
  };

  // ---------------------------------
  // Setup refresh when token changes
  // ---------------------------------
  useEffect(() => {
    if (token?.expires_in) {
      scheduleRefresh(token.expires_in);
    }

    // Cleanup timer on unmount or token change
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [token?.access_token]); // Only re-schedule if access_token changes

  /**
   * Handle OAuth redirect: read ?code, exchange it, store tokens.
   * This MUST run exactly once even if React Strict Mode replays effects.
   */
  useEffect(() => {
    if (hasHandledCallback.current) return;   // <-- strict-mode guard
    hasHandledCallback.current = true;

    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");

    if (!code) return;

    (async () => {
      try {
        const res = await fetch("http://localhost:8080/oauth/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code })
        });

        const tokenSet = await res.json();

        setToken(tokenSet);
        storeToken(tokenSet);

        // Clean URL (remove ?code= )
        window.history.replaceState({}, "", "/");

      } catch (err) {
        console.error("Token exchange error:", err);
      }
    })();

  }, []); // <-- remains empty; guarded by hasHandledCallback

  /**
   * Initiates OAuth authorization request.
   */
  const login = () => {
    const authUrl = new URL("https://panoptes.zooniverse.org/oauth/authorize");

    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", "http://localhost:5173/auth/callback");
    authUrl.searchParams.set(
      "scope",
      "user project classification subject"
    );

    window.location.href = authUrl.toString();
  };

  const logout = () => {
    setToken(null);
    clearStorage();
    useUserStore.getState().clearUser();
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  };

  /**
   * Memoise the context value to avoid recalculating on every render.
   * login/logout are stable function identities — they do NOT need to be dependencies.
   */
  const value = useMemo(() => ({
    token,
    login,
    logout
  }), [token]);  // only re-memoise when token changes

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
