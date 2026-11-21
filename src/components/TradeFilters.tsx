import { Search, Users } from 'lucide-react'
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
  const focusIsA = partnerRecord && focusRosterId === partnerRecord.rosterA

  return (
    <div className="filters-bar">
      <div className="filter-group">
        <label htmlFor="focus-gm">Manager</label>
        <select
          id="focus-gm"
          className="filter-select"
          value={focusRosterId ?? ''}
          onChange={(e) => {
            const val = e.target.value ? Number(e.target.value) : null
            onChangeFocusRoster(val)
            if (val === partnerRosterId) onChangePartnerRoster(null)
          }}
        >
          <option value="">All League Trades</option>
          {gms.map((gm) => (
            <option key={gm.rosterId} value={gm.rosterId}>
              {gm.teamName} ({gm.tradeCount})
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="partner-gm">League Mate</label>
        <select
          id="partner-gm"
          className="filter-select"
          value={partnerRosterId ?? ''}
          onChange={(e) =>
            onChangePartnerRoster(e.target.value ? Number(e.target.value) : null)
          }
        >
          <option value="">Any Partner</option>
          {gms
            .filter((g) => g.rosterId !== focusRosterId)
            .map((gm) => (
              <option key={gm.rosterId} value={gm.rosterId}>
                {gm.teamName}
              </option>
            ))}
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="outcome-filter">Verdict</label>
        <select
          id="outcome-filter"
          className="filter-select"
          value={outcomeFilter}
          onChange={(e) => onChangeOutcomeFilter(e.target.value as OutcomeFilter)}
        >
          <option value="all">All Verdicts</option>
          {focusRosterId != null ? (
            <>
              <option value="won-both">Won Deal (Both / Swept)</option>
              <option value="won-short">Won Short-Term</option>
              {isDynasty && <option value="won-long">Won Long-Term (Dynasty)</option>}
              <option value="lost-both">Lost Deal</option>
            </>
          ) : (
            <>
              {isDynasty && <option value="win-win">Win-Win (Contender vs Rebuilder)</option>}
              <option value="fleece">Total Fleeces</option>
              <option value="even">Even / Fair</option>
            </>
          )}
        </select>
      </div>

      {availableSeasons.length > 1 && (
        <div className="filter-group">
          <label htmlFor="season-filter">Season</label>
          <select
            id="season-filter"
            className="filter-select"
            value={seasonFilter}
            onChange={(e) => onChangeSeasonFilter(e.target.value)}
          >
            <option value="all">All Seasons</option>
            {availableSeasons.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="search-wrap">
        <Search size={13} />
        <input
          type="text"
          className="search-input"
          placeholder="Search player, pick, team…"
          value={searchQuery}
          onChange={(e) => onChangeSearchQuery(e.target.value)}
        />
      </div>

      {partnerRecord && focusRosterId != null && (
        <div className="partner-h2h-pill">
          <Users size={12} />
          <span>
            {partnerRecord.tradeCount} trades vs{' '}
            {focusIsA ? partnerRecord.teamBName : partnerRecord.teamAName} ·{' '}
            ST {focusIsA ? partnerRecord.aShortWins : partnerRecord.bShortWins}-
            {focusIsA ? partnerRecord.bShortWins : partnerRecord.aShortWins}
            {isDynasty &&
              ` · LT ${focusIsA ? partnerRecord.aLongWins : partnerRecord.bLongWins}-${focusIsA ? partnerRecord.bLongWins : partnerRecord.aLongWins}`}
          </span>
        </div>
      )}

      {!partnerRecord && (
        <span style={{ color: 'var(--muted)', font: '11px var(--mono)' }}>
          {filteredCount} shown
        </span>
      )}
    </div>
  )
}
