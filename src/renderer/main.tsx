import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './styles/globals.css'

// Forward uncaught errors and promise rejections to the main-process logger
window.addEventListener('error', (event) => {
  window.api.logs.write('error', 'renderer', event.message, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error instanceof Error ? event.error.stack : undefined
  })
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  window.api.logs.write('error', 'renderer', 'Unhandled promise rejection', {
    reason: reason instanceof Error ? { message: reason.message, stack: reason.stack } : reason
  })
})

window.api.logs.write('info', 'renderer', 'Renderer started').catch(() => {
  /* ignore: IPC may not be ready yet in very early startup */
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
