/// <reference types="vite/client" />

declare module 'virtual:stylex:runtime'
declare module 'virtual:stylex:css-only'
declare module '*.css'

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}