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
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Manager</th>
            <th onClick={() => handleSort('tradeCount')}>
              Trades <ArrowUpDown size={10} />
            </th>
            <th onClick={() => handleSort('shortWins')}>
              ST Record <ArrowUpDown size={10} />
            </th>
            <th onClick={() => handleSort('netShortTermPts')}>
              Net ST Pts <ArrowUpDown size={10} />
            </th>
            {isDynasty && (
              <>
                <th onClick={() => handleSort('longWins')}>
                  LT Record <ArrowUpDown size={10} />
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
          {sorted.map((gm) => (
            <tr
              key={gm.rosterId}
              className={focusRosterId === gm.rosterId ? 'highlight-row' : ''}
              onClick={() => onSelectManager(gm.rosterId)}
              style={{ cursor: 'pointer' }}
              title="Click to filter Trades Feed to this manager"
            >
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
  )
}
