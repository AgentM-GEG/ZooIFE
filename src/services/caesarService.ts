import { GraphQLClient, gql } from 'graphql-request'
import { headers, USE_STAGING_APIS } from '@/services/panoptesService'
import { type MarkTool } from '@/types/annotations';
import { type GenericSubjectReduction, type SubjectReduction } from '../types/caesar';
import { loggers } from '@/utils/logger';

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
    defaultToolSpec: MarkTool;
};

/**
 * Default tool specification for Caesar annotations
 */
export const CAESAR_REDUCTION_OPTS: CaesarReductionOptions = {
    staging: USE_STAGING_APIS,
    defaultToolSpec: {
        type: "rectangle",
        color: "#17eb81",  // Green default
        label: "Unknown artifact"
    }
};

interface CaesarWorkflowResponse<TData = unknown> {
    workflow?: {
        subject_reductions?: SubjectReduction<TData>[];
    };
}

/**
 * GraphQL query for fetching subject reductions with proper variable substitution.
 * Uses GraphQL variables to prevent injection vulnerabilities.
 * 
 * Note: workflowId and subjectId are ID types (strings) in the Caesar GraphQL schema
 */
const FETCH_REDUCTIONS_QUERY = gql`
    query FetchSubjectReductions($workflowId: ID!, $subjectId: ID!, $reducerKey: String!) {
        workflow(id: $workflowId) {
            subject_reductions(subjectId: $subjectId, reducerKey: $reducerKey) {
                data
            }
        }
    }
`;

/**
 * Create a GraphQL client for Caesar API.
 * @param token - Zooniverse authentication token
 * @param opts - Configuration options (staging, default tool type)
 * @returns Configured GraphQL client for Caesar requests
 */
export function createCaesarClient(token: string | undefined, opts: CaesarReductionOptions): GraphQLClient {
    const url = opts.staging ? CAESAR_STAGING_BASE : CAESAR_API_BASE;
    return new GraphQLClient(url, {
        headers: headers(token, "application/json"),
    });
}

/**
 * Fetch machine learning reductions for a subject from Caesar.
 * Uses GraphQL variables to safely pass parameters.
 * @param caesarClient - GraphQL client configured for Caesar API
 * @param reducerKey - Type of reduction to fetch (e.g., "machineLearnt")
 * @param subjectID - Zooniverse subject ID to fetch reductions for
 * @param workflowID - Zooniverse workflow ID
 * @returns Promise resolving to array of subject reductions, empty array on error
 * @throws Error with context if request fails
 */
export async function fetchCaesarReductions(
    caesarClient: GraphQLClient,
    reducerKey: string,
    subjectID: string,
    workflowID: string
): Promise<GenericSubjectReduction[]> {
    return fetchTypedCaesarReductions<unknown>(caesarClient, reducerKey, subjectID, workflowID);
}

/**
 * Fetch typed Caesar reductions for a subject from Caesar.
 * @param caesarClient - GraphQL client configured for Caesar API
 * @param reducerKey - Type of reduction to fetch (e.g., "machineLearnt")
 * @param subjectID - Zooniverse subject ID to fetch reductions for
 * @param workflowID - Zooniverse workflow ID
 * @returns Promise resolving to typed array of subject reductions, empty array on error
 */
export async function fetchTypedCaesarReductions<TData>(
    caesarClient: GraphQLClient,
    reducerKey: string,
    subjectID: string,
    workflowID: string
): Promise<SubjectReduction<TData>[]> {
    if (!reducerKey) {
        loggers.app('fetchCaesarReductions: reducerKey is required');
        return [];
    }

    try {
        // Validate IDs are present (they're passed as strings, which is what Caesar API expects)
        if (!workflowID || !subjectID) {
            throw new Error(
                `Invalid workflow or subject ID: workflowID=${workflowID}, subjectID=${subjectID}`
            );
        }

        console.debug('Fetching Caesar reductions:', {
            workflowID,
            subjectID,
            reducerKey,
        });

        const response = await caesarClient.request<CaesarWorkflowResponse<TData>>(
            FETCH_REDUCTIONS_QUERY,
            {
                workflowId: workflowID,
                subjectId: subjectID,
                reducerKey: reducerKey,
            }
        );

        console.debug('Caesar reductions response:', response);
        return response.workflow?.subject_reductions ?? [];
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const errorDetails = error instanceof Error ? error : { error };
        loggers.app(`Failed to fetch Caesar reductions for subject ${subjectID}:`, {
            message,
            details: errorDetails,
            stack: error instanceof Error ? error.stack : undefined,
        });
        return [];
    }
}