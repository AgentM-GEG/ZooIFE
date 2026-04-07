/**
 * Panoptes / Zooniverse API service
 * Aligned with CSSI IFE Interoperability
 */

import type { Subject, Classification, Workflow } from '../types/panoptes';

const API_BASE = 'https://www.zooniverse.org/api';
const STAGING_BASE = 'https://panoptes-staging.zooniverse.org/api';

/**
 * Build request headers for Zooniverse API calls.
 * @param token - Optional OAuth bearer token for authenticated requests
 * @param content_type - Content-Type header (default: JSON API format)
 * @returns Headers object for fetch requests
 */
export function headers(token?: string, content_type :string = 'application/vnd.api+json; version=1'): HeadersInit {
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
  const params = new URLSearchParams({ workflow_id: workflowId });
  if (subjectSetId) params.set('subject_set_id', subjectSetId);
  const url = `${base}/subjects/queued?${params.toString()}`;  
  const res = await fetch(url, { headers: headers(token) });  
  if (!res.ok) throw new Error(`Subjects error: ${res.status}`);
  const json = await res.json();
  return json.subjects ?? [];
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
  const res = await fetch(`${base}/workflows/${workflowId}`, { headers: headers(token) });
  if (!res.ok) throw new Error(`Workflow error: ${res.status}`);
  const json = await res.json();
  return json.workflows?.[0];
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
  const res = await fetch(`${base}/classifications`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ classifications: classification }),
  });
  if (!res.ok) throw new Error(`Classification error: ${res.status}`);
  const json = await res.json();
  return { id: json.classifications?.[0]?.id };
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

  const res = await fetch(`${base}/users/${userId}`, {
    headers: headers(token)
  });

  if (!res.ok) {
    throw new Error(`User fetch error: ${res.status}`);
  }

  const json = await res.json();
  return json.users?.[0]; // Panoptes returns { users: [...] }
}