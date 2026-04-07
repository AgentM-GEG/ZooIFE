/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ZOONIVERSE_USE_STAGING_APIS?: string;
  readonly VITE_ZOONIVERSE_WORKFLOW_ID?: string;
  readonly VITE_ZOONIVERSE_SUBJECT_SET_ID?: string;
  /** Panoptes project id (numeric); used when building classifications */
  readonly VITE_ZOONIVERSE_PROJECT_ID?: string;
  /**
   * Site path after `/projects/` for Talk links, e.g. `zookeeper/galaxy-zoo`
   * (CSSI IFE: `…/projects/<project_slug>/talk/subjects/<subject_id>`).
   */
  readonly VITE_ZOONIVERSE_PROJECT_SLUG?: string;
  /** Optional; default `https://www.zooniverse.org` */
  readonly VITE_ZOONIVERSE_SITE_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
