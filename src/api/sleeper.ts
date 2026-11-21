import type {
  LeagueHistoryBundle,
  NflState,
  SeasonSnapshot,
  SleeperDraft,
  SleeperDraftPick,
  SleeperLeague,
  SleeperMatchup,
  SleeperPlayerLite,
  SleeperRoster,
  SleeperTransaction,
  SleeperUser,
  UserLeagueSummary,
} from '../types/trades'

const SLEEPER_API = 'https://api.sleeper.app/v1'
const PLAYERS_STORAGE_KEY = 'trade-ledger-players-v1'
const PLAYERS_TTL_MS = 24 * 60 * 60 * 1000

let memoryPlayersMap: Map<string, SleeperPlayerLite> | null = null
const memoryLeagueCache = new Map<string, LeagueHistoryBundle>()

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal })
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('Sleeper league or user not found. Please check your input.')
    }
    throw new Error(`Sleeper request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export function detectIsDynasty(league: SleeperLeague): boolean {
  return Number(league.settings?.type) === 2
}

export function detectIsSuperflex(league: SleeperLeague): boolean {
  const positions = league.roster_positions ?? []
  const qbCount = positions.filter((p) => p === 'QB').length
  const sfCount = positions.filter((p) => p === 'SUPER_FLEX').length
  return qbCount >= 2 || sfCount >= 1
}

export async function fetchUserLeagues(
  usernameOrId: string,
  signal?: AbortSignal,
): Promise<{
  userId: string
  displayName: string
  leagues: UserLeagueSummary[]
}> {
  const cleaned = usernameOrId.trim().replace(/^@+/, '')
  if (!cleaned) throw new Error('Enter a Sleeper league ID or @username.')

  const user = await getJson<{ user_id?: string; display_name?: string; username?: string } | null>(
    `${SLEEPER_API}/user/${encodeURIComponent(cleaned)}`,
    signal,
  )
  if (!user?.user_id) {
    throw new Error(`Sleeper user "@${cleaned}" not found.`)
  }

  const nflState = await getJson<NflState>(`${SLEEPER_API}/state/nfl`, signal)
  const primarySeason = nflState.season || String(new Date().getFullYear())
  let rawLeagues = await getJson<SleeperLeague[]>(
    `${SLEEPER_API}/user/${user.user_id}/leagues/nfl/${primarySeason}`,
    signal,
  )

  if (!rawLeagues || rawLeagues.length === 0) {
    const prevSeason = String(Number(primarySeason) - 1)
    rawLeagues = await getJson<SleeperLeague[]>(
      `${SLEEPER_API}/user/${user.user_id}/leagues/nfl/${prevSeason}`,
      signal,
    )
  }

  const leagues: UserLeagueSummary[] = (rawLeagues ?? []).map((lg) => ({
    league_id: lg.league_id,
    name: lg.name,
    season: lg.season,
    total_rosters: lg.total_rosters,
    status: lg.status,
    isDynasty: detectIsDynasty(lg),
    isSuperflex: detectIsSuperflex(lg),
  }))

  // Sort dynasty leagues first, then active leagues
  leagues.sort((a, b) => {
    if (a.isDynasty !== b.isDynasty) return a.isDynasty ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return {
    userId: user.user_id,
    displayName: user.display_name || user.username || cleaned,
    leagues,
  }
}

async function fetchSeasonSnapshot(
  league: SleeperLeague,
  nflState: NflState,
  signal?: AbortSignal,
): Promise<SeasonSnapshot> {
  const [rosters, users, drafts] = await Promise.all([
    getJson<SleeperRoster[]>(`${SLEEPER_API}/league/${league.league_id}/rosters`, signal),
    getJson<SleeperUser[]>(`${SLEEPER_API}/league/${league.league_id}/users`, signal),
    getJson<SleeperDraft[]>(`${SLEEPER_API}/league/${league.league_id}/drafts`, signal).catch(() => []),
  ])

  const isCurrentSeason = league.season === nflState.season
  const maxWeek = isCurrentSeason
    ? Math.max(1, Math.min(18, nflState.week || 18))
    : 18

  const weekNums = Array.from({ length: maxWeek }, (_, i) => i + 1)

  const [weeklyMatchups, weeklyTxs, draftsWithPicks] = await Promise.all([
    Promise.all(
      weekNums.map(async (week) => {
        try {
          const res = await fetch(`${SLEEPER_API}/league/${league.league_id}/matchups/${week}`, { signal })
          if (!res.ok) return { week, data: [] as SleeperMatchup[] }
          const data = (await res.json()) as SleeperMatchup[]
          return { week, data: Array.isArray(data) ? data : [] }
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') throw err
          return { week, data: [] as SleeperMatchup[] }
        }
      }),
    ),
    Promise.all(
      weekNums.map(async (week) => {
        try {
          const res = await fetch(`${SLEEPER_API}/league/${league.league_id}/transactions/${week}`, { signal })
          if (!res.ok) return [] as SleeperTransaction[]
          const data = (await res.json()) as SleeperTransaction[]
          return Array.isArray(data) ? data : []
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') throw err
          return [] as SleeperTransaction[]
        }
      }),
    ),
    Promise.all(
      (drafts ?? []).map(async (draft) => {
        try {
          const picks = await getJson<SleeperDraftPick[]>(
            `${SLEEPER_API}/draft/${draft.draft_id}/picks`,
            signal,
          )
          return { draft, picks: Array.isArray(picks) ? picks : [] }
        } catch {
          return { draft, picks: [] as SleeperDraftPick[] }
        }
      }),
    ),
  ])

  const matchupsByWeek: Record<number, SleeperMatchup[]> = {}
  let lastScoredWeek = 0
  for (const item of weeklyMatchups) {
    if (item.data.length > 0) {
      matchupsByWeek[item.week] = item.data
      const hasPoints = item.data.some((m) => (m.points ?? 0) > 0)
      if (hasPoints) lastScoredWeek = Math.max(lastScoredWeek, item.week)
    }
  }

  // Deduplicate trades across rounds
  const tradeMap = new Map<string, SleeperTransaction>()
  for (const list of weeklyTxs) {
    for (const tx of list) {
      if (tx.type === 'trade' && tx.status === 'complete') {
        tradeMap.set(tx.transaction_id, tx)
      }
    }
  }

  return {
    league,
    rosters,
    users,
    matchupsByWeek,
    transactions: Array.from(tradeMap.values()),
    drafts: draftsWithPicks,
    lastScoredWeek,
  }
}

export async function loadLeagueHistory(
  leagueId: string,
  includeHistory: boolean,
  signal?: AbortSignal,
): Promise<LeagueHistoryBundle> {
  const cacheKey = `${leagueId}_${includeHistory ? 'full' : 'single'}`
  const cached = memoryLeagueCache.get(cacheKey)
  if (cached) return cached

  const [currentLeague, nflState] = await Promise.all([
    getJson<SleeperLeague>(`${SLEEPER_API}/league/${leagueId}`, signal),
    getJson<NflState>(`${SLEEPER_API}/state/nfl`, signal),
  ])

  const isDynasty = detectIsDynasty(currentLeague)
  const isSuperflex = detectIsSuperflex(currentLeague)
  const leaguesToLoad: SleeperLeague[] = [currentLeague]

  if (includeHistory && isDynasty) {
    let prevId = currentLeague.previous_league_id
    let depth = 0
    while (prevId && depth < 4) {
      try {
        const prevLeague = await getJson<SleeperLeague>(`${SLEEPER_API}/league/${prevId}`, signal)
        leaguesToLoad.push(prevLeague)
        prevId = prevLeague.previous_league_id
        depth += 1
      } catch {
        break
      }
    }
  }

  const seasons = await Promise.all(
    leaguesToLoad.map((lg) => fetchSeasonSnapshot(lg, nflState, signal)),
  )
  seasons.sort((a, b) => Number(b.league.season) - Number(a.league.season))

  const bundle: LeagueHistoryBundle = {
    currentLeague,
    nflState,
    isDynasty,
    isSuperflex,
    tepBonus: Number(currentLeague.scoring_settings?.bonus_rec_te ?? 0),
    ppr: Number(currentLeague.scoring_settings?.rec ?? 0),
    seasons,
  }

  memoryLeagueCache.set(cacheKey, bundle)
  return bundle
}

export async function fetchSleeperPlayers(signal?: AbortSignal): Promise<Map<string, SleeperPlayerLite>> {
  if (memoryPlayersMap) return memoryPlayersMap

  try {
    const raw = window.localStorage.getItem(PLAYERS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { savedAt: number; players: Record<string, SleeperPlayerLite> }
      if (Date.now() - parsed.savedAt < PLAYERS_TTL_MS && parsed.players) {
        memoryPlayersMap = new Map(Object.entries(parsed.players))
        return memoryPlayersMap
      }
    }
  } catch {
    // Ignore storage read issues
  }

  const res = await fetch(`${SLEEPER_API}/players/nfl`, { signal })
  if (!res.ok) {
    return new Map()
  }
  const rawPlayers = (await res.json()) as Record<
    string,
    {
      full_name?: string
      first_name?: string
      last_name?: string
      position?: string
      team?: string
      age?: number
    }
  >

  const liteObj: Record<string, SleeperPlayerLite> = {}
  const map = new Map<string, SleeperPlayerLite>()

  for (const [id, p] of Object.entries(rawPlayers)) {
    const pos = p.position || ''
    if (!['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(pos)) continue
    const name = p.full_name || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || `Player ${id}`
    const lite: SleeperPlayerLite = {
      id,
      name,
      position: pos,
      team: p.team || 'FA',
      age: typeof p.age === 'number' ? p.age : null,
    }
    liteObj[id] = lite
    map.set(id, lite)
  }

  memoryPlayersMap = map
  try {
    window.localStorage.setItem(
      PLAYERS_STORAGE_KEY,
      JSON.stringify({ savedAt: Date.now(), players: liteObj }),
    )
  } catch {
    // Ignore quota limits
  }

  return map
}
