/**
 * Standard JWT header structure.
 */
interface JWTHeader {
  alg: string;
  typ: string;
  [key: string]: unknown;
}

/**
 * Zooniverse JWT payload structure.
 */
interface ZooniverseJWTPayload {
  data?: {
    id?: string | number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface DecodedJWT {
  header: JWTHeader;
  payload: ZooniverseJWTPayload;
  signature: string;
}

export function decodeJWT(token: string): DecodedJWT {
  if (!token) {
    return {
      header: { alg: "", typ: "" },
      payload: {},
      signature: ""
    };
  }
  const [header, payload, signature] = token.split('.');

  const decode = (seg: string) =>
    JSON.parse(atob(seg.replace(/-/g, '+').replace(/_/g, '/')));

  return {
    header: decode(header),
    payload: decode(payload),
    signature
  };
}