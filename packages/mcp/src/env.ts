export interface Env {
  /** Base URL of the core API, e.g. `http://localhost:8787/api`. */
  CORE_API_URL?: string
  /** Bearer JWT used against the core. If unset, CORE_ADMIN_KEY mints one. */
  CORE_API_TOKEN?: string
  /** Admin key exchanged for a JWT at POST /api/_auth/token. */
  CORE_ADMIN_KEY?: string
  /** Optional land scope sent as `x-land` on every core request. */
  CORE_LAND?: string
  /** Optional tenant colony sent as `x-colony`. */
  CORE_COLONY?: string
  /** When set, the /mcp endpoint requires `Authorization: Bearer <token>`. */
  MCP_BEARER_TOKEN?: string
  /** `"true"` disables every write/mutation tool. */
  MCP_READONLY?: string
}