import { useCallback, useRef, useEffect } from 'react';
import { fetchCaesarReductions, CAESAR_REDUCTION_OPTS, SubjectReduction } from '@/services/caesarService';
import { getWorkflow } from '@/services/panoptesService';
import type { CaesarAnnotation } from '@/types/annotations';
import { useCaesarAnnotationStore, type CaesarRetryConfig } from '@/stores/caesarReductionStore';
import { loggers } from '@/utils/logger';

/**
 * Default retry configuration for Caesar service
 */
const DEFAULT_CAESAR_RETRY_CONFIG: CaesarRetryConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
};

/**
 * Custom hook for fetching and processing Caesar ML reductions.
 * Converts raw Caesar reduction data into standardized CaesarAnnotation format.
 * Includes automatic retry logic with exponential backoff.
 * @param caesarClient - Initialized Caesar API client
 * @param workflowId - Workflow ID for fetching metadata
 * @param accessToken - OAuth access token for API calls
 * @param retryConfig - Optional retry configuration (max attempts, delay between retries)
 * @returns Function to process Caesar reductions for a subject
 */
export function useCaesarReductions(
  caesarClient: any,
  workflowId: string,
  accessToken: string | undefined,
  retryConfig: CaesarRetryConfig = DEFAULT_CAESAR_RETRY_CONFIG
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
   * Fetch and process Caesar reductions for a subject with retry logic.
   * Automatically retries on failure with exponential backoff.
   * Uses refs to avoid cascading dependency changes.
   * @param subjectId - Subject ID to fetch reductions for
   */
  const processCaesarReductions = useCallback(
    async (subjectId: string) => {
      // Access from refs instead of dependencies
      if (!caesarClientRef.current || !accessTokenRef.current) {
        const msg = 'Cannot process Caesar reductions: missing caesarClient or accessToken';
        console.debug(msg);
        useCaesarAnnotationStore.getState().setError(msg);
        return;
      }

      // Set loading state at start
      useCaesarAnnotationStore.getState().setLoading(true);

      /**
       * Recursive helper for retry logic with exponential backoff
       */
      const fetchWithRetry = async (attempt: number = 0): Promise<void> => {
        try {
          loggers.app(
            `[Caesar] Fetching reductions for subject ${subjectId} (attempt ${attempt + 1}/${retryConfig.maxRetries})`
          );

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
          useCaesarAnnotationStore.getState().setLoading(false);
          loggers.app(`[Caesar] Successfully fetched ${parsed.length} annotations for subject ${subjectId}`);
        } catch (err) {
          if (attempt < retryConfig.maxRetries - 1) {
            // Retry with exponential backoff
            const delay = retryConfig.retryDelayMs * Math.pow(2, attempt);
            loggers.app(
              `[Caesar] Fetch failed (attempt ${attempt + 1}), retrying in ${delay}ms...`,
              err
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            return fetchWithRetry(attempt + 1);
          } else {
            // All retries exhausted
            const errorMsg = `Caesar annotation fetch failed after ${retryConfig.maxRetries} attempts`;
            loggers.app(`[Caesar] ${errorMsg}:`, err);
            useCaesarAnnotationStore.getState().setError(errorMsg);
            useCaesarAnnotationStore.getState().setLoading(false);
          }
        }
      };

      return fetchWithRetry();
    },
    [workflowId, parseReductions, retryConfig]  // Include retryConfig in dependencies
  );

  return processCaesarReductions;
}
