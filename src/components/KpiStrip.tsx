import { Award, Scale, Sparkles, TrendingUp } from 'lucide-react'
import type {
  AnalyzedTrade,
  GmTradeSummary,
  LeagueHistoryBundle,
  TradeSuperlatives,
} from '../types/trades'

interface KpiStripProps {
  bundle: LeagueHistoryBundle | null
  trades: AnalyzedTrade[]
  focusGm: GmTradeSummary | null
  superlatives: TradeSuperlatives
  onJumpToTrade: (tradeId: string) => void
}

export function KpiStrip({
  bundle,
  trades,
  focusGm,
  superlatives,
  onJumpToTrade,
}: KpiStripProps) {
  const seasonsLoaded = bundle ? bundle.seasons.map((s) => s.league.season).join(', ') : null
  const scoringTags = bundle ? bundle.scoringProfile.tags.join(' · ') : '--'
  const posNotes = bundle
    ? Object.values(bundle.scoringProfile.posAdjustmentNotes).join(' · ')
    : ''

  const topGm = bundle?.isDynasty ? superlatives.topLongTermGm : superlatives.topShortTermGm

  return (
    <section className="summary-strip" aria-label="League trade summary">
      <div className="summary-item">
        <span className="summary-label">
          <Scale size={11} style={{ marginRight: 4 }} />
          LEAGUE FORMAT & SCORING
        </span>
        <strong>
          {bundle ? `${trades.length} Trades` : '--'}
          {bundle && (
            <span className="kpi-badge neutral">
              {bundle.isDynasty ? 'DYNASTY' : 'REDRAFT'}
            </span>
          )}
        </strong>
        <span className="summary-note">
          {bundle
            ? `${scoringTags}${posNotes ? ` · ${posNotes}` : ''} (${seasonsLoaded})`
            : 'Enter a league ID or @username'}
        </span>
      </div>

      <div className="summary-item">
        <span className="summary-label">
          <TrendingUp size={11} style={{ marginRight: 4 }} />
          {focusGm ? `${focusGm.teamName.toUpperCase()} RECORD` : 'FOCUS MANAGER'}
        </span>
        <strong>
          {focusGm ? (
            <>
              <span>{focusGm.tradeCount} Deals</span>
              <span
                className={`kpi-badge ${
                  (bundle?.isDynasty ? focusGm.netLongTermValue : focusGm.netShortTermPts) >= 0
                    ? 'positive'
                    : 'negative'
                }`}
              >
                {bundle?.isDynasty
                  ? `${focusGm.longWins}-${focusGm.longLosses} LT`
                  : `${focusGm.shortWins}-${focusGm.shortLosses} ST`}
              </span>
            </>
          ) : (
            '--'
          )}
        </strong>
        <span className="summary-note">
          {focusGm
            ? `Short-Term ${focusGm.shortWins}-${focusGm.shortLosses} (${focusGm.netShortTermPts >= 0 ? '+' : ''}${focusGm.netShortTermPts.toFixed(1)} pts)`
            : 'Select a manager below to filter'}
        </span>
      </div>

      <div className="summary-item">
        <span className="summary-label">
          <Award size={11} style={{ marginRight: 4, color: 'var(--lucky-text)' }} />
          TOP TRADE SHARK
        </span>
        <strong>
          {topGm ? (
            <>
              <span>{topGm.teamName}</span>
              <span className="kpi-badge positive">
                {bundle?.isDynasty
                  ? `+${topGm.netLongTermValue.toLocaleString()}`
                  : `+${topGm.netShortTermPts.toFixed(1)} pts`}
              </span>
            </>
          ) : (
            '--'
          )}
        </strong>
        <span className="summary-note">
          {topGm
            ? `${topGm.tradeCount} trades · ${topGm.longWins} LT wins / ${topGm.shortWins} ST wins`
            : 'Best net value gained across trades'}
        </span>
      </div>

      <div
        className={`summary-item ${superlatives.biggestFleece ? 'summary-item-clickable' : ''}`}
        onClick={() => {
          if (superlatives.biggestFleece) onJumpToTrade(superlatives.biggestFleece.id)
        }}
        role={superlatives.biggestFleece ? 'button' : undefined}
        tabIndex={superlatives.biggestFleece ? 0 : undefined}
        onKeyDown={(e) => {
          if (superlatives.biggestFleece && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            onJumpToTrade(superlatives.biggestFleece.id)
          }
        }}
        title={superlatives.biggestFleece ? 'Click to jump directly to this trade' : undefined}
      >
        <span className="summary-label">
          <Sparkles size={11} style={{ marginRight: 4, color: 'var(--accent-text)' }} />
          BIGGEST FLEECE
        </span>
        <strong>
          {superlatives.biggestFleece ? (
            <>
              <span>{superlatives.biggestFleece.verdictLabel}</span>
            </>
          ) : (
            '--'
          )}
        </strong>
        <span className="summary-note">
          {superlatives.biggestFleece
            ? `${superlatives.biggestFleece.season} Wk ${superlatives.biggestFleece.week} · Δ ${superlatives.biggestFleece.longTermMargin.toLocaleString()} val / ${superlatives.biggestFleece.shortTermMargin.toFixed(1)} pts · View trade →`
            : 'Most lopsided deal in league history'}
        </span>
      </div>
    </section>
  )
}
