import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { sampleData } from '@/data/sample'
import { useData } from '@/data/store'
import './index.css'

// Milestone 0: a made-up workspace until sign-in and syncing exist.
useData.setState(sampleData())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
