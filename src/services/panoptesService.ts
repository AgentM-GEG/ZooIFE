/**
 * Panoptes / Zooniverse API service
 * Aligned with CSSI IFE Interoperability
 */

import type { Subject, Classification, Workflow } from '../types/panoptes';

const API_BASE = 'https://www.zooniverse.org/api';
const STAGING_BASE = 'https://panoptes-staging.zooniverse.org/api';

function headers(token?: string): HeadersInit {
  const h: HeadersInit = {
    Accept: 'application/vnd.api+json; version=1',
    'Content-Type': 'application/vnd.api+json; version=1',
  };
  if (token) (h as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function getQueuedSubjects(
  workflowId: string,
  token?: string,
  staging = false
): Promise<Subject[]> {
  const base = staging ? STAGING_BASE : API_BASE;
  const url = `${base}/subjects/queued?workflow_id=${workflowId}`;
  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) throw new Error(`Subjects error: ${res.status}`);
  const json = await res.json();
  return json.subjects ?? [];
}

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
