import { useMemo, useState } from 'react'
import type { GmTradeSummary, PartnerPairStats } from '../types/trades'

interface PartnerMatrixViewProps {
  pairs: PartnerPairStats[]
  gms: GmTradeSummary[]
  isDynasty: boolean
  focusRosterId: number | null
  onInspectPair: (rosterA: number, rosterB: number) => void
}

export function PartnerMatrixView({
  pairs,
  gms,
  isDynasty,
  focusRosterId,
  onInspectPair,
}: PartnerMatrixViewProps) {
  const [selectedRosterId, setSelectedRosterId] = useState<number | null>(focusRosterId)

  const activeRosterId = selectedRosterId ?? focusRosterId

  const visiblePairs = useMemo(() => {
    if (activeRosterId == null) return pairs
    return pairs.filter((p) => p.rosterA === activeRosterId || p.rosterB === activeRosterId)
  }, [pairs, activeRosterId])

  const activeGm = gms.find((g) => g.rosterId === activeRosterId) ?? null
  const bestPair = visiblePairs[0] ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Inspector Header (Expected Wins MobileMatrixInspector style) */}
      <div className="inspector-panel">
        <div className="m-inspector-picker">
          <label htmlFor="partner-inspector-select">INSPECT TRADE PARTNERS FOR:</label>
          <select
            id="partner-inspector-select"
            className="m-inspector-select"
            value={activeRosterId ?? ''}
            onChange={(e) =>
              setSelectedRosterId(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">All League Trade Partnerships ({pairs.length} pairs)</option>
            {gms.map((gm) => (
              <option key={gm.rosterId} value={gm.rosterId}>
                {gm.teamName} ({gm.tradeCount} deals)
              </option>
            ))}
          </select>
        </div>

        {activeGm && (
          <div className="m-inspector-summary-grid" style={{ marginTop: 10 }}>
            <div className="m-summary-chip">
              <span className="chip-tag">TRADE VOLUME</span>
              <strong>{activeGm.tradeCount} Deals</strong>
              <span className="chip-sub">
                {visiblePairs.length} unique league mates
              </span>
            </div>
            <div className="m-summary-chip highlight">
              <span className="chip-tag">TOP PARTNER</span>
              <strong>{activeGm.favoritePartnerName ?? '--'}</strong>
              <span className="chip-sub">
                {activeGm.favoritePartnerCount} deals completed
              </span>
            </div>
            <div className="m-summary-chip">
              <span className="chip-tag">NET VALUE</span>
              <strong>
                {isDynasty
                  ? `${activeGm.netLongTermValue >= 0 ? '+' : ''}${activeGm.netLongTermValue.toLocaleString()}`
                  : `${activeGm.netShortTermPts >= 0 ? '+' : ''}${activeGm.netShortTermPts.toFixed(1)} pts`}
              </strong>
              <span className="chip-sub">
                {bestPair ? `Most active: ${bestPair.tradeCount} deals` : 'No trades'}
              </span>
            </div>
          </div>
        )}
      </div>

      {visiblePairs.length === 0 ? (
        <div className="empty-card">
          <p>No trade pairings found for this manager yet.</p>
        </div>
      ) : (
        <>
          <div className="desktop-table-view">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>TRADE PARTNERS</th>
                    <th>DEALS</th>
                    <th>{isDynasty ? 'SHORT-TERM H2H' : 'HEAD-TO-HEAD'}</th>
                    <th>{isDynasty ? 'NET SHORT-TERM PTS' : 'NET SEASON PTS'}</th>
                    {isDynasty && (
                      <>
                        <th>LONG-TERM H2H</th>
                        <th>NET DYNASTY VAL</th>
                      </>
                    )}
                    <th>LAST TRADE</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePairs.map((pair) => {
                    const flip = activeRosterId === pair.rosterB
                    const leftName = flip ? pair.teamBName : pair.teamAName
                    const rightName = flip ? pair.teamAName : pair.teamBName
                    const leftSt = flip ? pair.bShortWins : pair.aShortWins
                    const rightSt = flip ? pair.aShortWins : pair.bShortWins
                    const leftLt = flip ? pair.bLongWins : pair.aLongWins
                    const rightLt = flip ? pair.aLongWins : pair.bLongWins
                    const netSt = flip ? -pair.aNetShortPts : pair.aNetShortPts
                    const netLt = flip ? -pair.aNetLongValue : pair.aNetLongValue

                    return (
                      <tr
                        key={`${pair.rosterA}-${pair.rosterB}`}
                        onClick={() =>
                          onInspectPair(
                            flip ? pair.rosterB : pair.rosterA,
                            flip ? pair.rosterA : pair.rosterB,
                          )
                        }
                        style={{ cursor: 'pointer' }}
                        title="Click to filter Trades Feed to this matchup"
                      >
                        <td>
                          <strong style={{ color: 'var(--ink)' }}>{leftName}</strong>{' '}
                          <span style={{ color: 'var(--muted)' }}>↔</span> {rightName}
                        </td>
                        <td>{pair.tradeCount}</td>
                        <td>
                          {leftSt} – {rightSt}
                        </td>
                        <td className={netSt >= 0 ? 'num-pos' : 'num-neg'}>
                          {netSt >= 0 ? '+' : ''}
                          {netSt.toFixed(1)}
                        </td>
                        {isDynasty && (
                          <>
                            <td>
                              {leftLt} – {rightLt}
                            </td>
                            <td className={netLt >= 0 ? 'num-pos' : 'num-neg'}>
                              {netLt >= 0 ? '+' : ''}
                              {netLt.toLocaleString()}
                            </td>
                          </>
                        )}
                        <td style={{ color: 'var(--muted)' }}>
                          {new Date(pair.lastTradeCreated).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mobile-cards-view">
            {visiblePairs.map((pair) => {
              const flip = activeRosterId === pair.rosterB
              const leftName = flip ? pair.teamBName : pair.teamAName
              const rightName = flip ? pair.teamAName : pair.teamBName
              const leftSt = flip ? pair.bShortWins : pair.aShortWins
              const rightSt = flip ? pair.aShortWins : pair.bShortWins
              const leftLt = flip ? pair.bLongWins : pair.aLongWins
              const rightLt = flip ? pair.aLongWins : pair.bLongWins
              const netSt = flip ? -pair.aNetShortPts : pair.aNetShortPts
              const netLt = flip ? -pair.aNetLongValue : pair.aNetLongValue

              return (
                <div
                  key={`${pair.rosterA}-${pair.rosterB}`}
                  className="m-standings-card"
                  onClick={() =>
                    onInspectPair(
                      flip ? pair.rosterB : pair.rosterA,
                      flip ? pair.rosterA : pair.rosterB,
                    )
                  }
                  style={{ cursor: 'pointer' }}
                >
                  <div className="m-card-header">
                    <span className="team-title">
                      {leftName} ↔ {rightName}
                    </span>
                    <span className="luck-tag neu">{pair.tradeCount} deals</span>
                  </div>
                  <div className="m-card-metrics-grid" style={{ gridTemplateColumns: isDynasty ? '1fr 1fr' : '1fr' }}>
                    <div className="m-metric-cell">
                      <span className="m-metric-label">SHORT-TERM H2H</span>
                      <strong className="m-metric-val">
                        {leftSt}–{rightSt}
                      </strong>
                      <span className="m-metric-sub">
                        {netSt >= 0 ? '+' : ''}
                        {netSt.toFixed(1)} impact pts
                      </span>
                    </div>
                    {isDynasty && (
                      <div className="m-metric-cell highlight">
                        <span className="m-metric-label">LONG-TERM H2H</span>
                        <strong className="m-metric-val accent">
                          {leftLt}–{rightLt}
                        </strong>
                        <span className="m-metric-sub">
                          {netLt >= 0 ? '+' : ''}
                          {netLt.toLocaleString()} val
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
