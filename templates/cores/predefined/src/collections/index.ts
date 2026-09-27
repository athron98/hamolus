// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
/**
 * Every collection this project defines in code.
 *
 * Drop one file per collection next to this one and add it to the array below.
 * The array order is the registration order, so a collection that others point
 * at with `relation` should come first.
 *
 * Leave a collection out of this list once it exists in D1 and the API will let
 * you edit it in the console again — the file only owns what it lists here.
 */
import type { CodeDefinitions } from '@hamolus/core'
import { POSTS } from './posts'

export const collections = [POSTS] satisfies NonNullable<CodeDefinitions['collections']>

export default collections
