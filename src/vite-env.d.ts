/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA_ID: string
  readonly VITE_OWM_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
