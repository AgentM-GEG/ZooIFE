import { GraphQLClient } from 'graphql-request'
import { useMemo } from 'react';
import { headers, USE_STAGING_APIS } from '@/services/panoptesService'
import { CaesarAnnotations } from '@/types/annotations';

/**
 * Caesar reduction API endpoints (GraphQL)
 */
export const CAESAR_API_BASE = import.meta.env.VITE_CAESAR_API_BASE || 'https://caesar.zooniverse.org/graphql';
export const CAESAR_STAGING_BASE = import.meta.env.VITE_CAESAR_STAGING_BASE || 'https://caesar-staging.zooniverse.org/graphql';

/**
 * Options for Caesar service configuration.
 */
export type CaesarReductionOptions = {
    staging: boolean;
    defaultToolType: "rectangle" | "default";
};

/**
 * Default tool type for Caesar annotations
 */
export const CEASAR_DEFAULT_TOOL_TYPE = import.meta.env.VITE_CEASAR_DEFAULT_TOOL_TYPE?.trim() || "default";

/**
 * Default options for Caesar reductions
 */
export const CAESAR_REDUCTION_OPTS: CaesarReductionOptions = {
    staging: USE_STAGING_APIS,
    defaultToolType: CEASAR_DEFAULT_TOOL_TYPE
};

/**
 * Subject reduction data structure from Caesar.
 */
export interface SubjectReduction {
    data: CaesarAnnotations[];
}

interface CaesarWorkflowResponse {
    workflow?: {
        subject_reductions?: SubjectReduction[];
    };
}

/**
 * Create a memoized GraphQL client for Caesar API.
 * @param token - Zooniverse authentication token
 * @param opts - Configuration options (staging, default tool type)
 * @returns Memoized GraphQL client for Caesar requests
 */
export function useCaesarClient(token: string | undefined, opts: CaesarReductionOptions) {
    return useMemo(() => {
        const url = opts.staging ? CAESAR_STAGING_BASE : CAESAR_API_BASE;
        return new GraphQLClient(url, {
            headers: headers(token, "application/json"),
        });
    }, [token]);
}


/**
 * Fetch machine learning reductions for a subject from Caesar.
 * @param caesarClient - GraphQL client configured for Caesar API
 * @param reducerKey - Type of reduction to fetch (e.g., "machineLearnt")
 * @param subjectID - Zooniverse subject ID to fetch reductions for
 * @param workflowID - Zooniverse workflow ID
 * @returns Promise resolving to array of subject reductions
 */
export async function fetchCaesarReductions(
    caesarClient: GraphQLClient,
    reducerKey: string,
    subjectID: string,
    workflowID: string
): Promise<SubjectReduction[]> {
    if (!reducerKey) return [];

    try {
        const query = `{
                            workflow(id: ${workflowID}) {
                            subject_reductions(subjectId: ${subjectID}, reducerKey: "${reducerKey}") {
                                data
                            }
                            }
                        }
                        `;

        console.log({ q: query.replace(/\s+/g, " ") });


        const response = await caesarClient.request<CaesarWorkflowResponse>(
            query.replace(/\s+/g, " ")
        );

        return response.workflow?.subject_reductions ?? [];
    } catch (error) {
        console.error(error);
        return [];
    }
}