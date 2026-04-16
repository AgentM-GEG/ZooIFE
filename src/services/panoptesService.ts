/**
 * Panoptes / Zooniverse API service
 * Aligned with CSSI IFE Interoperability
 */

import type { Subject, Classification, Workflow } from '@/types/panoptes';
import { apiCall, buildQueryString } from './apiClient';

export const API_BASE = import.meta.env.VITE_PANOPTES_API_BASE || 'https://www.zooniverse.org/api';
export const STAGING_BASE = import.meta.env.VITE_PANOPTES_STAGING_BASE || 'https://panoptes-staging.zooniverse.org/api';

export const PROJECT_ID = import.meta.env.VITE_ZOONIVERSE_PROJECT_ID || undefined;
export const WORKFLOW_ID = import.meta.env.VITE_ZOONIVERSE_WORKFLOW_ID?.trim() ?? '29070';
export const USE_STAGING_APIS = import.meta.env.VITE_ZOONIVERSE_USE_STAGING_APIS === 'true';
export const SUBJECT_SET_ID = import.meta.env.VITE_ZOONIVERSE_SUBJECT_SET_ID?.trim() || undefined;

/**
 * Default options for queued subjects endpoint
 */
export const QUEUE_OPTS: QueuedSubjectsOptions = { staging: USE_STAGING_APIS };
if (SUBJECT_SET_ID) {
  QUEUE_OPTS.subjectSetId = SUBJECT_SET_ID;
}

/**
 * Build request headers for Zooniverse API calls.
 * @param token - Optional OAuth bearer token for authenticated requests
 * @param content_type - Content-Type header (default: JSON API format)
 * @returns Headers object for fetch requests
 */
export function headers(token?: string, content_type: string = 'application/vnd.api+json; version=1'): HeadersInit {
  const h: HeadersInit = {
    Accept: 'application/vnd.api+json; version=1',
    'Content-Type': content_type,
  };
  if (token) (h as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  return h;
}

/**
 * Options for fetching queued subjects.
 */
export type QueuedSubjectsOptions = {
  staging?: boolean;
  /** When set, appended as `subject_set_id` (required for grouped workflows; optional otherwise). */
  subjectSetId?: string;
};

/**
 * Fetch next queued subjects for a workflow from Panoptes.
 * @param workflowId - Zooniverse workflow ID
 * @param token - Optional authentication token for authenticated endpoints
 * @param opts - Configuration options (staging API, subject set ID)
 * @returns Promise resolving to array of subject objects
 */
export async function getQueuedSubjects(
  workflowId: string,
  token?: string,
  opts?: boolean | QueuedSubjectsOptions
): Promise<Subject[]> {
  const options: QueuedSubjectsOptions =
    typeof opts === 'boolean' ? { staging: opts } : (opts ?? {});
  const { staging = false, subjectSetId } = options;
  const base = staging ? STAGING_BASE : API_BASE;

  const queryString = buildQueryString({
    workflow_id: workflowId,
    subject_set_id: subjectSetId,
  });

  const response = await apiCall<{ subjects: Subject[] }>(
    base,
    `/subjects/queued${queryString}`,
    { token }
  );

  return response.subjects ?? [];
}

/**
 * Fetch a specific subject by ID from Panoptes.
 * @param subjectId - Zooniverse subject ID
 * @param token - Optional authentication token
 * @param staging - Whether to use staging API instead of production
 * @returns Promise resolving to the subject, or undefined if not found
 */
export async function getSubject(
  subjectId: string,
  token?: string,
  staging = false
): Promise<Subject | undefined> {
  const base = staging ? STAGING_BASE : API_BASE;

  const response = await apiCall<{ subjects: Subject[] }>(
    base,
    `/subjects/${subjectId}`,
    { token }
  );

  return response.subjects?.[0];
}

/**
 * Fetch workflow details by ID from Panoptes.
 * @param workflowId - Zooniverse workflow ID
 * @param token - Optional authentication token
 * @param staging - Whether to use staging API instead of production
 * @returns Promise resolving to workflow object
 */
export async function getWorkflow(
  workflowId: string,
  token?: string,
  staging = false
): Promise<Workflow> {
  const base = staging ? STAGING_BASE : API_BASE;

  const response = await apiCall<{ workflows: Workflow[] }>(
    base,
    `/workflows/${workflowId}`,
    { token }
  );

  return response.workflows?.[0];
}

/**
 * Submit a classification annotation to Panoptes.
 * @param classification - Classification object with annotations and metadata
 * @param token - Authentication token (required for submission)
 * @param staging - Whether to use staging API instead of production
 * @returns Promise resolving to created classification with ID
 */
export async function createClassification(
  classification: Classification,
  token: string,
  staging = false
): Promise<{ id: string }> {
  const base = staging ? STAGING_BASE : API_BASE;

  const response = await apiCall<{ classifications: Array<{ id: string }> }>(
    base,
    '/classifications',
    {
      token,
      method: 'POST',
      body: { classifications: classification },
    }
  );

  return { id: response.classifications?.[0]?.id ?? '' };
}

/**
 * Fetch user profile details by ID from Panoptes.
 * @param userId - Zooniverse user ID (extracted from JWT payload)
 * @param token - Optional authentication token (required for authenticated user details)
 * @param staging - Whether to use staging API instead of production
 * @returns Promise resolving to user object with profile information
 */
export async function getUserDetails(userId: string, token?: string, staging = false) {
  const base = staging ? STAGING_BASE : API_BASE;

  const response = await apiCall<{ users: unknown[] }>(
    base,
    `/users/${userId}`,
    { token }
  );

  return response.users?.[0];
}