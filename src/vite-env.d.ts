/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_GUEST_NAME_PREFIX?: string;
  readonly VITE_ENABLE_AUDIO_BY_DEFAULT?: string;
  readonly VITE_ENABLE_VISUAL_REGRESSION?: string;
  readonly VITE_USE_MOCKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
