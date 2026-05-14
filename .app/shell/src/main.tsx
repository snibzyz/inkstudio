import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { installElectronIpcShim } from './state/electronIpcShim'
import '@vscode/codicons/dist/codicon.css'
import './index.css'

installElectronIpcShim()

const root = document.getElementById('root')!
createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
