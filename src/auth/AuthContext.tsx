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
  login: () => { },
  logout: () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<TokenSet | null>(null);

  const REACT_APP_CLIENT_ID = import.meta.env.VITE_REACT_APP_CLIENT_ID ?? undefined;


  // // Parse token from URL fragment on /auth/callback
  // useEffect(() => {
  //   const hash = window.location.hash;
  //   if (hash.startsWith("#token=")) {
  //     const base64 = hash.replace("#token=", "");
  //     try {
  //       const decoded = JSON.parse(
  //         atob(base64.replace(/-/g, "+").replace(/_/g, "/"))
  //       );
  //       setToken(decoded);
  //       storeToken(decoded);
  //     } catch (e) {
  //       console.error("Token parse error", e);
  //     }

  //     // Clean up URL
  //     window.history.replaceState({}, "", "/");
  //   }
  // }, []);

  useEffect(() => {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");

  if (!code) return;

  fetch("http://localhost:8080/oauth/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  })
    .then(res => res.json())
    .then(tokenSet => {
      setToken(tokenSet);
      storeToken(tokenSet);

      window.history.replaceState({}, "", "/");
    })
    .catch(err => console.error("Token exchange error:", err));
}, []);

  const login = () => {
    const authUrl = new URL("https://panoptes.zooniverse.org/oauth/authorize");

    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", REACT_APP_CLIENT_ID!);
    authUrl.searchParams.set("redirect_uri", "http://localhost:5173/auth/callback");
    authUrl.searchParams.set(
      "scope",
      "user project classification subject"
    );

    console.log(authUrl.toString());
    

    window.location.href = authUrl.toString();
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