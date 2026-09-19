import { useId, useMemo, useState } from 'react'
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileX,
  Gauge,
  Lightbulb,
  ScrollText,
  Search,
  Users,
  Radar
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type {
  ClauseSeverity,
  ContractCheckResult,
  ContractClause,
  ContractKeyTerm,
  ContractMissing,
  ContractParty
} from '@/lib/parse-contract'
import { scanKlauseln, minimumRisk, type KlauselFinding } from '@shared/klausel-radar'

interface Props {
  result: ContractCheckResult
  /** Springt zur Belegstelle im Originaltext (Integrator verdrahtet das). */
  onShowInText?: (quote: string) => void
  /** Originaltext - Grundlage des Klausel-Radars. */
  documentText?: string
}

/**
 * Klausel-Ampel und Gesamt-Risiko teilen sich Farben und Beschriftung -
 * eine rote Klausel heisst genauso wie ein rotes Gesamt-Risiko.
 */
const severityConfig: Record<
  ClauseSeverity,
  {
    bg: string
    border: string
    text: string
    fill: string
    icon: React.ReactNode
    labelKey: string
  }
> = {
  red: {
    bg: 'bg-brand-red/5',
    border: 'border-brand-red/30',
    text: 'text-brand-red',
    fill: 'bg-brand-red',
    icon: <AlertOctagon size={14} aria-hidden="true" />,
    labelKey: 'results.contract.riskHigh'
  },
  yellow: {
    bg: 'bg-brand-amber/5',
    border: 'border-brand-amber/30',
    text: 'text-brand-amber',
    fill: 'bg-brand-amber',
    icon: <AlertTriangle size={14} aria-hidden="true" />,
    labelKey: 'results.contract.riskMedium'
  },
  green: {
    bg: 'bg-brand-green/5',
    border: 'border-brand-green/30',
    text: 'text-brand-green',
    fill: 'bg-brand-green',
    icon: <CheckCircle2 size={14} aria-hidden="true" />,
    labelKey: 'results.contract.riskLow'
  }
}

type RiskLevel = ContractCheckResult['overallRisk']['level']

const riskSeverity: Record<RiskLevel, ClauseSeverity> = {
  high: 'red',
  medium: 'yellow',
  low: 'green'
}

/** Wie viele Ampel-Segmente leuchten. */
const riskSteps: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3 }

/** Rot zuerst, dann gelb, dann gruen. */
const severityRank: Record<ClauseSeverity, number> = { red: 0, yellow: 1, green: 2 }

interface IndexedClause {
  clause: ContractClause
  idx: number
}

function bySeverity(a: IndexedClause, b: IndexedClause): number {
  return severityRank[a.clause.severity] - severityRank[b.clause.severity]
}

function RiskScale({ steps, fillClass }: { steps: number; fillClass: string }): React.ReactElement {
  // Rein dekorativ - die Stufe steht als Text daneben.
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className={`h-3 flex-1 rounded-full transition-colors ${
            n <= steps ? fillClass : 'bg-brand-border'
          }`}
        />
      ))}
    </div>
  )
}

function RiskHero({
  risk,
  documentType
}: {
  risk: ContractCheckResult['overallRisk']
  documentType: string
}): React.ReactElement {
  const { t } = useTranslation()
  const sev = severityConfig[riskSeverity[risk.level]]

  return (
    <div className={`rounded-2xl border p-6 ${sev.border} ${sev.bg}`}>
      <div className="mb-3 flex items-center gap-2">
        <Gauge size={14} className={sev.text} aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
          {t('results.contract.risk')}
        </p>
        <span className="ms-auto rounded-lg border border-brand-border bg-brand-darker/60 px-2 py-0.5 font-mono text-[10px] uppercase text-brand-text-dim">
          {documentType}
        </span>
      </div>

      <div className={`mb-3 flex items-center gap-2 ${sev.text}`}>
        {sev.icon}
        <span className="text-2xl font-bold">{t(sev.labelKey)}</span>
      </div>

      <RiskScale steps={riskSteps[risk.level]} fillClass={sev.fill} />

      {risk.reasoning && (
        <p className="mt-3 text-xs leading-relaxed text-brand-text">{risk.reasoning}</p>
      )}
    </div>
  )
}

function KeyTermsBlock({ terms }: { terms: ContractKeyTerm[] }): React.ReactElement | null {
  const { t } = useTranslation()
  if (terms.length === 0) return null

  return (
    <div className="rounded-2xl border border-brand-border bg-brand-card/40 p-6">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
        {t('results.contract.keyTerms')}
      </h3>
      <ul className="grid gap-3 sm:grid-cols-2">
        {terms.map((term, idx) => (
          <li
            key={idx}
            className="rounded-xl border border-brand-border bg-brand-darker/40 p-4 text-start"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-text-dim">
              {term.label}
            </p>
            <p className="mt-1 font-mono text-sm text-brand-text-bright">{term.value}</p>
            {term.quote && (
              <blockquote className="mt-2 border-s-2 border-brand-cyan/40 ps-3 text-xs italic text-brand-text-dim">
                &quot;{term.quote}&quot;
              </blockquote>
            )}
            {!term.verified && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-lg bg-brand-amber/10 px-2 py-0.5 text-[10px] font-semibold text-brand-amber">
                <AlertTriangle size={10} aria-hidden="true" />
                {t('results.contract.unverifiedBadge')}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ClauseCard({
  clause,
  expanded,
  onToggle,
  onShowInText
}: {
  clause: ContractClause
  expanded: boolean
  onToggle: () => void
  onShowInText?: (quote: string) => void
}): React.ReactElement {
  const { t } = useTranslation()
  const sev = severityConfig[clause.severity]
  const panelId = useId()
  const hasDetails = Boolean(clause.plain || clause.why || clause.typical || clause.askFor)

  return (
    <li className={`rounded-2xl border p-4 ${sev.bg} ${sev.border}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold ${sev.text}`}
        >
          {sev.icon}
          {t(sev.labelKey)}
        </span>
        {clause.category && (
          <span className="rounded-lg border border-brand-border bg-brand-darker/60 px-2 py-0.5 font-mono text-[10px] uppercase text-brand-text-dim">
            {clause.category}
          </span>
        )}
        {!clause.verified && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-brand-amber/10 px-2 py-0.5 text-[10px] font-semibold text-brand-amber">
            <AlertTriangle size={10} aria-hidden="true" />
            {t('results.contract.unverifiedBadge')}
          </span>
        )}
      </div>

      {clause.title && <h4 className="text-sm font-bold text-brand-text-bright">{clause.title}</h4>}

      {clause.side && (
        <p className="mt-0.5 text-[10px] uppercase tracking-wider text-brand-text-dim">
          {t('results.contract.forSide', { side: clause.side })}
        </p>
      )}

      {clause.quote && (
        <blockquote className="my-2 border-s-2 border-brand-cyan/40 ps-3 text-sm italic text-brand-text">
          &quot;{clause.quote}&quot;
        </blockquote>
      )}

      {(hasDetails || (onShowInText && clause.quote)) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {hasDetails && (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-controls={panelId}
              className="flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-darker/60 px-3 py-1.5 text-xs text-brand-text-dim transition-colors hover:border-brand-cyan/30 hover:text-brand-cyan"
            >
              {expanded ? (
                <ChevronUp size={12} aria-hidden="true" />
              ) : (
                <ChevronDown size={12} aria-hidden="true" />
              )}
              {expanded ? t('results.contract.detailsHide') : t('results.contract.detailsShow')}
            </button>
          )}
          {onShowInText && clause.quote && (
            <button
              type="button"
              onClick={() => onShowInText(clause.quote)}
              className="flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-darker/60 px-3 py-1.5 text-xs text-brand-text-dim transition-colors hover:border-brand-cyan/30 hover:text-brand-cyan"
            >
              <Search size={12} aria-hidden="true" />
              {t('results.contract.showInText')}
            </button>
          )}
        </div>
      )}

      {hasDetails && (
        <div
          id={panelId}
          hidden={!expanded}
          className="mt-3 space-y-3 rounded-xl border border-brand-border bg-brand-darker/40 p-4"
        >
          {clause.plain && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-brand-cyan">
                {t('results.contract.plainMeaning')}
              </p>
              <p className="text-sm text-brand-text">{clause.plain}</p>
            </div>
          )}
          {clause.why && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-brand-text-dim">
                {t('results.contract.why')}
              </p>
              <p className="text-sm text-brand-text">{clause.why}</p>
            </div>
          )}
          {clause.typical && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-brand-text-dim">
                {t('results.contract.typical')}
              </p>
              <p className="text-sm text-brand-text-dim">{clause.typical}</p>
            </div>
          )}
          {clause.askFor && (
            <div className="rounded-lg border border-brand-amber/30 bg-brand-amber/5 p-3">
              <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-brand-amber">
                <Lightbulb size={10} aria-hidden="true" />
                {t('results.contract.askFor')}
              </p>
              <p className="text-sm text-brand-text">{clause.askFor}</p>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

function MissingBlock({ missing }: { missing: ContractMissing[] }): React.ReactElement | null {
  const { t } = useTranslation()
  if (missing.length === 0) return null

  return (
    <div className="rounded-2xl border border-brand-red/30 bg-brand-red/5 p-6">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-red">
        <FileX size={12} aria-hidden="true" />
        {t('results.contract.missing', { count: missing.length })}
      </h3>
      <ul className="space-y-3">
        {missing.map((m, idx) => (
          <li key={idx} className="flex items-start gap-3">
            <FileX size={16} className="mt-0.5 flex-shrink-0 text-brand-red" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-brand-text-bright">{m.element}</p>
              {m.implication && (
                <p className="mt-0.5 text-xs text-brand-text-dim">{m.implication}</p>
              )}
            </div>
            <span className="rounded-lg border border-brand-red/20 bg-brand-red/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-red">
              {t(`severity.${m.importance}`)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PartiesBlock({ parties }: { parties: ContractParty[] }): React.ReactElement | null {
  const { t } = useTranslation()
  if (parties.length === 0) return null

  return (
    <div className="rounded-2xl border border-brand-border bg-brand-card/40 p-6">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
        <Users size={12} aria-hidden="true" />
        {t('results.contract.parties')}
      </h3>
      <ul className="space-y-2">
        {parties.map((p, idx) => (
          <li
            key={idx}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-s-2 border-brand-border ps-3"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-text-dim">
              {p.role}
            </span>
            <span className="text-sm text-brand-text">{p.name}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Das Klausel-Radar als eigener Block.
 *
 * Diese Funde stammen NICHT aus dem Modell, sondern aus einem festen
 * Regelwerk. Der Grund steht in der Messung: granite4.1:3b fand 28,6 % der
 * kritischen Klauseln und meldete bei einer Kaution ueber vier
 * Nettokaltmieten "mittleres Risiko". Das Regelwerk fand auf denselben
 * Vertraegen 6 von 7 roten Klauseln und lag bei allen vier Vertraegen mit der
 * Risikostufe richtig - ohne Rechenzeit und auf jedem Rechner gleich.
 */
function KlauselRadar({
  findings,
  onShowInText
}: {
  findings: KlauselFinding[]
  onShowInText?: (quote: string) => void
}): React.ReactElement | null {
  const { t } = useTranslation()
  if (findings.length === 0) return null

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Radar size={14} className="text-brand-text-dim" aria-hidden="true" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
          {t('results.contract.radarTitle')}
        </h3>
      </div>
      <p className="mb-3 text-xs text-brand-text-dim">{t('results.contract.radarIntro')}</p>

      <div className="space-y-2">
        {findings.map((f) => {
          const sev = severityConfig[f.severity]
          return (
            <div key={f.id} className={`rounded-xl border p-4 ${sev.border} ${sev.bg}`}>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className={`text-sm font-semibold ${sev.text}`}>
                  {t(`results.contract.radar.${f.id}`)}
                </span>
                {f.law && (
                  <span className="rounded-lg border border-brand-border bg-brand-darker/60 px-2 py-0.5 font-mono text-[10px] text-brand-text-dim">
                    {f.law}
                  </span>
                )}
              </div>
              <p className="text-xs italic leading-relaxed text-brand-text">
                &bdquo;{f.quote}&ldquo;
              </p>
              {onShowInText && (
                <button
                  type="button"
                  onClick={() => onShowInText(f.quote)}
                  className="mt-2 text-[11px] text-brand-text-dim underline underline-offset-2 hover:text-brand-text"
                >
                  {t('results.contract.showInText')}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ContractCheck({ result, onShowInText, documentText }: Props): React.ReactElement {
  const { t } = useTranslation()

  const radarFindings = useMemo(
    () => (documentText ? scanKlauseln(documentText) : []),
    [documentText]
  )

  /*
   * Eine rote Klausel im Text macht das Gesamtrisiko hoch - unabhaengig
   * davon, was das Modell geantwortet hat. Gemessener Anlass: bei einer
   * Kaution ueber vier Nettokaltmieten meldete das kleine Modell viermal in
   * Folge "mittleres Risiko". Eine Entwarnung, die nicht stimmt, ist
   * schlimmer als gar keine Einschaetzung.
   */
  const effectiveRisk = useMemo(() => {
    const floor = minimumRisk(radarFindings)
    if (!floor) return result.overallRisk
    const order: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 }
    if (order[result.overallRisk.level] >= order[floor]) return result.overallRisk
    return { ...result.overallRisk, level: floor }
  }, [radarFindings, result.overallRisk])

  // Rote Klauseln starten offen - das Schlimmste soll ohne Klick sichtbar sein.
  // Lazy init, damit eine neue Analyse den Zustand zuruecksetzt.
  const [expanded, setExpanded] = useState<Set<number>>(() => {
    const set = new Set<number>()
    result.clauses.forEach((clause, idx) => {
      if (clause.severity === 'red') set.add(idx)
    })
    return set
  })
  const [showUnverified, setShowUnverified] = useState(false)

  const toggleExpanded = (idx: number): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  if (result.notAContract) {
    return (
      <div className="rounded-2xl border border-brand-amber/30 bg-brand-amber/5 p-6">
        <div className="mb-3 flex items-center gap-3">
          <AlertTriangle size={24} className="text-brand-amber" aria-hidden="true" />
          <h2 className="text-lg font-bold text-brand-amber">
            {t('results.contract.notAContractTitle')}
          </h2>
        </div>
        <p className="text-sm text-brand-text">{t('results.contract.notAContractDesc')}</p>
        {result.summary && <p className="mt-3 text-xs text-brand-text-dim">{result.summary}</p>}
      </div>
    )
  }

  // Unbelegte Befunde stehen bewusst nicht in der Hauptliste - was das Modell
  // nicht im Text zeigen kann, wird nicht wie ein Befund praesentiert.
  const indexed: IndexedClause[] = result.clauses.map((clause, idx) => ({ clause, idx }))
  const verifiedClauses = indexed.filter((e) => e.clause.verified).sort(bySeverity)
  const unverifiedClauses = indexed.filter((e) => !e.clause.verified).sort(bySeverity)

  return (
    <div className="space-y-6">
      <RiskHero risk={effectiveRisk} documentType={result.documentType} />

      <KlauselRadar findings={radarFindings} onShowInText={onShowInText} />

      <KeyTermsBlock terms={result.keyTerms} />

      {verifiedClauses.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
            <ScrollText size={12} aria-hidden="true" />
            {t('results.contract.clauses', { count: verifiedClauses.length })}
          </h3>
          <ul className="space-y-3">
            {verifiedClauses.map(({ clause, idx }) => (
              <ClauseCard
                key={idx}
                clause={clause}
                expanded={expanded.has(idx)}
                onToggle={() => toggleExpanded(idx)}
                onShowInText={onShowInText}
              />
            ))}
          </ul>
        </div>
      )}

      {unverifiedClauses.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowUnverified((prev) => !prev)}
            aria-expanded={showUnverified}
            aria-controls="contract-unverified-panel"
            className="flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-darker/60 px-3 py-1.5 text-xs text-brand-text-dim transition-colors hover:border-brand-cyan/30 hover:text-brand-cyan"
          >
            {showUnverified ? (
              <ChevronUp size={12} aria-hidden="true" />
            ) : (
              <ChevronDown size={12} aria-hidden="true" />
            )}
            {showUnverified
              ? t('results.contract.unverifiedHide')
              : t('results.contract.unverifiedShow', { count: unverifiedClauses.length })}
          </button>

          <div id="contract-unverified-panel" hidden={!showUnverified} className="mt-3 space-y-3">
            <p className="rounded-xl border border-brand-amber/20 bg-brand-amber/5 px-4 py-3 text-xs leading-relaxed text-brand-amber">
              {t('results.contract.unverifiedNote')}
            </p>
            <ul className="space-y-3">
              {unverifiedClauses.map(({ clause, idx }) => (
                <ClauseCard
                  key={idx}
                  clause={clause}
                  expanded={expanded.has(idx)}
                  onToggle={() => toggleExpanded(idx)}
                  onShowInText={onShowInText}
                />
              ))}
            </ul>
          </div>
        </div>
      )}

      <MissingBlock missing={result.missingClauses} />

      <PartiesBlock parties={result.parties} />

      {result.summary && (
        <div className="rounded-2xl border border-brand-cyan/20 bg-brand-cyan/5 p-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-cyan">
            {t('results.contract.verdict')}
          </h3>
          <p className="leading-relaxed text-brand-text">{result.summary}</p>
        </div>
      )}
    </div>
  )
}
