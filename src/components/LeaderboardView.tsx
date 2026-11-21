import { useMemo, useState } from 'react'
import { ArrowUpDown } from 'lucide-react'
import type { GmTradeSummary } from '../types/trades'

type SortKey =
  | 'tradeCount'
  | 'shortWins'
  | 'netShortTermPts'
  | 'longWins'
  | 'netLongTermValue'
  | 'fleecesWon'

interface LeaderboardViewProps {
  gms: GmTradeSummary[]
  isDynasty: boolean
  focusRosterId: number | null
  onSelectManager: (rosterId: number) => void
}

export function LeaderboardView({
  gms,
  isDynasty,
  focusRosterId,
  onSelectManager,
}: LeaderboardViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>(
    isDynasty ? 'netLongTermValue' : 'netShortTermPts',
  )
  const [asc, setAsc] = useState(false)

  const sorted = useMemo(() => {
    return [...gms].sort((a, b) => {
      const diff = Number(b[sortKey]) - Number(a[sortKey])
      return asc ? -diff : diff
    })
  }, [gms, sortKey, asc])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setAsc((p) => !p)
    else {
      setSortKey(key)
      setAsc(false)
    }
  }

  return (
    <>
      <div className="desktop-table-view">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Franchise</th>
                <th onClick={() => handleSort('tradeCount')}>
                  Trades <ArrowUpDown size={10} />
                </th>
                <th onClick={() => handleSort('shortWins')}>
                  Short-Term W-L <ArrowUpDown size={10} />
                </th>
                <th onClick={() => handleSort('netShortTermPts')}>
                  Net ST Impact <ArrowUpDown size={10} />
                </th>
                {isDynasty && (
                  <>
                    <th onClick={() => handleSort('longWins')}>
                      Long-Term W-L <ArrowUpDown size={10} />
                    </th>
                    <th onClick={() => handleSort('netLongTermValue')}>
                      Net Dynasty Val <ArrowUpDown size={10} />
                    </th>
                  </>
                )}
                <th onClick={() => handleSort('fleecesWon')}>
                  Fleeces <ArrowUpDown size={10} />
                </th>
                <th>Top Partner</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((gm, idx) => (
                <tr
                  key={gm.rosterId}
                  className={focusRosterId === gm.rosterId ? 'highlight-row' : ''}
                  onClick={() => onSelectManager(gm.rosterId)}
                  style={{ cursor: 'pointer' }}
                  title="Click to filter Trades Feed to this manager"
                >
                  <td style={{ color: 'var(--muted)' }}>{idx + 1}</td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{gm.teamName}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>@{gm.ownerHandle}</div>
                  </td>
                  <td>{gm.tradeCount}</td>
                  <td>
                    {gm.shortWins}-{gm.shortLosses}
                    {gm.shortEven > 0 ? `-${gm.shortEven}` : ''}
                  </td>
                  <td className={gm.netShortTermPts >= 0 ? 'num-pos' : 'num-neg'}>
                    {gm.netShortTermPts >= 0 ? '+' : ''}
                    {gm.netShortTermPts.toFixed(1)}
                  </td>
                  {isDynasty && (
                    <>
                      <td>
                        {gm.longWins}-{gm.longLosses}
                        {gm.longEven > 0 ? `-${gm.longEven}` : ''}
                      </td>
                      <td className={gm.netLongTermValue >= 0 ? 'num-pos' : 'num-neg'}>
                        {gm.netLongTermValue >= 0 ? '+' : ''}
                        {gm.netLongTermValue.toLocaleString()}
                      </td>
                    </>
                  )}
                  <td>
                    {gm.fleecesWon}W / {gm.fleecesLost}L
                  </td>
                  <td>
                    {gm.favoritePartnerName
                      ? `${gm.favoritePartnerName} (${gm.favoritePartnerCount})`
                      : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mobile-cards-view">
        {sorted.map((gm, idx) => (
          <div
            key={gm.rosterId}
            className="m-card"
            onClick={() => onSelectManager(gm.rosterId)}
            style={{ cursor: 'pointer' }}
          >
            <div className="m-card-head">
              <div>
                <div style={{ font: '600 14px var(--display)', color: 'var(--ink)' }}>
                  #{idx + 1} · {gm.teamName}
                </div>
                <div style={{ font: '11px var(--mono)', color: 'var(--muted)' }}>
                  @{gm.ownerHandle} · {gm.tradeCount} trades
                </div>
              </div>
              <span
                className={`pill ${
                  (isDynasty ? gm.netLongTermValue : gm.netShortTermPts) >= 0 ? 'win' : 'loss'
                }`}
              >
                {isDynasty
                  ? `${gm.netLongTermValue >= 0 ? '+' : ''}${gm.netLongTermValue.toLocaleString()} val`
                  : `${gm.netShortTermPts >= 0 ? '+' : ''}${gm.netShortTermPts.toFixed(1)} pts`}
              </span>
            </div>

            <div className="m-card-grid">
              <div className="m-metric">
                <span>SHORT-TERM W-L</span>
                <strong>
                  {gm.shortWins}-{gm.shortLosses} ({gm.netShortTermPts >= 0 ? '+' : ''}
                  {gm.netShortTermPts.toFixed(1)})
                </strong>
              </div>
              {isDynasty && (
                <div className="m-metric">
                  <span>LONG-TERM W-L</span>
                  <strong>
                    {gm.longWins}-{gm.longLosses} ({gm.netLongTermValue >= 0 ? '+' : ''}
                    {gm.netLongTermValue.toLocaleString()})
                  </strong>
                </div>
              )}
              <div className="m-metric">
                <span>FLEECES</span>
                <strong>
                  {gm.fleecesWon}W / {gm.fleecesLost}L
                </strong>
              </div>
              <div className="m-metric">
                <span>TOP PARTNER</span>
                <strong>
                  {gm.favoritePartnerName
                    ? `${gm.favoritePartnerName} (${gm.favoritePartnerCount})`
                    : '--'}
                </strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
