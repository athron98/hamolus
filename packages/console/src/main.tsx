/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * Development entry for the console package itself.
 *
 * `src/lib.tsx` is the real entry — it exports `mount()` for host applications and
 * this file is only the stock shell that calls it, so the dev server, the preview
 * build and a generated project all exercise the same code path.
 */

import { mount } from './lib'

mount()
