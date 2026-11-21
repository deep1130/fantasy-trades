import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftRight, Award, CircleAlert, Trophy, Users } from 'lucide-react'
import { fetchDynastyValues } from './api/dynastyValues'
import { fetchSleeperPlayers, fetchUserLeagues, loadLeagueHistory } from './api/sleeper'
import { HeroInput } from './components/HeroInput'
import { KpiStrip } from './components/KpiStrip'
import { LeaderboardView } from './components/LeaderboardView'
import { MethodologySection } from './components/MethodologySection'
import { PartnerMatrixView } from './components/PartnerMatrixView'
import { SuperlativesView } from './components/SuperlativesView'
import { TopBar } from './components/TopBar'
import { TradeCard } from './components/TradeCard'
import { TradeFilters, type OutcomeFilter } from './components/TradeFilters'
import { computeLeagueStats } from './engine/leagueStats'
import { analyzeLeagueTrades, getFocusOutcome } from './engine/tradeAnalyzer'
import type {
  AnalyzedTrade,
  DynastyValueMap,
  LeagueHistoryBundle,
  UserLeagueSummary,
} from './types/trades'
import './styles/layout.css'
import './styles/views.css'

type ViewTab = 'trades' | 'leaderboard' | 'partners' | 'superlatives'

interface RecentLeague {
  id: string
  name: string
  season: string
}

const RECENT_KEY = 'fantasy-trades-recent-leagues-v1'

function readRecentLeagues(): RecentLeague[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? (parsed as RecentLeague[]).slice(0, 5) : []
  } catch {
    return []
  }
}

function writeRecentLeagues(items: RecentLeague[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, 5)))
  } catch {
    // Ignore storage quota errors
  }
}

export default function App() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const [inputValue, setInputValue] = useState(
    () => params.get('league') || params.get('user') || '',
  )
  const [activeLeagueId, setActiveLeagueId] = useState(() => params.get('league') || '')
  const [view, setView] = useState<ViewTab>(() => {
    const v = params.get('view')
    return v === 'leaderboard' || v === 'partners' || v === 'superlatives' ? v : 'trades'
  })

  const [includeHistory, setIncludeHistory] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null)
  const [resolvedUserLabel, setResolvedUserLabel] = useState<string | null>(null)
  const [userLeagues, setUserLeagues] = useState<UserLeagueSummary[]>([])
  const [recentLeagues, setRecentLeagues] = useState<RecentLeague[]>(readRecentLeagues)

  const [bundle, setBundle] = useState<LeagueHistoryBundle | null>(null)
  const [valueMap, setValueMap] = useState<DynastyValueMap | null>(null)
  const [trades, setTrades] = useState<AnalyzedTrade[]>([])

  const [focusRosterId, setFocusRosterId] = useState<number | null>(() => {
    const f = params.get('focus')
    return f && /^\d+$/.test(f) ? Number(f) : null
  })
  const [partnerRosterId, setPartnerRosterId] = useState<number | null>(() => {
    const p = params.get('partner')
    return p && /^\d+$/.test(p) ? Number(p) : null
  })
  const [seasonFilter, setSeasonFilter] = useState('all')
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const abortRef = useRef<AbortController | null>(null)

  const loadByLeagueId = useCallback(
    async (leagueId: string, historyOn: boolean, autoFocusOwnerId?: string | null) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setBusy(true)
      setError(null)
      try {
        const [histBundle, playersMap] = await Promise.all([
          loadLeagueHistory(leagueId, historyOn, controller.signal),
          fetchSleeperPlayers(controller.signal),
        ])

        const dynValues = await fetchDynastyValues({
          isDynasty: histBundle.isDynasty,
          isSuperflex: histBundle.isSuperflex,
          totalTeams: histBundle.currentLeague.total_rosters,
          ppr: histBundle.ppr,
          signal: controller.signal,
        })

        const analyzed = analyzeLeagueTrades(histBundle, playersMap, dynValues)
        setBundle(histBundle)
        setValueMap(dynValues)
        setTrades(analyzed)
        setActiveLeagueId(leagueId)
        setLastUpdated(Date.now())
        setSeasonFilter('all')

        const latestSnap = histBundle.seasons[0]
        if (autoFocusOwnerId && latestSnap) {
          const match = latestSnap.rosters.find((r) => r.owner_id === autoFocusOwnerId)
          setFocusRosterId(match ? match.roster_id : null)
        } else if (resolvedUserId && latestSnap) {
          const match = latestSnap.rosters.find((r) => r.owner_id === resolvedUserId)
          if (match) setFocusRosterId(match.roster_id)
        }

        const entry: RecentLeague = {
          id: histBundle.currentLeague.league_id,
          name: histBundle.currentLeague.name,
          season: histBundle.currentLeague.season,
        }
        setRecentLeagues((prev) => {
          const next = [entry, ...prev.filter((p) => p.id !== entry.id)].slice(0, 5)
          writeRecentLeagues(next)
          return next
        })
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Failed to load league trades.')
      } finally {
        setBusy(false)
      }
    },
    [resolvedUserId],
  )

  const handleSubmit = useCallback(async () => {
    const raw = inputValue.trim()
    if (!raw) return
    const isNumericId = /^\d{8,}$/.test(raw)

    if (isNumericId) {
      setUserLeagues([])
      setResolvedUserId(null)
      setResolvedUserLabel(null)
      setFocusRosterId(null)
      setPartnerRosterId(null)
      await loadByLeagueId(raw, includeHistory, null)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setError(null)
    try {
      const userResult = await fetchUserLeagues(raw, controller.signal)
      setResolvedUserId(userResult.userId)
      setResolvedUserLabel(userResult.displayName)
      setUserLeagues(userResult.leagues)

      if (userResult.leagues.length === 0) {
        throw new Error(`No NFL leagues found for @${userResult.displayName}.`)
      }
      setPartnerRosterId(null)
      await loadByLeagueId(userResult.leagues[0].league_id, includeHistory, userResult.userId)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Unable to find Sleeper user.')
      setBusy(false)
    }
  }, [inputValue, includeHistory, loadByLeagueId])

  useEffect(() => {
    const initLeague = params.get('league')
    const initUser = params.get('user')
    if (initLeague && /^\d+$/.test(initLeague)) {
      void loadByLeagueId(initLeague, true, null)
    } else if (initUser) {
      void handleSubmit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { gmSummaries, partnerPairs, superlatives } = useMemo(() => {
    if (!bundle) {
      return {
        gmSummaries: [],
        partnerPairs: [],
        superlatives: {
          biggestFleece: null,
          bestWinWin: null,
          bestPickFlip: null,
          mostActiveDuo: null,
          mostActiveGm: null,
          topShortTermGm: null,
          topLongTermGm: null,
        },
      }
    }
    return computeLeagueStats(bundle, trades)
  }, [bundle, trades])

  const focusGm = useMemo(
    () => gmSummaries.find((g) => g.rosterId === focusRosterId) ?? null,
    [gmSummaries, focusRosterId],
  )

  const partnerRecord = useMemo(() => {
    if (focusRosterId == null || partnerRosterId == null) return null
    return (
      partnerPairs.find(
        (p) =>
          (p.rosterA === focusRosterId && p.rosterB === partnerRosterId) ||
          (p.rosterB === focusRosterId && p.rosterA === partnerRosterId),
      ) ?? null
    )
  }, [partnerPairs, focusRosterId, partnerRosterId])

  const availableSeasons = useMemo(
    () => Array.from(new Set(trades.map((t) => t.season))).sort((a, b) => Number(b) - Number(a)),
    [trades],
  )

  const filteredTrades = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return trades.filter((t) => {
      if (seasonFilter !== 'all' && t.season !== seasonFilter) return false
      if (focusRosterId != null && !t.sides.some((s) => s.rosterId === focusRosterId)) return false
      if (partnerRosterId != null && !t.sides.some((s) => s.rosterId === partnerRosterId)) {
        return false
      }

      if (outcomeFilter !== 'all') {
        if (focusRosterId != null) {
          const persp = getFocusOutcome(t, focusRosterId)
          if (outcomeFilter === 'won-both' && persp !== 'won-both') return false
          if (outcomeFilter === 'won-short' && persp !== 'won-short' && persp !== 'won-both')
            return false
          if (outcomeFilter === 'won-long' && persp !== 'won-long' && persp !== 'won-both')
            return false
          if (outcomeFilter === 'lost-both' && persp !== 'lost-both') return false
        } else {
          if (outcomeFilter === 'win-win' && t.verdict !== 'win-win') return false
          if (outcomeFilter === 'fleece' && t.verdict !== 'fleece') return false
          if (outcomeFilter === 'even' && t.verdict !== 'even') return false
        }
      }

      if (q) {
        const hay = t.sides
          .map(
            (s) =>
              `${s.teamName} ${s.ownerHandle} ${s.received.map((r) => `${r.label} ${r.sublabel ?? ''}`).join(' ')}`,
          )
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [trades, seasonFilter, focusRosterId, partnerRosterId, outcomeFilter, searchQuery])

  const handleShare = async () => {
    if (!activeLeagueId) return
    const url = new URL(window.location.href)
    url.searchParams.set('league', activeLeagueId)
    url.searchParams.set('view', view)
    if (focusRosterId != null) url.searchParams.set('focus', String(focusRosterId))
    else url.searchParams.delete('focus')
    if (partnerRosterId != null) url.searchParams.set('partner', String(partnerRosterId))
    else url.searchParams.delete('partner')

    await navigator.clipboard.writeText(url.toString())
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const seasonLabel = bundle
    ? `${bundle.currentLeague.season} · ${bundle.isDynasty ? 'DYNASTY' : 'REDRAFT'} · ${bundle.isSuperflex ? 'SF' : '1QB'}`
    : 'SLEEPER FANTASY'

  return (
    <main className="app-shell">
      <TopBar seasonLabel={seasonLabel} valueSource={valueMap?.source ?? null} />

      <HeroInput
        leagueName={bundle?.currentLeague.name ?? null}
        isDynasty={bundle?.isDynasty ?? true}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSubmit={() => void handleSubmit()}
        onShare={() => void handleShare()}
        copied={copied}
        busy={busy}
        lastUpdated={lastUpdated}
        includeHistory={includeHistory}
        onToggleHistory={() => {
          const next = !includeHistory
          setIncludeHistory(next)
          if (activeLeagueId) void loadByLeagueId(activeLeagueId, next, resolvedUserId)
        }}
        resolvedUserLabel={resolvedUserLabel}
        userLeagues={userLeagues}
        activeLeagueId={activeLeagueId}
        onSelectLeague={(lgId) => {
          setPartnerRosterId(null)
          void loadByLeagueId(lgId, includeHistory, resolvedUserId)
        }}
        recentLeagues={recentLeagues}
      />

      {error && (
        <div className="error-banner" role="alert">
          <CircleAlert size={15} />
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <KpiStrip
        bundle={bundle}
        trades={trades}
        focusGm={focusGm}
        superlatives={superlatives}
      />

      <section className="main-board-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              {view === 'trades' && 'TRADE FEED'}
              {view === 'leaderboard' && 'FRANCHISE SCORECARD'}
              {view === 'partners' && 'HEAD-TO-HEAD PARTNERS'}
              {view === 'superlatives' && 'LEAGUE SUPERLATIVES'}
              <span>·</span> {bundle ? `${trades.length} DEALS` : 'FANTASY TRADES'}
            </p>
            <h2>
              {view === 'trades' && 'Short-Term & Long-Term Trade Winners'}
              {view === 'leaderboard' && 'Manager Trade Standings & Net Value'}
              {view === 'partners' && 'Head-to-Head Trade Partner Matrix'}
              {view === 'superlatives' && 'Biggest Fleeces & Win-Win Blockbusters'}
            </h2>
          </div>

          <div className="board-tools">
            <div className="view-tabs" role="tablist">
              <button
                type="button"
                className={view === 'trades' ? 'selected' : ''}
                onClick={() => setView('trades')}
              >
                <ArrowLeftRight size={12} />
                <span>Trades</span>
                <span className="tab-count">{filteredTrades.length}</span>
              </button>
              <button
                type="button"
                className={view === 'leaderboard' ? 'selected' : ''}
                onClick={() => setView('leaderboard')}
              >
                <Trophy size={12} />
                <span>Standings</span>
              </button>
              <button
                type="button"
                className={view === 'partners' ? 'selected' : ''}
                onClick={() => setView('partners')}
              >
                <Users size={12} />
                <span>Partners</span>
              </button>
              <button
                type="button"
                className={view === 'superlatives' ? 'selected' : ''}
                onClick={() => setView('superlatives')}
              >
                <Award size={12} />
                <span>Superlatives</span>
              </button>
            </div>
          </div>
        </div>

        {view === 'leaderboard' && (
          <LeaderboardView
            gms={gmSummaries}
            isDynasty={bundle?.isDynasty ?? true}
            focusRosterId={focusRosterId}
            busy={busy}
            hasLeague={Boolean(bundle)}
            onSelectManager={(rosterId) => {
              setFocusRosterId(rosterId)
              setPartnerRosterId(null)
              setView('trades')
            }}
          />
        )}

        {view !== 'leaderboard' && !bundle ? (
          <div className="empty-card">
            <p>
              Enter any public Sleeper League ID or @username above to grade every trade by
              short-term lineup impact and long-term dynasty value.
            </p>
          </div>
        ) : null}

        {bundle && view === 'trades' && (
          <div>
            <TradeFilters
              isDynasty={bundle.isDynasty}
              gms={gmSummaries}
              partnerPairs={partnerPairs}
              focusRosterId={focusRosterId}
              onChangeFocusRoster={setFocusRosterId}
              partnerRosterId={partnerRosterId}
              onChangePartnerRoster={setPartnerRosterId}
              seasonFilter={seasonFilter}
              onChangeSeasonFilter={setSeasonFilter}
              availableSeasons={availableSeasons}
              outcomeFilter={outcomeFilter}
              onChangeOutcomeFilter={setOutcomeFilter}
              searchQuery={searchQuery}
              onChangeSearchQuery={setSearchQuery}
              partnerRecord={partnerRecord}
              filteredCount={filteredTrades.length}
            />

            {filteredTrades.length === 0 ? (
              <div className="empty-card">
                <p>No matching trades found. Try clearing a partner, season, or verdict filter.</p>
              </div>
            ) : (
              <div className="trades-list">
                {filteredTrades.map((trade) => (
                  <TradeCard
                    key={trade.id}
                    trade={trade}
                    isDynasty={bundle.isDynasty}
                    focusRosterId={focusRosterId}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {bundle && view === 'partners' && (
          <PartnerMatrixView
            pairs={partnerPairs}
            gms={gmSummaries}
            isDynasty={bundle.isDynasty}
            focusRosterId={focusRosterId}
            onInspectPair={(rA, rB) => {
              setFocusRosterId(rA)
              setPartnerRosterId(rB)
              setView('trades')
            }}
          />
        )}

        {bundle && view === 'superlatives' && (
          <SuperlativesView
            trades={trades}
            superlatives={superlatives}
            isDynasty={bundle.isDynasty}
          />
        )}

        <footer className="table-footer">
          <div className="legend">
            <span>
              <i className="legend-dot green-dot" /> TRADE WINNER / POSITIVE VALUE
            </span>
            <span>
              <i className="legend-dot red-dot" /> LOST VALUE / FLEECED
            </span>
            <span>
              <i className="legend-dot amber-dot" /> WIN-WIN (CONTENDER vs REBUILDER)
            </span>
          </div>
          <span className="simulation-note">
            {bundle
              ? `${bundle.currentLeague.total_rosters} TEAMS · ${trades.length} TRADES ANALYZED · SLEEPER API`
              : 'ENTER LEAGUE ID OR @USERNAME TO BEGIN'}
          </span>
        </footer>
      </section>

      <MethodologySection />

      <div className="bottom-note">
        UNOFFICIAL DYNASTY &amp; REDRAFT TOOL <span>·</span> LIVE TRADES &amp; SCORING POWERED BY
        SLEEPER API
      </div>
    </main>
  )
}
