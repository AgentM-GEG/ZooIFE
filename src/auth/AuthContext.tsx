import React, { createContext, useContext, useEffect, useState } from "react";
import { setToken as storeToken } from "./tokenStore";

interface TokenSet {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

interface AuthContextValue {
  token: TokenSet | null;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  login: () => {},
  logout: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<TokenSet | null>(null);

  // Parse token from URL fragment on /auth/callback
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#token=")) {
      const base64 = hash.replace("#token=", "");
      try {
        const decoded = JSON.parse(
          atob(base64.replace(/-/g, "+").replace(/_/g, "/"))
        );
        setToken(decoded);
        storeToken(decoded);
      } catch (e) {
        console.error("Token parse error", e);
      }

      // Clean up URL
      window.history.replaceState({}, "", "/");
    }
  }, []);

  const login = () => {
    window.location.href = "http://localhost:8080/auth-start";
  };

  const logout = () => {
    setToken(null);
    storeToken(null);
  }

  return (
    <AuthContext.Provider value={{ token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);