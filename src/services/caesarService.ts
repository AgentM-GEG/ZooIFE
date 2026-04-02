import { GraphQLClient } from 'graphql-request'
import { useMemo } from 'react';
import { headers } from './panoptesService'
import { CaesarAnnotation, CaesarAnnotations } from '../types/annotations';


export const CAESAR_API_BASE = 'https://caesar.zooniverse.org/graphql';
export const CAESAR_STAGING_BASE = 'https://caesar-staging.zooniverse.org/graphql';


export type CaesarReductionOptions = {
    staging: boolean;
    defaultToolType: "rectangle" | "default";
};


export interface SubjectReduction {
    data: CaesarAnnotations[];
}

interface CaesarWorkflowResponse {
    workflow?: {
        subject_reductions?: SubjectReduction[];
    };
}

export function useCaesarClient(token: string | undefined, opts: CaesarReductionOptions) {
    return useMemo(() => {
        const url = opts.staging ? CAESAR_STAGING_BASE : CAESAR_API_BASE;
        return new GraphQLClient(url, {
            headers: headers(token, "application/json"),
        });
    }, [token]);
}


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