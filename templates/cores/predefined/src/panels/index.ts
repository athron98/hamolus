// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
/**
 * Every panel this project defines in code.
 *
 * Drop one file per panel next to this one and add it to the array below.
 * Panels are registered after collections, so a view may reference any
 * collection registered in `src/collections`.
 *
 * A panel listed here is frozen: the API refuses to create, update or delete it.
 * To change one, edit its file and redeploy.
 */
import type { CodeDefinitions } from '@hamolus/core'
import { CONTENT } from './content'

export const panels = [CONTENT] satisfies NonNullable<CodeDefinitions['panels']>

export default panels
