import type { DynastyValueMap, SeasonSnapshot, TeamWindowTier } from '../types/trades'

export interface TeamWindowInfo {
  rosterId: number
  tier: TeamWindowTier
  rank: number
  recordLabel: string | null
  shortWeight: number
  longWeight: number
}

export function getWindowWeights(tier: TeamWindowTier): { shortWeight: number; longWeight: number } {
  if (tier === 'Contender') return { shortWeight: 0.65, longWeight: 0.35 }
  if (tier === 'Rebuilder') return { shortWeight: 0.15, longWeight: 0.85 }
  return { shortWeight: 0.45, longWeight: 0.55 }
}

export function gradeFromWeightedRatio(ratio: number): string {
  if (ratio >= 0.42) return 'A+'
  if (ratio >= 0.24) return 'A'
  if (ratio >= 0.12) return 'A-'
  if (ratio >= 0.04) return 'B+'
  if (ratio >= -0.04) return 'B'
  if (ratio >= -0.12) return 'B-'
  if (ratio >= -0.24) return 'C+'
  if (ratio >= -0.38) return 'C'
  if (ratio >= -0.52) return 'C-'
  if (ratio >= -0.7) return 'D'
  return 'F'
}

export function computeWindowFitGrade(
  shortRatio: number,
  longRatio: number,
  tier: TeamWindowTier,
  isDynasty: boolean,
): string {
  if (!isDynasty) return gradeFromWeightedRatio(shortRatio)
  const { shortWeight, longWeight } = getWindowWeights(tier)
  const effectiveShort = tier === 'Rebuilder' ? Math.max(-0.1, shortRatio) : shortRatio
  const blended = effectiveShort * shortWeight + longRatio * longWeight
  return gradeFromWeightedRatio(blended)
}

function tierFromRank(idx: number, total: number): TeamWindowTier {
  const contenderCutoff = Math.max(1, Math.round(total * 0.4))
  const rebuilderStart = total - Math.max(1, Math.round(total * 0.34))
  if (idx < contenderCutoff) return 'Contender'
  if (idx >= rebuilderStart) return 'Rebuilder'
  return 'Bubble'
}

function computeRosterRedraftStrength(
  snap: SeasonSnapshot,
  valueMap: DynastyValueMap,
): Map<number, number> {
  const map = new Map<number, number>()
  for (const r of snap.rosters) {
    const vals = (r.players ?? [])
      .map((pid) => valueMap.byPlayerId.get(pid)?.redraftValue ?? 0)
      .sort((a, b) => b - a)
      .slice(0, 9)
    map.set(
      r.roster_id,
      vals.reduce((s, x) => s + x, 0),
    )
  }
  return map
}

function computeOpeningWindowPoints(snap: SeasonSnapshot, weeksCount: number): Map<number, number> {
  const ptsMap = new Map<number, number>(snap.rosters.map((r) => [r.roster_id, 0]))
  const maxW = Math.min(weeksCount, snap.lastScoredWeek)
  for (let w = 1; w <= maxW; w += 1) {
    const ms = snap.matchupsByWeek[w] ?? []
    for (const m of ms) {
      ptsMap.set(m.roster_id, (ptsMap.get(m.roster_id) ?? 0) + (m.points ?? 0))
    }
  }
  return ptsMap
}

function normalizeScores(map: Map<number, number>): Map<number, number> {
  const vals = Array.from(map.values())
  const min = Math.min(...vals, 0)
  const max = Math.max(...vals, 1)
  const span = Math.max(1, max - min)
  const out = new Map<number, number>()
  for (const [k, v] of map.entries()) {
    out.set(k, (v - min) / span)
  }
  return out
}

export function classifyTeamWindowsAtWeek(
  snap: SeasonSnapshot,
  tradeWeek: number,
  isOffseason: boolean,
  valueMap: DynastyValueMap,
  prevSnap?: SeasonSnapshot,
): Map<number, TeamWindowInfo> {
  const rosters = snap.rosters
  const total = Math.max(1, rosters.length)

  // CASE 1: In-season trades (Week 4+) -> exact point-in-time standings through (tradeWeek - 1)
  if (!isOffseason && tradeWeek >= 4 && snap.lastScoredWeek >= 3) {
    const cutoffWeek = Math.min(tradeWeek - 1, snap.lastScoredWeek)
    const stats = new Map<number, { wins: number; losses: number; ties: number; pts: number }>()
    for (const r of rosters) {
      stats.set(r.roster_id, { wins: 0, losses: 0, ties: 0, pts: 0 })
    }

    for (let w = 1; w <= cutoffWeek; w += 1) {
      const matchups = snap.matchupsByWeek[w]
      if (!matchups || matchups.length < 2) continue

      const scored = matchups.map((m) => m.points ?? 0).sort((a, b) => b - a)
      if (scored[0] <= 0) continue
      const half = Math.floor(scored.length / 2)
      const median =
        scored.length % 2 === 0 ? (scored[half - 1] + scored[half]) / 2 : scored[half]

      for (const m of matchups) {
        const st = stats.get(m.roster_id)
        if (!st) continue
        const p = m.points ?? 0
        st.pts += p

        if (m.matchup_id != null) {
          const opp = matchups.find(
            (x) => x.matchup_id === m.matchup_id && x.roster_id !== m.roster_id,
          )
          if (opp) {
            if (p > (opp.points ?? 0)) st.wins += 1
            else if (p < (opp.points ?? 0)) st.losses += 1
            else st.ties += 1
          }
        }
        if (snap.hasMedianMatch) {
          if (p >= median) st.wins += 1
          else st.losses += 1
        }
      }
    }

    const ranked = [...rosters].sort((a, b) => {
      const sa = stats.get(a.roster_id)!
      const sb = stats.get(b.roster_id)!
      if (sa.wins !== sb.wins) return sb.wins - sa.wins
      return sb.pts - sa.pts
    })

    const out = new Map<number, TeamWindowInfo>()
    ranked.forEach((r, idx) => {
      const st = stats.get(r.roster_id)!
      const tier = tierFromRank(idx, total)
      const weights = getWindowWeights(tier)
      const recordLabel =
        st.wins + st.losses + st.ties > 0
          ? `${st.wins}-${st.losses}${st.ties > 0 ? `-${st.ties}` : ''} · #${idx + 1}`
          : `#${idx + 1}`
      out.set(r.roster_id, {
        rosterId: r.roster_id,
        tier,
        rank: idx + 1,
        recordLabel,
        ...weights,
      })
    })
    return out
  }

  // CASE 2: Pre-season / Offseason / Weeks 1-3 with PRIOR SEASON history available
  // Blend prior-season finish (Champion / MaxPF / wins) with opening-month scoring or starter strength
  // so offseason trades are judged by pre-season standing rather than late-season hindsight.
  if (prevSnap && prevSnap.rosters.length > 0) {
    const prevRanked = [...prevSnap.rosters].sort((a, b) => {
      // Champion & runner-up sit at top of prior-season finish
      if (a.roster_id === prevSnap.championRosterId) return -1
      if (b.roster_id === prevSnap.championRosterId) return 1
      if (a.roster_id === prevSnap.runnerUpRosterId) return -1
      if (b.roster_id === prevSnap.runnerUpRosterId) return 1
      const wA = a.settings.wins ?? 0
      const wB = b.settings.wins ?? 0
      if (wA !== wB) return wB - wA
      const pA = (a.settings.ppts ?? a.settings.fpts ?? 0) + (a.settings.ppts_decimal ?? 0) / 100
      const pB = (b.settings.ppts ?? b.settings.fpts ?? 0) + (b.settings.ppts_decimal ?? 0) / 100
      return pB - pA
    })

    const prevRankByRoster = new Map<number, number>()
    const prevRawScore = new Map<number, number>()
    prevRanked.forEach((r, idx) => {
      prevRankByRoster.set(r.roster_id, idx + 1)
      const maxPf = (r.settings.ppts ?? r.settings.fpts ?? 0) + (r.settings.ppts_decimal ?? 0) / 100
      const titleBoost =
        r.roster_id === prevSnap.championRosterId
          ? 280
          : r.roster_id === prevSnap.runnerUpRosterId
            ? 140
            : 0
      prevRawScore.set(r.roster_id, maxPf + titleBoost)
    })

    const normPrev = normalizeScores(prevRawScore)
    const secondaryRaw =
      snap.lastScoredWeek >= 2
        ? computeOpeningWindowPoints(snap, 3)
        : computeRosterRedraftStrength(snap, valueMap)
    const normSecondary = normalizeScores(secondaryRaw)

    const composite = new Map<number, number>()
    for (const r of rosters) {
      const pScore = normPrev.get(r.roster_id) ?? 0.5
      const sScore = normSecondary.get(r.roster_id) ?? 0.5
      composite.set(r.roster_id, pScore * 0.6 + sScore * 0.4)
    }

    const ranked = [...rosters].sort(
      (a, b) => (composite.get(b.roster_id) ?? 0) - (composite.get(a.roster_id) ?? 0),
    )

    const out = new Map<number, TeamWindowInfo>()
    ranked.forEach((r, idx) => {
      const tier = tierFromRank(idx, total)
      const weights = getWindowWeights(tier)
      const prevRank = prevRankByRoster.get(r.roster_id)
      const recordLabel =
        r.roster_id === prevSnap.championRosterId
          ? `${prevSnap.league.season} Champ`
          : r.roster_id === prevSnap.runnerUpRosterId
            ? `${prevSnap.league.season} Finalist`
            : prevRank
              ? `${prevSnap.league.season} #${prevRank}`
              : `Pre-Season #${idx + 1}`

      out.set(r.roster_id, {
        rosterId: r.roster_id,
        tier,
        rank: idx + 1,
        recordLabel,
        ...weights,
      })
    })
    return out
  }

  // CASE 3: Year 1 startup offseason / Weeks 1-3 (no prior season exists)
  // Use opening-month scoring power (Weeks 1-4 PF, reflecting the drafted startup roster
  // before mid-season tear-downs) or live Top-9 starter redraft strength if unstarted.
  const openingRaw =
    snap.lastScoredWeek >= 2
      ? computeOpeningWindowPoints(snap, 4)
      : computeRosterRedraftStrength(snap, valueMap)

  const ranked = [...rosters].sort(
    (a, b) => (openingRaw.get(b.roster_id) ?? 0) - (openingRaw.get(a.roster_id) ?? 0),
  )

  const out = new Map<number, TeamWindowInfo>()
  ranked.forEach((r, idx) => {
    const tier = tierFromRank(idx, total)
    const weights = getWindowWeights(tier)
    out.set(r.roster_id, {
      rosterId: r.roster_id,
      tier,
      rank: idx + 1,
      recordLabel: `Pre-Season #${idx + 1}`,
      ...weights,
    })
  })
  return out
}
