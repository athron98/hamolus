import { render } from 'solid-js/web'
import { App } from './App'
import { panel } from './panel'
import './panel.css'

const root = document.getElementById('root')
if (!root) throw new Error('Panel root element not found')

render(() => <App panel={panel} />, root)
