import { useCallback, useRef, useEffect } from 'react';
import { fetchCaesarReductions, CAESAR_REDUCTION_OPTS, SubjectReduction } from '@/services/caesarService';
import { getWorkflow } from '@/services/panoptesService';
import type { CaesarAnnotation } from '@/types/annotations';
import { useCaesarAnnotationStore } from '@/stores/caesarReductionStore';
import { loggers } from '@/utils/logger';

/**
 * Custom hook for fetching and processing Caesar ML reductions.
 * Converts raw Caesar reduction data into standardized CaesarAnnotation format.
 * @param caesarClient - Initialized Caesar API client
 * @param workflowId - Workflow ID for fetching metadata
 * @param accessToken - OAuth access token for API calls
 * @returns Function to process Caesar reductions for a subject
 */
export function useCaesarReductions(
  caesarClient: any,
  workflowId: string,
  accessToken: string | undefined
) {
  // Store latest client and token in refs to avoid cascading dependency changes
  const caesarClientRef = useRef(caesarClient);
  const accessTokenRef = useRef(accessToken);
  
  // Update refs when they change, but don't use as dependencies
  useEffect(() => {
    caesarClientRef.current = caesarClient;
  }, [caesarClient]);
  
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  /**
   * Parse Caesar reduction array into CaesarAnnotation objects.
   * Handles nested array structures and extracts rectangle/tool metadata.
   */
  const parseReductions = useCallback(
    (reductions: SubjectReduction[], workflow: any): CaesarAnnotation[] => {
      return reductions.flatMap((r) => {
        const outer = Array.isArray(r.data) ? r.data : [r.data];

        return outer.flatMap((d) => {
          const inner = Array.isArray(d?.data) ? d.data : [];

          return inner.map((b: any) => {
            const taskIndex: number = b.taskIndex ?? 0;
            const toolIndex: number = b.toolIndex ?? 0;
            const markTool = workflow?.tasks?.[`T${taskIndex}`]?.tools?.[toolIndex];

            if (markTool?.type === 'rectangle') {
              return {
                toolType: 'rectangle',
                x_center: b.x_center,
                y_center: b.y_center,
                width: b.width,
                height: b.height,
                markId: b.markId ? String(b.markId) : crypto.randomUUID(),
                markColour: markTool.color,
                markLabel: markTool.label,
              };
            }
            return { toolType: 'custom', data: undefined };
          });
        });
      });
    },
    []
  );

  /**
   * Fetch and process Caesar reductions for a subject.
   * Uses refs to avoid cascading dependency changes.
   * @param subjectId - Subject ID to fetch reductions for
   */
  const processCaesarReductions = useCallback(
    async (subjectId: string) => {
      // Access from refs instead of dependencies
      if (!caesarClientRef.current || !accessTokenRef.current) {
        console.debug('Cannot process Caesar reductions: missing caesarClient or accessToken');
        return;
      }

      try {
        const reductions: SubjectReduction[] = await fetchCaesarReductions(
          caesarClientRef.current,
          'machineLearnt',
          subjectId,
          workflowId
        );

        const workflow = await getWorkflow(
          workflowId,
          accessTokenRef.current,
          CAESAR_REDUCTION_OPTS.staging
        );
        const parsed: CaesarAnnotation[] = parseReductions(reductions, workflow);

        useCaesarAnnotationStore.getState().setAnnotations(parsed);
      } catch (err) {
        loggers.app('Failed to process Caesar reductions:', err);
      }
    },
    [workflowId, parseReductions]  // Only stable dependencies
  );

  return processCaesarReductions;
}
