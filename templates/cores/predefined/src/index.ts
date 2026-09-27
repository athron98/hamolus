// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
/**
 * The {{PROJECT_LABEL}} core Worker entry point.
 *
 * All application code lives in the `@hamolus/core` package — this file is the seam that
 * hands it to Wrangler. Keeping the entry local (instead of pointing `main` straight into
 * `node_modules`) means you can later wrap the app: add middleware, mount extra routes, or
 * register your own error handler around the imported `app` without forking the package.
 *
 * Three things are declared here, all before the first request:
 *
 * - `core.config.ts` holds this project's build-time settings (locales today). It is applied
 *   before the first request, and KV settings still override it at runtime — so this is the
 *   floor a project stands on, not a lock.
 * - `src/collections` holds the collections this project defines in code.
 * - `src/panels` holds the panels this project defines in code.
 *
 * Anything listed in those two directories has a **read-only definition**: the API refuses to
 * edit or delete the schema, and the panel manifests cannot be changed at runtime. Their
 * *records* stay fully editable. That split is the point — the schema is reviewed in a pull
 * request, the data is not.
 *
 * Collections and panels can also be created in the console. The two coexist: a collection
 * that exists in D1 but is not listed here stays editable in the console.
 */
import app, { setCodeDefinitions, setCoreConfig } from '@hamolus/core'
import { config } from '../core.config'
import { collections } from './collections'
import { panels } from './panels'

setCoreConfig(config)
setCodeDefinitions({ collections, panels })

export default app
