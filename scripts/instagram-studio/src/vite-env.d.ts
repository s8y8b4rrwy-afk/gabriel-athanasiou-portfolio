/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SYNC_FUNCTION_URL?: string;
  readonly VITE_PASSWORD_HASH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}
