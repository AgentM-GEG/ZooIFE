export type TokenSet = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

let token: TokenSet | null = null;

export function setToken(t: TokenSet | null) {
  token = t;
}

export function getToken() {
  return token;
}
