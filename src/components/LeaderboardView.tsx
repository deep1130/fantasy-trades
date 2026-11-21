import { useMemo, useState } from 'react'
import { ArrowUpDown, Flame, RefreshCw, Scale, ShieldAlert } from 'lucide-react'
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
  busy: boolean
  hasLeague: boolean
  onSelectManager: (rosterId: number) => void
}

function getTier(val: number, isDynasty: boolean): {
  cls: 'very-lucky' | 'lucky' | 'neutral' | 'unlucky' | 'very-unlucky'
  label: string
} {
  const high = isDynasty ? 2200 : 120
  const low = isDynasty ? 500 : 30
  if (val >= high) return { cls: 'very-lucky', label: 'Shark' }
  if (val >= low) return { cls: 'lucky', label: 'Winner' }
  if (val <= -high) return { cls: 'very-unlucky', label: 'Fleeced' }
  if (val <= -low) return { cls: 'unlucky', label: 'Down' }
  return { cls: 'neutral', label: 'Even' }
}

export function LeaderboardView({
  gms,
  isDynasty,
  focusRosterId,
  busy,
  hasLeague,
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
                <th className="th-rank">#</th>
                <th>FRANCHISE</th>
                <th className="th-sortable" onClick={() => handleSort('tradeCount')}>
                  DEALS <ArrowUpDown size={10} />
                </th>
                <th className="th-sortable" onClick={() => handleSort('shortWins')}>
                  SHORT-TERM W–L <ArrowUpDown size={10} />
                </th>
                {isDynasty && (
                  <th className="th-sortable" onClick={() => handleSort('longWins')}>
                    LONG-TERM W–L <ArrowUpDown size={10} />
                  </th>
                )}
                <th
                  className="th-sortable"
                  onClick={() => handleSort(isDynasty ? 'netLongTermValue' : 'netShortTermPts')}
                >
                  {isDynasty ? 'NET DYNASTY VALUE' : 'NET IMPACT PTS'} <ArrowUpDown size={10} />
                </th>
                <th className="th-sortable" onClick={() => handleSort('fleecesWon')}>
                  FLEECES <ArrowUpDown size={10} />
                </th>
                <th>TOP PARTNER</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((gm, idx) => {
                const primaryMetric = isDynasty ? gm.netLongTermValue : gm.netShortTermPts
                const tier = getTier(primaryMetric, isDynasty)
                const formatted = isDynasty
                  ? `${primaryMetric >= 0 ? '+' : ''}${primaryMetric.toLocaleString()}`
                  : `${primaryMetric >= 0 ? '+' : ''}${primaryMetric.toFixed(1)}`

                return (
                  <tr
                    key={gm.rosterId}
                    className={focusRosterId === gm.rosterId ? 'highlight-row' : ''}
                    onClick={() => onSelectManager(gm.rosterId)}
                    style={{ cursor: 'pointer' }}
                    title="Click to inspect all trades for this franchise"
                  >
                    <td className="td-rank">{idx + 1}</td>
                    <td>
                      <div className="team-cell">
                        {gm.avatarUrl ? (
                          <img
                            src={gm.avatarUrl}
                            alt={gm.teamName}
                            className="team-avatar"
                            loading="lazy"
                          />
                        ) : (
                          <div className="team-avatar-fallback">
                            {gm.teamName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="team-meta">
                          <span className="team-title">{gm.teamName}</span>
                          <span className="team-sub">
                            @{gm.ownerHandle} · {gm.archetype}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="stat-primary">
                        <strong>{gm.tradeCount}</strong>
                        <span className="stat-sub">{gm.winWinCount} win-win</span>
                      </div>
                    </td>
                    <td>
                      <div className="stat-primary">
                        <strong>
                          {gm.shortWins}–{gm.shortLosses}
                          {gm.shortEven > 0 ? `–${gm.shortEven}` : ''}
                        </strong>
                        <span className="stat-sub">
                          {gm.netShortTermPts >= 0 ? '+' : ''}
                          {gm.netShortTermPts.toFixed(1)} pts
                          {gm.netWinsSwung !== 0
                            ? ` · ${gm.netWinsSwung > 0 ? '+' : ''}${gm.netWinsSwung}W swung`
                            : ''}
                        </span>
                      </div>
                    </td>
                    {isDynasty && (
                      <td>
                        <div className="stat-primary">
                          <strong>
                            {gm.longWins}–{gm.longLosses}
                            {gm.longEven > 0 ? `–${gm.longEven}` : ''}
                          </strong>
                          <span className="stat-sub">
                            {gm.tradeCount > 0
                              ? `${Math.round((gm.longWins / gm.tradeCount) * 100)}% win rate`
                              : '--'}
                          </span>
                        </div>
                      </td>
                    )}
                    <td>
                      <span className={`luck-pill ${tier.cls}`}>
                        {tier.cls === 'very-lucky' || tier.cls === 'lucky' ? (
                          <Flame size={12} />
                        ) : tier.cls === 'very-unlucky' || tier.cls === 'unlucky' ? (
                          <ShieldAlert size={12} />
                        ) : (
                          <Scale size={12} />
                        )}
                        <strong>{formatted}</strong>
                        <span className="luck-label">{tier.label}</span>
                      </span>
                    </td>
                    <td>
                      <div className="stat-primary">
                        <strong>
                          {gm.fleecesWon}W – {gm.fleecesLost}L
                        </strong>
                        <span className="stat-sub">lopsided</span>
                      </div>
                    </td>
                    <td>
                      <div className="stat-primary">
                        <strong>{gm.favoritePartnerName ?? '--'}</strong>
                        <span className="stat-sub">
                          {gm.favoritePartnerCount > 0 ? `${gm.favoritePartnerCount} deals` : 'none'}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {!hasLeague && (
                <tr>
                  <td colSpan={isDynasty ? 8 : 7} className="empty-cell">
                    {busy ? (
                      <>
                        <RefreshCw size={15} className="spin" /> Loading Sleeper league trades…
                      </>
                    ) : (
                      <div className="empty-prompt">
                        <p>
                          Enter any public Sleeper League ID or @username above to grade every trade
                          by short-term production and long-term dynasty value.
                        </p>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Adaptive Cards View (<= 820px, ZERO horizontal scrolling) */}
      <div className="mobile-cards-view">
        {hasLeague && sorted.length > 0 && (
          <div className="mobile-sort-bar">
            <div className="m-sort-field-wrap">
              <span className="m-sort-label">SORT BY</span>
              <select
                value={sortKey}
                onChange={(e) => handleSort(e.target.value as SortKey)}
                className="m-sort-select"
                aria-label="Sort standings by"
              >
                {isDynasty && <option value="netLongTermValue">Net Dynasty Value</option>}
                <option value="netShortTermPts">Net Short-Term Impact</option>
                <option value="tradeCount">Total Trades</option>
                <option value="shortWins">Short-Term Wins</option>
                {isDynasty && <option value="longWins">Long-Term Wins</option>}
                <option value="fleecesWon">Fleeces Won</option>
              </select>
            </div>
            <button
              type="button"
              className="m-sort-dir-btn"
              onClick={() => setAsc((p) => !p)}
            >
              <ArrowUpDown size={12} />
              <span>{asc ? 'ASC' : 'DESC'}</span>
            </button>
          </div>
        )}

        <div className="m-standings-card-list">
          {sorted.map((gm, idx) => {
            const primaryMetric = isDynasty ? gm.netLongTermValue : gm.netShortTermPts
            const tier = getTier(primaryMetric, isDynasty)
            const formatted = isDynasty
              ? `${primaryMetric >= 0 ? '+' : ''}${primaryMetric.toLocaleString()}`
              : `${primaryMetric >= 0 ? '+' : ''}${primaryMetric.toFixed(1)}`

            return (
              <div
                key={gm.rosterId}
                className="m-standings-card"
                onClick={() => onSelectManager(gm.rosterId)}
                style={{ cursor: 'pointer' }}
              >
                <div className="m-card-header">
                  <div className="m-card-identity">
                    <span className="m-card-rank">#{idx + 1}</span>
                    {gm.avatarUrl ? (
                      <img src={gm.avatarUrl} alt={gm.teamName} className="team-avatar" />
                    ) : (
                      <div className="team-avatar-fallback">
                        {gm.teamName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="team-meta">
                      <span className="team-title">{gm.teamName}</span>
                      <span className="team-sub">
                        @{gm.ownerHandle} · {gm.tradeCount} deals
                      </span>
                    </div>
                  </div>
                  <span className={`luck-pill ${tier.cls}`}>
                    <strong>{formatted}</strong>
                  </span>
                </div>

                <div className="m-card-metrics-grid">
                  <div className="m-metric-cell">
                    <span className="m-metric-label">SHORT-TERM</span>
                    <strong className="m-metric-val">
                      {gm.shortWins}–{gm.shortLosses}
                    </strong>
                    <span className="m-metric-sub">
                      {gm.netShortTermPts >= 0 ? '+' : ''}
                      {gm.netShortTermPts.toFixed(1)} pts
                    </span>
                  </div>
                  {isDynasty ? (
                    <div className="m-metric-cell highlight">
                      <span className="m-metric-label">LONG-TERM</span>
                      <strong className="m-metric-val accent">
                        {gm.longWins}–{gm.longLosses}
                      </strong>
                      <span className="m-metric-sub">{tier.label}</span>
                    </div>
                  ) : (
                    <div className="m-metric-cell">
                      <span className="m-metric-label">FLEECES</span>
                      <strong className="m-metric-val">
                        {gm.fleecesWon}W–{gm.fleecesLost}L
                      </strong>
                      <span className="m-metric-sub">lopsided</span>
                    </div>
                  )}
                  <div className="m-metric-cell">
                    <span className="m-metric-label">TOP PARTNER</span>
                    <strong className="m-metric-val">
                      {gm.favoritePartnerName ? gm.favoritePartnerName.slice(0, 11) : '--'}
                    </strong>
                    <span className="m-metric-sub">
                      {gm.favoritePartnerCount > 0 ? `${gm.favoritePartnerCount} deals` : 'none'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}

          {!hasLeague && (
            <div className="empty-card">
              <p>Enter any public Sleeper League ID or @username above to grade league trades.</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
