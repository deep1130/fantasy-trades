import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { getFocusOutcome } from '../engine/tradeAnalyzer'
import type { AnalyzedTrade, TradeSide } from '../types/trades'

interface TradeCardProps {
  trade: AnalyzedTrade
  isDynasty: boolean
  focusRosterId: number | null
  highlighted?: boolean
}

function winnerName(sides: TradeSide[], winnerId: number | 'even' | 'pending'): string {
  if (winnerId === 'even') return 'Even'
  if (winnerId === 'pending') return 'Pending'
  return sides.find((s) => s.rosterId === winnerId)?.teamName ?? `Team ${winnerId}`
}

export function TradeCard({ trade, isDynasty, focusRosterId, highlighted }: TradeCardProps) {
  const [expanded, setExpanded] = useState(Boolean(highlighted))

  useEffect(() => {
    if (highlighted) setExpanded(true)
  }, [highlighted])

  const focusOutcome =
    focusRosterId != null ? getFocusOutcome(trade, focusRosterId) : null

  const verdictClass =
    focusOutcome === 'won-both'
      ? 'win'
      : focusOutcome === 'lost-both'
        ? 'loss'
        : focusOutcome === 'won-short' || focusOutcome === 'won-long' || trade.verdict === 'win-win'
          ? 'split'
          : trade.verdict === 'fleece'
            ? 'accent'
            : 'neutral'

  const dateLabel = new Date(trade.created).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <article
      id={`trade-${trade.id}`}
      className={`trade-card ${highlighted ? 'trade-card-highlighted' : ''}`}
    >
      <div className="trade-card-head">
        <div className="trade-meta">
          <span>{trade.season}</span>
          <span>·</span>
          <span>{trade.isOffseason ? 'Offseason' : `Week ${trade.week}`}</span>
          <span>·</span>
          <span>{dateLabel}</span>
          {trade.sides.length > 2 && (
            <>
              <span>·</span>
              <span>{trade.sides.length}-Team Trade</span>
            </>
          )}
        </div>

        <div className="verdict-badges">
          <span className="pill neutral">
            ST: {winnerName(trade.sides, trade.shortTermWinner)}
          </span>
          {isDynasty && (
            <span className="pill neutral">
              LT: {winnerName(trade.sides, trade.longTermWinner)}
            </span>
          )}
          <span className={`pill ${verdictClass}`}>{trade.verdictLabel}</span>
        </div>
      </div>

      <div className="trade-sides-grid">
        {trade.sides.map((side) => {
          const isFocus = focusRosterId === side.rosterId
          const isShortWin = trade.shortTermWinner === side.rosterId
          const isLongWin = trade.longTermWinner === side.rosterId

          return (
            <div
              key={side.rosterId}
              className={`trade-side ${isFocus ? 'focus-side' : ''}`}
            >
              <div className="side-header">
                <div className="side-team-wrap">
                  {side.avatarUrl ? (
                    <img
                      src={side.avatarUrl}
                      alt={side.teamName}
                      className="team-avatar"
                      loading="lazy"
                    />
                  ) : (
                    <div className="team-avatar-fallback">
                      {side.teamName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="side-team">
                      <span>{side.teamName}</span>
                      {isFocus && (
                        <span
                          className="pill accent"
                          style={{ fontSize: 9, padding: '1px 5px' }}
                        >
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="side-handle">@{side.ownerHandle} received</div>
                  </div>
                </div>

                <div className="side-scores">
                  <span
                    className={`score-chip ${isShortWin ? 'winner' : ''}`}
                    title="Short-Term Lineup Impact Score"
                  >
                    ST {side.shortTermScore.toFixed(1)}
                  </span>
                  {isDynasty && (
                    <span
                      className={`score-chip ${isLongWin ? 'winner' : ''}`}
                      title="Long-Term Dynasty Score (package-adjusted value + multi-year PAR)"
                    >
                      LT {side.longTermScore.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              <ul className="asset-list">
                {side.received.map((asset) => (
                  <li key={asset.id} className="asset-row">
                    <div className="asset-main">
                      <div className="asset-name">
                        <span className="asset-pos">
                          {asset.position ?? (asset.kind === 'pick' ? 'PICK' : 'FAAB')}
                        </span>
                        <span>{asset.label}</span>
                      </div>
                      {(asset.sublabel || (asset.leaguePpg && asset.leaguePpg > 0)) && (
                        <div className="asset-sub">
                          {asset.sublabel}
                          {asset.leaguePpg && asset.leaguePpg > 0
                            ? `${asset.sublabel ? ' · ' : ''}${asset.leaguePpg.toFixed(1)} PPG`
                            : ''}
                          {asset.resolvedFromPick ? ` · Was ${asset.resolvedFromPick}` : ''}
                        </div>
                      )}
                    </div>

                    <div className="asset-nums">
                      {isDynasty ? (
                        <>
                          <div>{asset.dynastyValue.toLocaleString()} val</div>
                          <span>
                            {asset.multiSeasonPts > 0
                              ? `${asset.multiSeasonPts.toFixed(1)} pts`
                              : asset.kind === 'pick' && !asset.resolvedFromPick
                                ? `${asset.pickTier ?? 'Mid'} proj`
                                : '0 pts'}
                          </span>
                        </>
                      ) : (
                        <>
                          <div>{asset.shortTermPts.toFixed(1)} pts</div>
                          <span>{asset.starterPts.toFixed(1)} started</span>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      <div className="trade-card-foot">
        <span>
          ST Δ {trade.shortTermMargin.toFixed(1)} impact pts
          {isDynasty && ` · LT Δ ${trade.longTermMargin.toLocaleString()} dynasty val`}
        </span>
        <button
          type="button"
          className="expand-btn"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          <span>{expanded ? 'Hide Math' : 'Score Breakdown'}</span>
        </button>
      </div>

      {expanded && (
        <div className="trade-breakdown">
          {trade.sides.map((side) => (
            <div key={side.rosterId} className="breakdown-box">
              <h4>{side.teamName}</h4>
              <div className="breakdown-line">
                <span>Post-Trade Points (Started / Total)</span>
                <strong>
                  {side.starterPts.toFixed(1)} / {side.shortTermPts.toFixed(1)}
                </strong>
              </div>
              <div className="breakdown-line">
                <span>Short-Term Lineup Impact Score</span>
                <strong>{side.shortTermScore.toFixed(1)}</strong>
              </div>
              {isDynasty && (
                <>
                  <div className="breakdown-line">
                    <span>Raw Sum Dynasty Value (League Scoring)</span>
                    <strong>{side.currentDynastyValue.toLocaleString()}</strong>
                  </div>
                  <div className="breakdown-line">
                    <span>Package / Stud Adjusted Value</span>
                    <strong>{side.packageAdjustedValue.toLocaleString()}</strong>
                  </div>
                  <div className="breakdown-line">
                    <span>Multi-Year Value Over Replacement</span>
                    <strong>+{side.realizedParBonus.toLocaleString()}</strong>
                  </div>
                  <div className="breakdown-line">
                    <span>Final Long-Term Dynasty Score</span>
                    <strong>{side.longTermScore.toLocaleString()}</strong>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </article>
  )
}
