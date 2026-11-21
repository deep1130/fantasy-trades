import { ChevronDown, Search, Users } from 'lucide-react'
import type { GmTradeSummary, PartnerPairStats } from '../types/trades'

export type OutcomeFilter =
  | 'all'
  | 'won-both'
  | 'won-short'
  | 'won-long'
  | 'lost-both'
  | 'win-win'
  | 'fleece'
  | 'even'

interface TradeFiltersProps {
  isDynasty: boolean
  gms: GmTradeSummary[]
  partnerPairs: PartnerPairStats[]
  focusRosterId: number | null
  onChangeFocusRoster: (rosterId: number | null) => void
  partnerRosterId: number | null
  onChangePartnerRoster: (rosterId: number | null) => void
  seasonFilter: string
  onChangeSeasonFilter: (season: string) => void
  availableSeasons: string[]
  outcomeFilter: OutcomeFilter
  onChangeOutcomeFilter: (outcome: OutcomeFilter) => void
  searchQuery: string
  onChangeSearchQuery: (q: string) => void
  partnerRecord: PartnerPairStats | null
  filteredCount: number
}

export function TradeFilters({
  isDynasty,
  gms,
  partnerPairs,
  focusRosterId,
  onChangeFocusRoster,
  partnerRosterId,
  onChangePartnerRoster,
  seasonFilter,
  onChangeSeasonFilter,
  availableSeasons,
  outcomeFilter,
  onChangeOutcomeFilter,
  searchQuery,
  onChangeSearchQuery,
  partnerRecord,
  filteredCount,
}: TradeFiltersProps) {
  const focusGm = gms.find((g) => g.rosterId === focusRosterId) ?? null
  const focusIsA = partnerRecord && focusRosterId === partnerRecord.rosterA

  const focusPartners =
    focusRosterId != null
      ? partnerPairs
          .filter((p) => p.rosterA === focusRosterId || p.rosterB === focusRosterId)
          .map((p) => {
            const isA = p.rosterA === focusRosterId
            return {
              partnerId: isA ? p.rosterB : p.rosterA,
              partnerName: isA ? p.teamBName : p.teamAName,
              tradeCount: p.tradeCount,
              wins: isDynasty
                ? isA
                  ? p.aLongWins
                  : p.bLongWins
                : isA
                  ? p.aShortWins
                  : p.bShortWins,
              losses: isDynasty
                ? isA
                  ? p.bLongWins
                  : p.aLongWins
                : isA
                  ? p.bShortWins
                  : p.aShortWins,
            }
          })
      : []

  return (
    <div className="inspector-panel">
      {/* Row 1: Franchise Inspector Header (Expected Wins Blunders style) */}
      <div className="inspector-header">
        <div className="inspector-identity">
          {focusGm?.avatarUrl ? (
            <img src={focusGm.avatarUrl} alt={focusGm.teamName} className="team-avatar" />
          ) : (
            <div className="team-avatar-fallback">
              {focusGm ? focusGm.teamName.charAt(0).toUpperCase() : <Users size={14} />}
            </div>
          )}

          <div className="select-wrap">
            <select
              aria-label="Filter by manager"
              className="inspector-select"
              value={focusRosterId ?? ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null
                onChangeFocusRoster(val)
                if (val === partnerRosterId) onChangePartnerRoster(null)
              }}
            >
              <option value="">All League Trades ({gms.reduce((s, g) => s + g.tradeCount, 0) / 2 | 0} deals)</option>
              {gms.map((gm) => (
                <option key={gm.rosterId} value={gm.rosterId}>
                  {gm.teamName} (@{gm.ownerHandle}) — {gm.tradeCount} deals
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="select-caret" />
          </div>
        </div>

        <div className="inspector-controls">
          <select
            aria-label="Filter by league mate"
            className="compact-select"
            value={partnerRosterId ?? ''}
            onChange={(e) =>
              onChangePartnerRoster(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">All League Mates</option>
            {gms
              .filter((g) => g.rosterId !== focusRosterId)
              .map((gm) => (
                <option key={gm.rosterId} value={gm.rosterId}>
                  vs {gm.teamName}
                </option>
              ))}
          </select>

          <select
            aria-label="Filter by verdict"
            className="compact-select"
            value={outcomeFilter}
            onChange={(e) => onChangeOutcomeFilter(e.target.value as OutcomeFilter)}
          >
            <option value="all">All Verdicts</option>
            {focusRosterId != null ? (
              <>
                <option value="won-both">Won Deal (Swept)</option>
                <option value="won-short">Won Short-Term</option>
                {isDynasty && <option value="won-long">Won Long-Term</option>}
                <option value="lost-both">Lost Deal</option>
              </>
            ) : (
              <>
                {isDynasty && <option value="win-win">Win-Win Splits</option>}
                <option value="fleece">Fleeces Only</option>
                <option value="even">Even / Fair</option>
              </>
            )}
          </select>

          {availableSeasons.length > 1 && (
            <select
              aria-label="Filter by season"
              className="compact-select"
              value={seasonFilter}
              onChange={(e) => onChangeSeasonFilter(e.target.value)}
            >
              <option value="all">All Years</option>
              {availableSeasons.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          <div className="search-box">
            <Search size={13} />
            <input
              type="text"
              placeholder="Player or pick…"
              value={searchQuery}
              onChange={(e) => onChangeSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Row 2: Quick-Jump Manager Pills */}
      <div className="quick-pills-row">
        <button
          type="button"
          className={`quick-pill ${focusRosterId === null ? 'active' : ''}`}
          onClick={() => {
            onChangeFocusRoster(null)
            onChangePartnerRoster(null)
          }}
        >
          <span>All Teams</span>
        </button>
        {gms
          .filter((g) => g.tradeCount > 0)
          .map((gm) => (
            <button
              key={gm.rosterId}
              type="button"
              className={`quick-pill ${focusRosterId === gm.rosterId ? 'active' : ''}`}
              onClick={() => {
                onChangeFocusRoster(gm.rosterId)
                if (partnerRosterId === gm.rosterId) onChangePartnerRoster(null)
              }}
            >
              <span>{gm.teamName}</span>
              <strong>{gm.tradeCount}</strong>
            </button>
          ))}
      </div>

      {/* Row 3: Quick-Jump Partner Pills when a manager is selected */}
      {focusRosterId != null && focusPartners.length > 0 && (
        <div className="quick-pills-row partner-pills">
          <span className="pills-prefix">LEAGUE MATES</span>
          <button
            type="button"
            className={`quick-pill ${partnerRosterId === null ? 'active' : ''}`}
            onClick={() => onChangePartnerRoster(null)}
          >
            <span>Any Partner</span>
          </button>
          {focusPartners.map((p) => (
            <button
              key={p.partnerId}
              type="button"
              className={`quick-pill ${partnerRosterId === p.partnerId ? 'active' : ''}`}
              onClick={() => onChangePartnerRoster(p.partnerId)}
            >
              <span>{p.partnerName}</span>
              <strong>
                {p.tradeCount} ({p.wins}-{p.losses})
              </strong>
            </button>
          ))}
        </div>
      )}

      <div className="filter-summary-bar" style={{ marginBottom: 0, marginTop: 8 }}>
        <span>SHOWING {filteredCount} MATCHING TRADES</span>
        {partnerRecord && focusRosterId != null && (
          <div className="partner-h2h-pill">
            <Users size={12} />
            <span>
              H2H vs {focusIsA ? partnerRecord.teamBName : partnerRecord.teamAName}: ST{' '}
              {focusIsA ? partnerRecord.aShortWins : partnerRecord.bShortWins}-
              {focusIsA ? partnerRecord.bShortWins : partnerRecord.aShortWins}
              {isDynasty &&
                ` · LT ${focusIsA ? partnerRecord.aLongWins : partnerRecord.bLongWins}-${focusIsA ? partnerRecord.bLongWins : partnerRecord.aLongWins}`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
