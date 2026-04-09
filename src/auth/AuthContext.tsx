import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useRef
} from "react";
import { setToken as storeToken, TokenSet, loadTokenFromStorage, clearStorage } from "@/auth/tokenStore";
import { useTokenRefresh } from "@/auth/useTokenRefresh";
import { OAUTH_SERVER, ZOONIVERSE_OAUTH, OAUTH_PARAMS } from "@/auth/constants";
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
        useUserStore.getState().setUser(user as any);  // API type not strictly typed
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
  // Setup token refresh
  // --------------------------
  const { scheduleRefresh } = useTokenRefresh(
    token,
    {
      onTokenRefreshed: (newToken: TokenSet) => {
        setToken(newToken);
        storeToken(newToken);
      },
      onRefreshFailed: () => {
        // Refresh failed after all retries; logout user
        logout();
      },
    }
  );

  // Schedule refresh when token changes
  useEffect(() => {
    if (token?.expires_in) {
      scheduleRefresh(token.expires_in);
    }
  }, [token?.access_token, scheduleRefresh]);

  /**
   * Handle OAuth redirect: read ?code, exchange it, store tokens.
   * This MUST run exactly once even if React Strict Mode replays effects.
   */
  useEffect(() => {
    if (hasHandledCallback.current) return;   // <-- strict-mode guard
    hasHandledCallback.current = true;

    const url = new URL(window.location.href);
    const code = url.searchParams.get(OAUTH_PARAMS.CODE);

    if (!code) return;

    (async () => {
      try {
        const exchangeUrl = `${OAUTH_SERVER.BASE_URL}${OAUTH_SERVER.EXCHANGE_ENDPOINT}`;
        const res = await fetch(exchangeUrl, {
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
    const authUrl = new URL(ZOONIVERSE_OAUTH.AUTHORIZE_URL);

    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", ZOONIVERSE_OAUTH.CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", ZOONIVERSE_OAUTH.REDIRECT_URI);
    authUrl.searchParams.set(
      "scope",
      ZOONIVERSE_OAUTH.SCOPES.join(" ")
    );

    window.location.href = authUrl.toString();
  };

  const logout = () => {
    setToken(null);
    clearStorage();
    useUserStore.getState().clearUser();
  };

  /**
   * Memoize the context value to avoid recalculating on every render.
   * login/logout are stable function identities — they do NOT need to be dependencies.
   */
  const value = useMemo(() => ({
    token,
    login,
    logout
  }), [token]);  // only re-memoize when token changes

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
