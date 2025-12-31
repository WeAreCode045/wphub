/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY: string;
  readonly VITE_SUPABASE_FUNCTIONS_URL?: string;
  readonly VITE_WPHUB_APP_ID?: string;
  readonly VITE_WPHUB_BACKEND_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
