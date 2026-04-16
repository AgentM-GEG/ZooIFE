/**
 * Generic API client wrapper for Zooniverse endpoints.
 * Eliminates repetitive fetch/error handling boilerplate.
 */

/**
 * API call options
 */
interface ApiOptions {
  token?: string;
  staging?: boolean;
  method?: string;
  body?: unknown;
}

/**
 * Make an authenticated API call to a Zooniverse endpoint.
 * Handles headers, error responses, and JSON parsing consistently.
 *
 * @template T - Response data type
 * @param baseUrl - API base URL (production or staging)
 * @param endpoint - Relative endpoint path (e.g., '/subjects/queued')
 * @param options - Request options (token, staging, method, body)
 * @returns Promise resolving to parsed response data
 * @throws Error with context if request fails or response is not OK
 */
export async function apiCall<T>(
  baseUrl: string,
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { token, method = 'GET', body } = options;

  const headers: HeadersInit = {
    // keep server-side response negotiation/versioning
    Accept: 'application/vnd.api+json; version=1',

    // ensure Rails parses the request body into params
    'Content-Type': method === 'GET' || method === 'HEAD'
      ? 'application/vnd.api+json; version=1'   // doesn’t matter much for GET, but ok
      : 'application/json',                     // or 'application/vnd.api+json'
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const url = `${baseUrl}${endpoint}`;

  try {
    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      let errorDetail: string;
      try {
        const errorData = await response.json();
        errorDetail = errorData.detail ?? errorData.error ?? `HTTP ${response.status}`;
      } catch {
        errorDetail = `HTTP ${response.status}`;
      }
      throw new Error(`${method} ${endpoint} failed: ${errorDetail}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`API call failed: ${String(error)}`);
  }
}

/**
 * Build query parameters string for API endpoints.
 * @param params - Object with parameter key-value pairs
 * @returns URL search params string
 */
export function buildQueryString(params: Record<string, string | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, value);
    }
  }
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}
