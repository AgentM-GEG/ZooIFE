import { useMemo } from 'react';
import { createCaesarClient, CaesarReductionOptions } from '@/services/caesarService';

/**
 * React hook that creates and memoizes a Caesar GraphQL client.
 * Memoization ensures client is only recreated when token changes.
 *
 * @param token - Zooniverse authentication token
 * @param opts - Configuration options (staging, default tool type) - should be a stable object reference
 * @returns Memoized GraphQL client for Caesar API requests
 */
export function useCaesarClient(token: string | undefined, opts: CaesarReductionOptions) {
    return useMemo(() => {
        return createCaesarClient(token, opts);
    }, [token]);  // Only depend on token; opts is expected to be a constant
}
