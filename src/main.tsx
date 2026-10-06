import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import * as actions from '@/data/actions'
import { useSync, workspace } from '@/sync/engine'
import './index.css'

// for scripted checks (CLAUDE.md, testing)
window.sprawniej = { ...window.sprawniej, actions: { ...actions }, sync: { status: useSync, workspace } }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
