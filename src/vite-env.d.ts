/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ZOONIVERSE_WORKFLOW_ID?: string;
  readonly VITE_ZOONIVERSE_SUBJECT_SET_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
