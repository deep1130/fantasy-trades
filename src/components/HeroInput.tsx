import { Check, Clock3, History, RefreshCw, Share2 } from 'lucide-react'
import type { UserLeagueSummary } from '../types/trades'

interface HeroInputProps {
  leagueName: string | null
  isDynasty: boolean
  inputValue: string
  onInputChange: (val: string) => void
  onSubmit: () => void
  onShare: () => void
  copied: boolean
  busy: boolean
  lastUpdated: number | null
  includeHistory: boolean
  onToggleHistory: () => void
  resolvedUserLabel: string | null
  userLeagues: UserLeagueSummary[]
  activeLeagueId: string
  onSelectLeague: (leagueId: string) => void
  recentLeagues: { id: string; name: string; season: string }[]
}

export function HeroInput({
  leagueName,
  isDynasty,
  inputValue,
  onInputChange,
  onSubmit,
  onShare,
  copied,
  busy,
  lastUpdated,
  includeHistory,
  onToggleHistory,
  resolvedUserLabel,
  userLeagues,
  activeLeagueId,
  onSelectLeague,
  recentLeagues,
}: HeroInputProps) {
  return (
    <section className="intro">
      <div>
        <p className="eyebrow">
          TRADE INTELLIGENCE <span>·</span>{' '}
          {leagueName ? leagueName.toUpperCase() : 'SLEEPER FANTASY'}
        </p>
        <h1>
          Every trade, <em>audited.</em>
        </h1>
        <p className="intro-copy">
          {isDynasty
            ? 'Audit every deal by short-term win-now production and long-term dynasty value across players, resolved picks, and multi-season outcomes.'
            : 'Load every league trade, filter by league mate, and compare post-trade fantasy production to crown the real deal winners.'}
        </p>
      </div>

      <div className="league-control">
        <label htmlFor="league-id">SLEEPER LEAGUE ID OR USERNAME</label>
        <div className="league-input-row">
          <input
            id="league-id"
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmit()
            }}
            placeholder="League ID or @username"
            aria-label="Sleeper League ID or username"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            type="button"
            className={`share-button ${copied ? 'copied' : ''}`}
            onClick={onShare}
            disabled={busy || !activeLeagueId}
            title="Copy shareable link"
          >
            {copied ? <Check size={13} /> : <Share2 size={13} />}
            <span>{copied ? 'Copied' : 'Share'}</span>
          </button>
          <button
            type="button"
            className="refresh-button"
            onClick={onSubmit}
            disabled={busy || !inputValue.trim()}
          >
            <RefreshCw size={13} className={busy ? 'spin' : ''} />
            <span>{busy ? 'Loading…' : 'Load'}</span>
          </button>
        </div>

        <div className="refresh-meta">
          <span className="refresh-meta-left">
            <Clock3 size={11} />
            <span>
              {lastUpdated
                ? `UPDATED ${new Date(lastUpdated).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                : 'ENTER A SLEEPER LEAGUE ID OR @USERNAME'}
            </span>
          </span>

          {isDynasty && (
            <button
              type="button"
              className={`history-toggle ${includeHistory ? 'active' : ''}`}
              onClick={onToggleHistory}
              title="Trace previous_league_id across prior dynasty seasons"
            >
              <History size={11} />
              <span>{includeHistory ? 'Multi-Year: ON' : 'Single Season'}</span>
            </button>
          )}
        </div>

        {userLeagues.length > 0 && (
          <div className="quick-leagues-row" aria-label="User leagues">
            <span className="quick-leagues-label">@{resolvedUserLabel}</span>
            {userLeagues.map((lg) => (
              <button
                key={lg.league_id}
                type="button"
                className={`quick-league-chip ${lg.league_id === activeLeagueId ? 'active' : ''}`}
                onClick={() => onSelectLeague(lg.league_id)}
                disabled={busy}
                title={`${lg.name} (${lg.season} · ${lg.status})`}
              >
                <span>{lg.name}</span>
                <span className="dynasty-badge">
                  {lg.status === 'pre_draft' ? 'PRE' : lg.isDynasty ? 'DYN' : 'RED'}
                </span>
              </button>
            ))}
          </div>
        )}

        {userLeagues.length === 0 && recentLeagues.length > 0 && (
          <div className="quick-leagues-row" aria-label="Recent leagues">
            <span className="quick-leagues-label">RECENT</span>
            {recentLeagues.map((lg) => (
              <button
                key={lg.id}
                type="button"
                className={`quick-league-chip ${lg.id === activeLeagueId ? 'active' : ''}`}
                onClick={() => onSelectLeague(lg.id)}
                disabled={busy}
              >
                <span>{lg.name}</span>
                <span className="dynasty-badge">{lg.season}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
