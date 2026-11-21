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
  const visiblePairs =
    focusRosterId != null
      ? pairs.filter((p) => p.rosterA === focusRosterId || p.rosterB === focusRosterId)
      : pairs

  if (visiblePairs.length === 0) {
    return (
      <div className="empty-state">
        <h3>No trade pairings found</h3>
        <p>Select another manager or clear the focus filter to see all league trade partnerships.</p>
      </div>
    )
  }

  return (
    <div>
      {focusRosterId != null && (
        <p style={{ margin: '0 0 12px', color: 'var(--muted)', font: '12px var(--mono)' }}>
          Showing partnerships for{' '}
          <strong style={{ color: 'var(--ink)' }}>
            {gms.find((g) => g.rosterId === focusRosterId)?.teamName ?? 'Selected GM'}
          </strong>
          . Click any row to jump to those exact trades.
        </p>
      )}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Trade Partners</th>
              <th>Deals</th>
              <th>Short-Term H2H</th>
              <th>Net ST Pts</th>
              {isDynasty && (
                <>
                  <th>Long-Term H2H</th>
                  <th>Net Dynasty Val</th>
                </>
              )}
              <th>Last Trade</th>
            </tr>
          </thead>
          <tbody>
            {visiblePairs.map((pair) => {
              const flip = focusRosterId === pair.rosterB
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
                  title="Click to view trades between these two managers"
                >
                  <td>
                    <strong style={{ color: 'var(--ink)' }}>{leftName}</strong>{' '}
                    <span style={{ color: 'var(--muted)' }}>vs</span> {rightName}
                  </td>
                  <td>{pair.tradeCount}</td>
                  <td>
                    {leftSt} - {rightSt}
                  </td>
                  <td className={netSt >= 0 ? 'num-pos' : 'num-neg'}>
                    {netSt >= 0 ? '+' : ''}
                    {netSt.toFixed(1)}
                  </td>
                  {isDynasty && (
                    <>
                      <td>
                        {leftLt} - {rightLt}
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
  )
}
