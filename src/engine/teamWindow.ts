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
  // Rebuilders benefit from shedding veteran points (better MaxPF draft slot),
  // so cap negative short-term penalties for rebuilders.
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

export function classifyTeamWindowsAtWeek(
  snap: SeasonSnapshot,
  tradeWeek: number,
  isOffseason: boolean,
  valueMap: DynastyValueMap,
): Map<number, TeamWindowInfo> {
  const rosters = snap.rosters
  const total = Math.max(1, rosters.length)

  // Case A: In-season trade (Week 4+) with completed prior weeks -> reconstruct exact standings at trade time
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

  // Case B: Season has games played (offseason / Weeks 1-3 trades) -> season standings + MaxPF blend
  if (snap.lastScoredWeek >= 2) {
    const ranked = [...rosters].sort((a, b) => {
      const wA = a.settings.wins ?? 0
      const wB = b.settings.wins ?? 0
      if (wA !== wB) return wB - wA
      const pA = (a.settings.ppts ?? a.settings.fpts ?? 0) + (a.settings.ppts_decimal ?? 0) / 100
      const pB = (b.settings.ppts ?? b.settings.fpts ?? 0) + (b.settings.ppts_decimal ?? 0) / 100
      return pB - pA
    })

    const out = new Map<number, TeamWindowInfo>()
    ranked.forEach((r, idx) => {
      const wins = r.settings.wins ?? 0
      const losses = r.settings.losses ?? 0
      const ties = r.settings.ties ?? 0
      const tier = tierFromRank(idx, total)
      const weights = getWindowWeights(tier)
      const recordLabel =
        wins + losses + ties > 0
          ? `${wins}-${losses}${ties > 0 ? `-${ties}` : ''} · #${idx + 1}`
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

  // Case C: Pre-season / unstarted season -> rank by top-9 starting lineup redraft value
  const rosterStrength = new Map<number, number>()
  for (const r of rosters) {
    const vals = (r.players ?? [])
      .map((pid) => valueMap.byPlayerId.get(pid)?.redraftValue ?? 0)
      .sort((a, b) => b - a)
      .slice(0, 9)
    rosterStrength.set(
      r.roster_id,
      vals.reduce((s, x) => s + x, 0),
    )
  }

  const ranked = [...rosters].sort(
    (a, b) => (rosterStrength.get(b.roster_id) ?? 0) - (rosterStrength.get(a.roster_id) ?? 0),
  )

  const out = new Map<number, TeamWindowInfo>()
  ranked.forEach((r, idx) => {
    const tier = tierFromRank(idx, total)
    const weights = getWindowWeights(tier)
    out.set(r.roster_id, {
      rosterId: r.roster_id,
      tier,
      rank: idx + 1,
      recordLabel: `Proj #${idx + 1}`,
      ...weights,
    })
  })
  return out
}
