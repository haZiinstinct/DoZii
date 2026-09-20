import { useState } from 'react'
import { Stethoscope, Copy, Check, Save, Github } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * Diagnosebericht statt Telemetrie.
 *
 * DoZii schickt nichts von allein - das ist der Grund, warum jemand hier sein
 * Arbeitszeugnis hineinlegt. Trotzdem braucht das Projekt Rueckmeldung von
 * fremder Hardware, sonst bleibt unbekannt, ob der CUDA-Pfad ueberhaupt
 * greift.
 *
 * Die Aufloesung: der Bericht wird auf Knopfdruck erzeugt, VOLLSTAENDIG
 * angezeigt und erst dann - vom Menschen - weitergegeben. Deshalb steht der
 * Text hier in einem Feld zum Mitlesen und nicht hinter einem "Senden".
 */
export function DiagnosticReportCard({
  compact = false
}: {
  /** Im Fehlerfall: nur der Knopf, ohne Ueberschrift und Erklaerung. */
  compact?: boolean
}): React.ReactElement {
  const { t } = useTranslation()
  const [report, setReport] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [savedPath, setSavedPath] = useState<string | null>(null)

  const create = async (): Promise<void> => {
    setBusy(true)
    setSavedPath(null)
    try {
      setReport(await window.api.diagnostics.create())
    } finally {
      setBusy(false)
    }
  }

  const copy = async (): Promise<void> => {
    if (!report) return
    await window.api.diagnostics.copy(report)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const save = async (): Promise<void> => {
    if (!report) return
    const path = await window.api.diagnostics.save(report)
    if (path) setSavedPath(path)
  }

  const body = (
    <>
      {!report && (
        <button
          onClick={create}
          disabled={busy}
          className="flex items-center gap-2 rounded-xl border border-brand-border px-4 py-2 text-sm text-brand-text-dim transition-all hover:border-brand-cyan/30 hover:text-brand-cyan disabled:opacity-40"
        >
          <Stethoscope size={14} aria-hidden="true" />
          {busy ? t('diagnostics.creating') : t('diagnostics.create')}
        </button>
      )}

      {report && (
        <div className="space-y-3">
          {/*
            Der Bericht steht vollstaendig da, bevor irgendetwas damit
            passiert. Wer ihn nicht lesen will, muss nicht - aber niemand
            soll etwas weitergeben, das er nicht sehen konnte.
          */}
          <pre className="max-h-72 overflow-auto rounded-xl border border-brand-border bg-brand-darker/60 p-4 font-mono text-[11px] leading-relaxed text-brand-text-dim">
            {report}
          </pre>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={copy}
              className="flex items-center gap-2 rounded-xl border border-brand-border px-4 py-2 text-sm text-brand-text-dim transition-all hover:border-brand-cyan/30 hover:text-brand-cyan"
            >
              {copied ? (
                <Check size={14} className="text-brand-green" aria-hidden="true" />
              ) : (
                <Copy size={14} aria-hidden="true" />
              )}
              {/*
                Der Wechsel auf "Kopiert" ist eine Rueckmeldung, die nur
                sichtbar passiert - ohne aria-live bleibt sie fuer
                Screenreader stumm.
              */}
              <span aria-live="polite">
                {copied ? t('diagnostics.copied') : t('diagnostics.copy')}
              </span>
            </button>

            <button
              onClick={save}
              className="flex items-center gap-2 rounded-xl border border-brand-border px-4 py-2 text-sm text-brand-text-dim transition-all hover:border-brand-cyan/30 hover:text-brand-cyan"
            >
              <Save size={14} aria-hidden="true" />
              {t('diagnostics.save')}
            </button>

            <button
              onClick={() => window.api.diagnostics.report(report)}
              className="flex items-center gap-2 rounded-xl border border-brand-cyan/30 bg-brand-cyan/10 px-4 py-2 text-sm text-brand-cyan transition-all hover:bg-brand-cyan/20"
            >
              <Github size={14} aria-hidden="true" />
              {t('diagnostics.report')}
            </button>
          </div>

          {savedPath && (
            <p aria-live="polite" className="break-all text-xs text-brand-green">
              {t('diagnostics.saved', { path: savedPath })}
            </p>
          )}
        </div>
      )}
    </>
  )

  if (compact) return <div className="mt-3">{body}</div>

  return (
    <section className="rounded-2xl border border-brand-border bg-brand-card/60 p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-brand-text-dim">
        {t('diagnostics.title')}
      </h2>
      <p className="mb-2 text-sm text-brand-text-dim">{t('diagnostics.desc')}</p>
      <p className="mb-4 text-xs text-brand-text-dim">{t('diagnostics.privacyNote')}</p>
      {body}
    </section>
  )
}
