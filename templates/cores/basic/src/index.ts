// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
/**
 * The {{PROJECT_LABEL}} core Worker entry point.
 *
 * All application code lives in the `@hamolus/core` package — this file is the seam that
 * hands it to Wrangler. Keeping the entry local (instead of pointing `main` straight into
 * `node_modules`) means you can later wrap the app: add middleware, mount extra routes, or
 * register your own error handler around the imported `app` without forking the package.
 *
 * This template declares no schema of its own. A collection or panel is created through
 * the console or the API, and stays editable there:
 *
 * - `PUT /api/_meta/collections/posts` creates the collection and its D1 table,
 * - `POST /api/_panels` creates a panel manifest.
 *
 * One build-time value is declared here, before the first request:
 *
 * - `core.config.ts` holds this project's settings (locales today). It is applied before
 *   the first request, and KV settings still override it at runtime — so this is the floor
 *   a project stands on, not a lock.
 *
 * Both the schema and the records belong to you at runtime; nothing here is frozen. To
 * keep the schema in source control instead, start from the `predefined` template
 * (`hamolus create <name> --core predefined`) or add `setCodeDefinitions()` yourself — the
 * pattern is documented in `README.md`.
 */
import app, { setCoreConfig } from '@hamolus/core'
import { config } from '../core.config'

setCoreConfig(config)

export default app
