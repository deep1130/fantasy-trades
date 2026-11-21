import { useEffect, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Copy, GitBranch, Trophy } from 'lucide-react'
import { getFocusOutcome } from '../engine/tradeAnalyzer'
import type { AnalyzedTrade, TradeSide } from '../types/trades'

interface TradeCardProps {
  trade: AnalyzedTrade
  leagueName: string
  isDynasty: boolean
  focusRosterId: number | null
  highlighted?: boolean
  onFilterAssetChain: (chainKey: string, label: string) => void
}

function winnerName(sides: TradeSide[], winnerId: number | 'even' | 'pending'): string {
  if (winnerId === 'even') return 'Even'
  if (winnerId === 'pending') return 'Pending'
  return sides.find((s) => s.rosterId === winnerId)?.teamName ?? `Team ${winnerId}`
}

export function TradeCard({
  trade,
  leagueName,
  isDynasty,
  focusRosterId,
  highlighted,
  onFilterAssetChain,
}: TradeCardProps) {
  const [expanded, setExpanded] = useState(Boolean(highlighted))
  const [copiedReceipt, setCopiedReceipt] = useState(false)

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

  const hasPlayoffHero = trade.sides.some((s) => s.playoffStarterPts >= 35)

  const handleCopyReceipt = async () => {
    const when = trade.isOffseason ? `${trade.season} Offseason` : `${trade.season} Wk ${trade.week}`
    const lines = [`📊 ${when} Trade — ${leagueName}`]
    for (const s of trade.sides) {
      const recStr = s.seasonRecord ? ` (${s.seasonRecord})` : ''
      const assets = s.received.map((a) => a.label).join(', ')
      const grades = isDynasty
        ? `[ST: ${s.shortTermGrade} | LT: ${s.longTermGrade}]`
        : `[Grade: ${s.shortTermGrade}]`
      lines.push(`• ${s.teamName}${recStr} got: ${assets} ${grades}`)
    }
    const stWin = winnerName(trade.sides, trade.shortTermWinner)
    const ltWin = winnerName(trade.sides, trade.longTermWinner)
    lines.push(
      `🏆 Verdict: ${trade.verdictLabel} (${isDynasty ? `ST: ${stWin} | LT: ${ltWin}` : `Winner: ${stWin}`})`,
    )
    await navigator.clipboard.writeText(lines.join('\n'))
    setCopiedReceipt(true)
    setTimeout(() => setCopiedReceipt(false), 1800)
  }

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
          {hasPlayoffHero && (
            <span className="pill split" title="Acquired players delivered 35+ starter points in fantasy playoffs">
              <Trophy size={10} />
              Playoff Impact
            </span>
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
                    <div className="side-handle">
                      @{side.ownerHandle}
                      {side.seasonRecord ? ` · ${side.seasonRecord}` : ''}
                    </div>
                  </div>
                </div>

                <div className="side-scores">
                  <span
                    className={`score-chip ${isShortWin ? 'winner' : ''}`}
                    title="Short-Term Grade & Lineup Impact Score"
                  >
                    ST <strong>{side.shortTermGrade}</strong> · {side.shortTermScore.toFixed(1)}
                  </span>
                  {isDynasty && (
                    <span
                      className={`score-chip ${isLongWin ? 'winner' : ''}`}
                      title="Long-Term Dynasty Grade & Score"
                    >
                      LT <strong>{side.longTermGrade}</strong> · {side.longTermScore.toLocaleString()}
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
                        {asset.flipCount && asset.flipCount >= 2 && asset.chainKey && (
                          <button
                            type="button"
                            className="flip-pill"
                            onClick={() => onFilterAssetChain(asset.chainKey!, asset.label)}
                            title="View full trade chain for this asset"
                          >
                            <GitBranch size={9} />
                            <span>{asset.flipCount}×</span>
                          </button>
                        )}
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
        <div className="foot-actions">
          <button
            type="button"
            className="receipt-btn"
            onClick={() => void handleCopyReceipt()}
            title="Copy formatted trade summary for Sleeper or Discord chat"
          >
            {copiedReceipt ? <Check size={12} /> : <Copy size={12} />}
            <span>{copiedReceipt ? 'Copied!' : 'Copy Receipt'}</span>
          </button>
          <button
            type="button"
            className="expand-btn"
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            <span>{expanded ? 'Hide Math' : 'Score Breakdown'}</span>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="trade-breakdown">
          {trade.sides.map((side) => (
            <div key={side.rosterId} className="breakdown-box">
              <h4>
                {side.teamName} {side.seasonRecord ? `(${side.seasonRecord})` : ''}
              </h4>
              <div className="breakdown-line">
                <span>Post-Trade Points (Started / Total)</span>
                <strong>
                  {side.starterPts.toFixed(1)} / {side.shortTermPts.toFixed(1)}
                </strong>
              </div>
              {side.playoffStarterPts > 0 && (
                <div className="breakdown-line">
                  <span>Playoff Starter Pts (Wks 15–17)</span>
                  <strong>{side.playoffStarterPts.toFixed(1)}</strong>
                </div>
              )}
              <div className="breakdown-line">
                <span>Short-Term Lineup Impact ({side.shortTermGrade})</span>
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
                    <span>Final Long-Term Score ({side.longTermGrade})</span>
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
