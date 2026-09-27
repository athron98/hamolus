// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
import { render } from 'solid-js/web'
import { App } from './App'
import { panel } from './panel'
import './panel.css'

/**
 * Panel entry point.
 *
 * `App` takes the whole `PanelRuntimeConfig` rather than an already-dismantled config, so
 * the id, name, and token have a single source of truth.
 */
const root = document.getElementById('root')
if (!root) throw new Error('Panel root element not found')

render(() => <App panel={panel} />, root)
