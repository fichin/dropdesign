/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the API in production, e.g. https://kanban-api.onrender.com (unset in development) */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
