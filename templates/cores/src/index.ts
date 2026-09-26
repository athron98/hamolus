/**
 * The {{PROJECT_LABEL}} core Worker entry point.
 *
 * All application code lives in the `@hamolus/core` package — this file is the seam that
 * hands it to Wrangler. Keeping the entry local (instead of pointing `main` straight into
 * `node_modules`) means you can later wrap the app: add middleware, mount extra routes, or
 * register your own error handler around the imported `app` without forking the package.
 *
 * The import below is a default export, so this module re-exports it as its own default.
 */
export { default } from '@hamolus/core'
