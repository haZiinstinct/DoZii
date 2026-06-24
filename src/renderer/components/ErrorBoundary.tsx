import React from 'react'
import i18n from 'i18next'

interface Props {
  children: React.ReactNode
}

interface State {
  error: Error | null
}

/**
 * Letzte Verteidigungslinie gegen weisse Bildschirme: faengt Render-Fehler,
 * loggt sie in den Main-Prozess und bietet einen Neustart der Ansicht an.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    window.api?.logs
      .write('error', 'ErrorBoundary', error.message, {
        stack: error.stack,
        componentStack: info.componentStack
      })
      .catch(() => {
        /* Logging darf nie selbst crashen */
      })
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-brand-dark p-8 text-center">
          <h1 className="text-xl font-bold text-brand-red">{i18n.t('errorBoundary.title')}</h1>
          <p className="max-w-md text-sm text-brand-text-dim">
            {i18n.t('errorBoundary.description')}
          </p>
          <p className="max-w-md break-words font-mono text-xs text-brand-text-dim">
            {this.state.error.message}
          </p>
          <button
            onClick={() => {
              this.setState({ error: null })
              window.location.hash = '#/'
            }}
            className="rounded-xl bg-brand-cyan px-4 py-2 text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-cyan-dim"
          >
            {i18n.t('errorBoundary.home')}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
