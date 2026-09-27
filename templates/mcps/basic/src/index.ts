// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
/**
 * The {{PROJECT_LABEL}} MCP server entry point.
 *
 * Every tool is implemented in the `@hamolus/mcp` package — this file is the seam that
 * hands it to Wrangler. Keeping the entry local (instead of pointing `main` straight into
 * `node_modules`) means you can later wrap the server: add middleware, add your own tools
 * next to the generated ones, or mount a health endpoint around the imported app.
 *
 * The import below is a default export, so this module re-exports it as its own default.
 */
export { default } from '@hamolus/mcp'
