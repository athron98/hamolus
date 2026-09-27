/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { McpServer } from '@modelcontextprotocol/server'
import { createMcpHandler } from 'agents/mcp/server'
import type { Env } from './env'
import { CoreClient } from './core'
import { registerTools } from './tools'

const SERVER_NAME = 'hamolus'
const SERVER_VERSION = '0.1.0'
const MCP_ROUTE = '/mcp'

function createServer(env: Env): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION })
  registerTools(server, new CoreClient(env), env)
  return server
}

const ROOT_JSON = JSON.stringify(
  {
    ok: true,
    service: `${SERVER_NAME} MCP server`,
    transport: 'Streamable HTTP (stateless)',
    endpoint: `POST ${MCP_ROUTE} — headers: Authorization: Bearer <token>`,
    tools: 'Discover via MCP initialize/tools/list (or check packages/mcp/src/tools.ts).',
  },
  null,
  2,
)

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (request.method === 'GET' && pathname !== MCP_ROUTE) {
      return Promise.resolve(
        new Response(ROOT_JSON, { headers: { 'content-type': 'application/json; charset=utf-8' } }),
      )
    }

    const bearer = env.MCP_BEARER_TOKEN
    if (bearer) {
      const auth = request.headers.get('authorization') ?? ''
      if (auth !== `Bearer ${bearer}`) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid MCP bearer token' } }),
            { status: 401, headers: { 'content-type': 'application/json; charset=utf-8' } },
          ),
        )
      }
    }

    const handler = createMcpHandler(() => createServer(env), { route: MCP_ROUTE })
    return handler(request, env, ctx)
  },
}