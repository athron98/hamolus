/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import type { JSX } from 'solid-js/jsx-runtime'
import { createEffect, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import { token } from './lib/store'
import { hydrateSession } from './lib/session'
import { tokens } from './theme.stylex'
import { LoginPage } from './pages/Login'
import { Layout } from './components/Layout'

const rootStyles = stylex.create({
  root: {
    height: '100%',
    backgroundColor: tokens.bg,
    color: tokens.text,
    transition: 'background-color 0.3s ease, color 0.3s ease',
  },
})

export function App(props: { children?: JSX.Element }) {
  createEffect(() => {
    if (token()) void hydrateSession()
  })

  return (
    <div {...stylex.props(rootStyles.root)}>
      <Show when={token()} fallback={<LoginPage />}>
        <Layout>{props.children}</Layout>
      </Show>
    </div>
  )
}