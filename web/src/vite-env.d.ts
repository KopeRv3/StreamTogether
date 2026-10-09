/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL del backend en producción. Vacío en desarrollo (usa el proxy de Vite). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
