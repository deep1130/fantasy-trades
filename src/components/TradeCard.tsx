import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { getFocusOutcome } from '../engine/tradeAnalyzer'
import type { AnalyzedTrade, TradeSide } from '../types/trades'

interface TradeCardProps {
  trade: AnalyzedTrade
  isDynasty: boolean
  focusRosterId: number | null
}

function winnerName(sides: TradeSide[], winnerId: number | 'even' | 'pending'): string {
  if (winnerId === 'even') return 'Even'
  if (winnerId === 'pending') return 'Pending'
  return sides.find((s) => s.rosterId === winnerId)?.teamName ?? `Team ${winnerId}`
}

export function TradeCard({ trade, isDynasty, focusRosterId }: TradeCardProps) {
  const [expanded, setExpanded] = useState(false)

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
    <article className="trade-card">
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
                <div>
                  <div className="side-team">
                    {side.teamName}
                    {isFocus && (
                      <span
                        className="pill accent"
                        style={{ marginLeft: 7, fontSize: 9, padding: '1px 5px' }}
                      >
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="side-handle">@{side.ownerHandle} · Received</div>
                </div>

                <div className="side-scores">
                  <span
                    className={`score-chip ${isShortWin ? 'winner' : ''}`}
                    title="Short-Term Win-Now Score (post-trade points)"
                  >
                    ST {side.shortTermPts.toFixed(1)} pts
                  </span>
                  {isDynasty && (
                    <span
                      className={`score-chip ${isLongWin ? 'winner' : ''}`}
                      title="Long-Term Dynasty Score (current value + multi-year pts credit)"
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
                        {asset.position && (
                          <span className="asset-pos">{asset.position}</span>
                        )}
                        {asset.kind === 'pick' && !asset.position && (
                          <span className="asset-pos">PICK</span>
                        )}
                        {asset.kind === 'faab' && (
                          <span className="asset-pos">FAAB</span>
                        )}
                        <span>{asset.label}</span>
                      </div>
                      {asset.sublabel && (
                        <div className="asset-sub">
                          {asset.sublabel}
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
                          <span>{asset.starterPts.toFixed(1)} starter</span>
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
          ST Margin: {trade.shortTermMargin.toFixed(1)} pts
          {isDynasty && ` · LT Margin: ${trade.longTermMargin.toLocaleString()} val`}
        </span>
        <button
          type="button"
          className="expand-btn"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          <span>{expanded ? 'Hide Audit' : 'View Audit Breakdown'}</span>
        </button>
      </div>

      {expanded && (
        <div className="trade-breakdown">
          {trade.sides.map((side) => (
            <div key={side.rosterId} className="breakdown-box">
              <h4>{side.teamName}</h4>
              <div className="breakdown-line">
                <span>Same-Season Post-Trade Pts</span>
                <strong>{side.shortTermPts.toFixed(1)}</strong>
              </div>
              <div className="breakdown-line">
                <span>Started in Lineup Pts</span>
                <strong>{side.starterPts.toFixed(1)}</strong>
              </div>
              <div className="breakdown-line">
                <span>Short-Term Score (incl. fresh ROS)</span>
                <strong>{side.shortTermScore.toFixed(1)}</strong>
              </div>
              {isDynasty && (
                <>
                  <div className="breakdown-line">
                    <span>Current Dynasty Value</span>
                    <strong>{side.currentDynastyValue.toLocaleString()}</strong>
                  </div>
                  <div className="breakdown-line">
                    <span>Multi-Season Realized Pts</span>
                    <strong>{side.multiSeasonPts.toFixed(1)}</strong>
                  </div>
                  <div className="breakdown-line">
                    <span>Combined Long-Term Score</span>
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
