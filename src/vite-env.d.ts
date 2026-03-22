/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA_ID: string
  readonly VITE_OWM_API_KEY: string
  readonly VITE_WEATHERAPI_KEY: string
  readonly VITE_OPENSKY_CLIENT_ID: string
  readonly VITE_OPENSKY_CLIENT_SECRET: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
