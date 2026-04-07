/**
 * Zooniverse Talk deep links for the current subject (CSSI IFE interoperability).
 * Pattern: https://www.zooniverse.org/projects/<project_slug>/talk/subjects/<subject_id>
 */
const DEFAULT_SITE_ORIGIN = 'https://www.zooniverse.org';

/**
 * @param projectSlug - Path under `/projects/` on the Zooniverse site (e.g. `zookeeper/galaxy-zoo`)
 * @param subjectId - Panoptes subject id from the queued subject record
 * @param siteOrigin - Optional origin when using a non-production front-end (e.g. preview)
 */
export function buildZooniverseSubjectTalkUrl(
  projectSlug: string,
  subjectId: string,
  siteOrigin?: string
): string {
  const slug = projectSlug.replace(/^\/+/, '').replace(/\/+$/, '');
  const base = (siteOrigin ?? DEFAULT_SITE_ORIGIN).replace(/\/+$/, '');
  return `${base}/projects/${slug}/talk/subjects/${encodeURIComponent(subjectId)}`;
}

export function isPanoptesSubjectId(subjectId: string | null): boolean {
  return Boolean(subjectId && !subjectId.startsWith('local-'));
}
