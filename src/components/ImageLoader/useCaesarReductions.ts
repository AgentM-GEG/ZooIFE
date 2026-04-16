import { useCallback, useRef, useEffect } from 'react';
import {
  fetchTypedCaesarReductions,
  CAESAR_REDUCTION_OPTS,
} from '@/services/caesarService';
import { getWorkflow } from '@/services/panoptesService';
import type { CaesarAnnotation, MarkTool } from '@/types/annotations';
import {
  type SubjectReduction,
  type CaesarBBoxCountReductionData,
  type CaesarMachineLearntReductionData,
  type CaesarMachineLearntEnvelope,
  type CaesarMachineLearntMark,
} from '../../types/caesar';
import { useCaesarAnnotationStore, type CaesarRetryConfig } from '@/stores/caesarReductionStore';
import { loggers } from '@/utils/logger';

type BBoxReductionCounts = Record<string, number>;
type BBoxCountSubjectReduction = SubjectReduction<CaesarBBoxCountReductionData>;
type MachineLearntSubjectReduction = SubjectReduction<CaesarMachineLearntReductionData>;

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
   * Parse bbox count reductions into a dictionary keyed by Caesar bbox key/markId.
   */
  const parseBBoxReductionCounts = useCallback(
    (reductions: BBoxCountSubjectReduction[]): BBoxReductionCounts => {
      return reductions.reduce<BBoxReductionCounts>((countsByMarkId, reduction) => {
        const reductionData = Array.isArray(reduction.data) ? reduction.data : [reduction.data];

        reductionData.forEach((entry: CaesarBBoxCountReductionData | { data?: unknown }) => {
          const rawEntry = entry as unknown;
          const data =
            typeof rawEntry === 'object' && rawEntry !== null && 'data' in rawEntry
              ? (rawEntry as { data?: unknown }).data
              : rawEntry;

          const bboxPayload =
            typeof data === 'object' && data !== null ? (data as { bbox_keys?: unknown; bbox_num_masks?: unknown }) : {};
          const bboxKeys = Array.isArray(bboxPayload.bbox_keys) ? bboxPayload.bbox_keys : [];
          const bboxNumMasks = Array.isArray(bboxPayload.bbox_num_masks) ? bboxPayload.bbox_num_masks : [];

          bboxKeys.forEach((bboxKey: unknown, index: number) => {
            if (typeof bboxKey !== 'string') return;

            const rawCount = bboxNumMasks[index];
            const parsedCount = typeof rawCount === 'number' ? rawCount : Number(rawCount);

            countsByMarkId[bboxKey] = Number.isFinite(parsedCount) ? parsedCount : 0;
          });
        });

        return countsByMarkId;
      }, {});
    },
    []
  );

  /**
   * Parse Caesar reduction array into CaesarAnnotation objects.
   * Handles nested array structures and extracts rectangle/tool metadata.
   */
  const parseMLReductions = useCallback(
    (
      reductions: MachineLearntSubjectReduction[],
      workflow: any,
      bboxReductionCounts: BBoxReductionCounts
    ): CaesarAnnotation[] => {
      return reductions.flatMap((r) => {
        const outer = Array.isArray(r.data) ? r.data : [r.data];

        return outer.flatMap((d: CaesarMachineLearntReductionData) => {
          const inner = Array.isArray((d as CaesarMachineLearntEnvelope | undefined)?.data)
            ? ((d as CaesarMachineLearntEnvelope).data ?? [])
            : [];

          return inner.map((b: CaesarMachineLearntMark) => {
            const taskIndex: number = b.taskIndex ?? 0;
            const toolIndex: number = b.toolIndex ?? 0;

            // Check if workflow has tasks defined, otherwise fall back to default tool spec
            const hasWorkflowTasks = workflow?.tasks && Object.keys(workflow.tasks).length > 0;
            const markTool: MarkTool = hasWorkflowTasks
              ? { ...CAESAR_REDUCTION_OPTS.defaultToolSpec, ...workflow.tasks[`T${taskIndex}`]?.tools?.[toolIndex] }
              : CAESAR_REDUCTION_OPTS.defaultToolSpec;

            const markId = b.markId ? String(b.markId) : crypto.randomUUID();
            const xCenter = b.x_center;
            const yCenter = b.y_center;
            const width = b.width;
            const height = b.height;
            const hasRectangleGeometry =
              typeof xCenter === 'number' &&
              typeof yCenter === 'number' &&
              typeof width === 'number' &&
              typeof height === 'number';

            if (markTool?.type === 'rectangle' && hasRectangleGeometry) {
              return {
                toolType: 'rectangle',
                x_center: xCenter,
                y_center: yCenter,
                width,
                height,
                markId,
                previousAnnotationCount: bboxReductionCounts[markId] ?? 0,
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
          loggers.panoptes(
            `[Caesar] Fetching volunteer bounding box annotation reductions for subject ${subjectId} (attempt ${attempt + 1}/${retryConfig.maxRetries})`
          );

          const bbox_reductions: BBoxCountSubjectReduction[] = await fetchTypedCaesarReductions<CaesarBBoxCountReductionData>(
            caesarClientRef.current,
            'bbox_per_rect_counter',
            subjectId,
            workflowId
          );

          const bboxReductionCounts = parseBBoxReductionCounts(bbox_reductions);

          loggers.panoptes('[Caesar] Volunteer bounding box counts:', bboxReductionCounts);


          loggers.panoptes(
            `[Caesar] Fetching ML reductions/predictions for subject ${subjectId} (attempt ${attempt + 1}/${retryConfig.maxRetries})`
          );

          const ml_reductions: MachineLearntSubjectReduction[] = await fetchTypedCaesarReductions<CaesarMachineLearntReductionData>(
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
          const parsed_ml_reductions: CaesarAnnotation[] = parseMLReductions(
            ml_reductions,
            workflow,
            bboxReductionCounts
          );

          useCaesarAnnotationStore.getState().setAnnotations(parsed_ml_reductions);
          useCaesarAnnotationStore.getState().setLoading(false);
          loggers.panoptes(`[Caesar] Successfully fetched ${parsed_ml_reductions.length} annotations for subject ${subjectId}`);
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
    [workflowId, parseBBoxReductionCounts, parseMLReductions, retryConfig]  // Include retryConfig in dependencies
  );

  return processCaesarReductions;
}
