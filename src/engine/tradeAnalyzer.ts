import { lookupPickValue } from '../api/dynastyValues'
import type {
  AnalyzedTrade,
  DynastyValueMap,
  DynastyVerdictType,
  FocusPerspectiveOutcome,
  LeagueHistoryBundle,
  SeasonSnapshot,
  SleeperDraft,
  SleeperDraftPick,
  SleeperPlayerLite,
  SleeperRoster,
  SleeperTransaction,
  TradeSide,
  TradeWinnerSide,
} from '../types/trades'

interface RosterIdentity {
  rosterId: number
  ownerId: string | null
  teamName: string
  ownerHandle: string
  avatarUrl: string | null
}

function getAvatarUrl(avatar?: string | null, metaAvatar?: string | null): string | null {
  if (metaAvatar && metaAvatar.startsWith('http')) return metaAvatar
  if (avatar) {
    return avatar.startsWith('http')
      ? avatar
      : `https://sleepercdn.com/avatars/thumbs/${avatar}`
  }
  return null
}

function buildIdentityMap(snapshot: SeasonSnapshot): Map<number, RosterIdentity> {
  const userMap = new Map(snapshot.users.map((u) => [u.user_id, u]))
  const map = new Map<number, RosterIdentity>()

  for (const r of snapshot.rosters) {
    const user = r.owner_id ? userMap.get(r.owner_id) : undefined
    const handle = user?.display_name || `Team ${r.roster_id}`
    const teamName = user?.metadata?.team_name?.trim() || handle
    map.set(r.roster_id, {
      rosterId: r.roster_id,
      ownerId: r.owner_id,
      teamName,
      ownerHandle: handle,
      avatarUrl: getAvatarUrl(user?.avatar, user?.metadata?.avatar),
    })
  }
  return map
}

function computeTierByRoster(rosters: SleeperRoster[]): Map<number, 'Early' | 'Mid' | 'Late'> {
  const scored = [...rosters].sort((a, b) => {
    const winsA = a.settings.wins ?? 0
    const winsB = b.settings.wins ?? 0
    if (winsA !== winsB) return winsA - winsB
    const fptsA = (a.settings.fpts ?? 0) + (a.settings.fpts_decimal ?? 0) / 100
    const fptsB = (b.settings.fpts ?? 0) + (b.settings.fpts_decimal ?? 0) / 100
    return fptsA - fptsB
  })

  const total = Math.max(1, scored.length)
  const map = new Map<number, 'Early' | 'Mid' | 'Late'>()
  scored.forEach((r, idx) => {
    const ratio = idx / total
    const tier: 'Early' | 'Mid' | 'Late' =
      ratio < 0.34 ? 'Early' : ratio < 0.67 ? 'Mid' : 'Late'
    map.set(r.roster_id, tier)
  })
  return map
}

function findSeasonRookieDraft(
  snapshot: SeasonSnapshot | undefined,
): { draft: SleeperDraft; picks: SleeperDraftPick[] } | null {
  if (!snapshot || snapshot.drafts.length === 0) return null
  const completed = snapshot.drafts.filter((d) => d.picks.length > 0)
  if (completed.length === 0) return null
  const rookie = completed.find((d) => (d.draft.settings?.rounds ?? 99) <= 8)
  return rookie ?? completed[0]
}

function resolveTradedPick(
  pickSeason: string,
  round: number,
  originalRosterId: number,
  finalOwnerRosterId: number,
  seasonsByYear: Map<string, SeasonSnapshot>,
): { pick: SleeperDraftPick; draftSlot: number } | null {
  const snapshot = seasonsByYear.get(pickSeason)
  const draftEntry = findSeasonRookieDraft(snapshot)
  if (!draftEntry || !snapshot) return null

  const { draft, picks } = draftEntry

  // 1. Direct slot_to_roster_id map
  if (draft.slot_to_roster_id) {
    const matchedEntry = Object.entries(draft.slot_to_roster_id).find(
      ([, rId]) => Number(rId) === originalRosterId,
    )
    if (matchedEntry) {
      const slot = Number(matchedEntry[0])
      const found = picks.find((p) => p.round === round && p.draft_slot === slot)
      if (found && found.player_id) return { pick: found, draftSlot: slot }
    }
  }

  // 2. Fallback via draft.draft_order (user_id -> slot)
  if (draft.draft_order) {
    const origRoster = snapshot.rosters.find((r) => r.roster_id === originalRosterId)
    const slot = origRoster?.owner_id ? draft.draft_order[origRoster.owner_id] : undefined
    if (typeof slot === 'number') {
      const found = picks.find((p) => p.round === round && p.draft_slot === slot)
      if (found && found.player_id) return { pick: found, draftSlot: slot }
    }
  }

  // 3. Fallback: if finalOwnerRosterId made exactly one pick in this round
  const ownerPicksInRound = picks.filter(
    (p) => p.round === round && p.roster_id === finalOwnerRosterId && Boolean(p.player_id),
  )
  if (ownerPicksInRound.length === 1) {
    return { pick: ownerPicksInRound[0], draftSlot: ownerPicksInRound[0].draft_slot }
  }

  return null
}

function getReplacementPpg(position: string | undefined, bundle: LeagueHistoryBundle): number {
  const sp = bundle.scoringProfile
  switch (position) {
    case 'QB':
      return 13.8 + (sp.passTd - 4) * 1.1
    case 'RB':
      return 8.0 + sp.ppr * 1.4 + sp.rushAttBonus * 10
    case 'WR':
      return 8.4 + sp.ppr * 2.1
    case 'TE':
      return 5.6 + (sp.ppr + sp.tepBonus) * 2.0
    default:
      return 7.5
  }
}

function buildSeasonPpgLookup(
  bundle: LeagueHistoryBundle,
): Map<string, { ppg: number; games: number }> {
  // Compute true unweighted League PPG per player from the latest/trade seasons' matchups
  const totals = new Map<string, { pts: number; games: number }>()
  for (const snap of bundle.seasons) {
    for (let w = 1; w <= 18; w += 1) {
      const matchups = snap.matchupsByWeek[w]
      if (!matchups) continue
      const seenThisWeek = new Set<string>()
      for (const m of matchups) {
        if (!m.players_points) continue
        for (const [pid, val] of Object.entries(m.players_points)) {
          if (seenThisWeek.has(pid) || typeof val !== 'number' || val <= 0) continue
          seenThisWeek.add(pid)
          const prev = totals.get(pid) ?? { pts: 0, games: 0 }
          prev.pts += val
          prev.games += 1
          totals.set(pid, prev)
        }
      }
    }
  }

  const out = new Map<string, { ppg: number; games: number }>()
  for (const [pid, { pts, games }] of totals.entries()) {
    if (games > 0) {
      out.set(pid, { ppg: Math.round((pts / games) * 10) / 10, games })
    }
  }
  return out
}

function computePlayerPointsFromTrade(
  playerId: string,
  position: string | undefined,
  receivingRosterId: number,
  tradeSeason: string,
  tradeWeek: number,
  txCreatedMs: number,
  bundle: LeagueHistoryBundle,
  seasonPpgLookup: Map<string, { ppg: number; games: number }>,
): {
  sameSeasonPts: number
  sameSeasonStarterPts: number
  sameSeasonPar: number
  multiSeasonPts: number
  multiSeasonPar: number
  weeksPlayedSameSeason: number
  activeGamesMultiSeason: number
  leaguePpg: number
} {
  let sameSeasonPts = 0
  let sameSeasonStarterPts = 0
  let sameSeasonPar = 0
  let multiSeasonPts = 0
  let multiSeasonPar = 0
  let rawUnweightedMultiPts = 0
  let weeksPlayedSameSeason = 0
  let activeGamesMultiSeason = 0

  const repPpg = getReplacementPpg(position, bundle)
  const tradeSeasonNum = Number(tradeSeason)
  const seasonsAsc = [...bundle.seasons].sort(
    (a, b) => Number(a.league.season) - Number(b.league.season),
  )

  for (const snap of seasonsAsc) {
    const snapYear = Number(snap.league.season)
    if (snapYear < tradeSeasonNum) continue

    const isSameSeason = snapYear === tradeSeasonNum
    const startWeek = isSameSeason ? Math.max(1, tradeWeek) : 1

    for (let w = startWeek; w <= 18; w += 1) {
      const matchups = snap.matchupsByWeek[w]
      if (!matchups || matchups.length === 0) continue

      const teamMatchup = matchups.find((m) => m.roster_id === receivingRosterId)
      const onReceivingRoster = Boolean(teamMatchup?.players?.includes(playerId))
      const inReceivingStarters = Boolean(teamMatchup?.starters?.includes(playerId))

      if (isSameSeason && w === startWeek && txCreatedMs > 0) {
        if (teamMatchup && teamMatchup.players && !onReceivingRoster) {
          continue
        }
      }

      // Look up points scored in this week under league scoring
      let rawWeekPts = teamMatchup?.players_points?.[playerId]
      if (typeof rawWeekPts !== 'number') {
        for (const m of matchups) {
          const val = m.players_points?.[playerId]
          if (typeof val === 'number') {
            rawWeekPts = val
            break
          }
        }
      }

      const pts = typeof rawWeekPts === 'number' ? rawWeekPts : 0
      if (pts <= 0 && !onReceivingRoster) continue

      // Full credit while on receiving roster; 40% residual credit if later flipped/dropped
      const ownershipWeight = onReceivingRoster ? 1.0 : 0.4
      const creditedPts = pts * ownershipWeight
      const weekPar =
        Math.max(0, pts - repPpg) *
        (inReceivingStarters ? 1.0 : onReceivingRoster ? 0.65 : 0.35)

      multiSeasonPts += creditedPts
      multiSeasonPar += weekPar
      if (pts > 0) {
        rawUnweightedMultiPts += pts
        activeGamesMultiSeason += 1
      }

      if (isSameSeason) {
        sameSeasonPts += creditedPts
        sameSeasonPar += weekPar
        if (onReceivingRoster) weeksPlayedSameSeason += 1
        if (inReceivingStarters) {
          sameSeasonStarterPts += pts
        }
      }
    }
  }

  // Use true unweighted post-trade PPG if games were played, else fall back to full-season League PPG
  const fallbackSeason = seasonPpgLookup.get(playerId)
  const leaguePpg =
    activeGamesMultiSeason > 0
      ? Math.round((rawUnweightedMultiPts / activeGamesMultiSeason) * 10) / 10
      : fallbackSeason?.ppg ?? 0
  const effectiveGames =
    activeGamesMultiSeason > 0 ? activeGamesMultiSeason : fallbackSeason?.games ?? 0

  return {
    sameSeasonPts: Math.round(sameSeasonPts * 10) / 10,
    sameSeasonStarterPts: Math.round(sameSeasonStarterPts * 10) / 10,
    sameSeasonPar: Math.round(sameSeasonPar * 10) / 10,
    multiSeasonPts: Math.round(multiSeasonPts * 10) / 10,
    multiSeasonPar: Math.round(multiSeasonPar * 10) / 10,
    weeksPlayedSameSeason,
    activeGamesMultiSeason: effectiveGames,
    leaguePpg,
  }
}

function getLeagueScoringMultiplier(
  position: string | undefined,
  leaguePpg: number,
  activeGames: number,
  bundle: LeagueHistoryBundle,
): number {
  const posKey = (position || 'WR') as 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF'
  const basePosMul = bundle.scoringProfile.posMultipliers[posKey] ?? 1.0

  if (activeGames < 3 || leaguePpg <= 0) return basePosMul

  const rep = getReplacementPpg(posKey, bundle)
  const starterTarget = rep * 1.45
  const ppgDeltaRatio = Math.max(-0.1, Math.min(0.12, ((leaguePpg - starterTarget) / starterTarget) * 0.18))
  return Math.round(basePosMul * (1 + ppgDeltaRatio) * 1000) / 1000
}

function estimateFallbackPlayerValue(
  player: SleeperPlayerLite | undefined,
  multiSeasonPar: number,
  isDynasty: boolean,
): number {
  const baseFromPar = Math.min(6500, Math.round(multiSeasonPar * 22 + 600))
  if (!isDynasty) return Math.max(400, baseFromPar)
  const age = player?.age ?? 26
  const ageFactor = age <= 24 ? 1.25 : age >= 29 ? 0.65 : 1.0
  return Math.max(350, Math.round(baseFromPar * ageFactor))
}

function ordinalRound(round: number): string {
  if (round === 1) return '1st'
  if (round === 2) return '2nd'
  if (round === 3) return '3rd'
  return `${round}th`
}

function buildTradeSides(
  tx: SleeperTransaction,
  snap: SeasonSnapshot,
  bundle: LeagueHistoryBundle,
  playersMap: Map<string, SleeperPlayerLite>,
  valueMap: DynastyValueMap,
  seasonsByYear: Map<string, SeasonSnapshot>,
  currentIdentities: Map<number, RosterIdentity>,
  seasonIdentities: Map<number, RosterIdentity>,
  pickTiers: Map<number, 'Early' | 'Mid' | 'Late'>,
  seasonPpgLookup: Map<string, { ppg: number; games: number }>,
): TradeSide[] {
  const currentSeasonStr = bundle.currentLeague.season
  const sideMap = new Map<number, TradeSide>()

  const rosterIds = Array.from(
    new Set([
      ...(tx.roster_ids ?? []),
      ...Object.values(tx.adds ?? {}),
      ...(tx.draft_picks ?? []).map((p) => p.owner_id),
      ...(tx.waiver_budget ?? []).map((w) => w.receiver),
    ]),
  )

  for (const rId of rosterIds) {
    const idInfo = currentIdentities.get(rId) ?? seasonIdentities.get(rId)
    sideMap.set(rId, {
      rosterId: rId,
      ownerId: idInfo?.ownerId ?? null,
      teamName: idInfo?.teamName ?? `Team ${rId}`,
      ownerHandle: idInfo?.ownerHandle ?? `Team ${rId}`,
      avatarUrl: idInfo?.avatarUrl ?? null,
      received: [],
      shortTermScore: 0,
      shortTermPts: 0,
      starterPts: 0,
      longTermScore: 0,
      currentDynastyValue: 0,
      packageAdjustedValue: 0,
      realizedParBonus: 0,
      multiSeasonPts: 0,
    })
  }

  for (const [playerId, receivingRosterId] of Object.entries(tx.adds ?? {})) {
    const side = sideMap.get(receivingRosterId)
    if (!side) continue

    const pLite = playersMap.get(playerId)
    const valEntry = valueMap.byPlayerId.get(playerId)
    const pos = pLite?.position ?? valEntry?.position

    const pts = computePlayerPointsFromTrade(
      playerId,
      pos,
      receivingRosterId,
      snap.league.season,
      tx.leg || 1,
      tx.created,
      bundle,
      seasonPpgLookup,
    )

    const scoringMul = getLeagueScoringMultiplier(
      pos,
      pts.leaguePpg,
      pts.activeGamesMultiSeason,
      bundle,
    )
    const rawDynastyVal =
      valEntry?.dynastyValue ??
      estimateFallbackPlayerValue(pLite, pts.multiSeasonPar, bundle.isDynasty)
    const rawRedraftVal =
      valEntry?.redraftValue ??
      estimateFallbackPlayerValue(pLite, pts.sameSeasonPar, false)

    const dynastyVal = Math.round(rawDynastyVal * scoringMul)
    const redraftVal = Math.round(rawRedraftVal * scoringMul)

    side.received.push({
      kind: 'player',
      id: playerId,
      label: pLite?.name ?? valEntry?.name ?? `Player ${playerId}`,
      sublabel: pLite
        ? `${pLite.position} · ${pLite.team}${pLite.age ? ` · ${pLite.age}y` : ''}`
        : valEntry?.position ?? '',
      position: pos,
      age: pLite?.age ?? valEntry?.age ?? null,
      shortTermPts: pts.sameSeasonPts,
      starterPts: pts.sameSeasonStarterPts,
      parPts: pts.sameSeasonPar,
      redraftValue: redraftVal,
      multiSeasonPts: pts.multiSeasonPts,
      multiSeasonPar: pts.multiSeasonPar,
      dynastyValue: dynastyVal,
      baseDynastyValue: rawDynastyVal,
      scoringMultiplier: scoringMul,
      leaguePpg: pts.leaguePpg,
      gamesPlayed: pts.activeGamesMultiSeason,
    })
  }

  for (const pick of tx.draft_picks ?? []) {
    const side = sideMap.get(pick.owner_id)
    if (!side) continue

    const resolved = resolveTradedPick(
      pick.season,
      pick.round,
      pick.roster_id,
      pick.owner_id,
      seasonsByYear,
    )
    const origOwnerName =
      currentIdentities.get(pick.roster_id)?.teamName ?? `Team ${pick.roster_id}`
    const pickLabelBase = `${pick.season} ${ordinalRound(pick.round)}`

    if (resolved) {
      const draftedPlayerId = resolved.pick.player_id
      const pLite = playersMap.get(draftedPlayerId)
      const valEntry = valueMap.byPlayerId.get(draftedPlayerId)
      const pos = pLite?.position ?? resolved.pick.metadata?.position ?? valEntry?.position
      const draftedName =
        pLite?.name ??
        valEntry?.name ??
        (`${resolved.pick.metadata?.first_name ?? ''} ${resolved.pick.metadata?.last_name ?? ''}`.trim() ||
          `Player ${draftedPlayerId}`)

      const pts = computePlayerPointsFromTrade(
        draftedPlayerId,
        pos,
        pick.owner_id,
        pick.season,
        1,
        0,
        bundle,
        seasonPpgLookup,
      )

      const scoringMul = getLeagueScoringMultiplier(
        pos,
        pts.leaguePpg,
        pts.activeGamesMultiSeason,
        bundle,
      )
      const rawDynastyVal =
        valEntry?.dynastyValue ??
        estimateFallbackPlayerValue(pLite, pts.multiSeasonPar, bundle.isDynasty)
      const dynastyVal = Math.round(rawDynastyVal * scoringMul)

      const sameSeasonPickPts =
        pick.season === snap.league.season ? pts.sameSeasonPts : 0
      const sameSeasonStarter =
        pick.season === snap.league.season ? pts.sameSeasonStarterPts : 0
      const sameSeasonPar =
        pick.season === snap.league.season ? pts.sameSeasonPar : 0

      const slotStr = `${pick.round}.${String(resolved.draftSlot).padStart(2, '0')}`
      side.received.push({
        kind: 'pick',
        id: `${pick.season}-${pick.round}-${pick.roster_id}`,
        label: `${pick.season} ${slotStr} · ${draftedName}`,
        sublabel: `${pos ?? 'PICK'} · via ${origOwnerName}`,
        position: pos,
        age: pLite?.age ?? valEntry?.age ?? null,
        shortTermPts: sameSeasonPickPts,
        starterPts: sameSeasonStarter,
        parPts: sameSeasonPar,
        redraftValue: Math.round((valEntry?.redraftValue ?? 0) * scoringMul),
        multiSeasonPts: pts.multiSeasonPts,
        multiSeasonPar: pts.multiSeasonPar,
        dynastyValue: dynastyVal,
        baseDynastyValue: rawDynastyVal,
        scoringMultiplier: scoringMul,
        leaguePpg: pts.leaguePpg,
        gamesPlayed: pts.activeGamesMultiSeason,
        resolvedFromPick: pickLabelBase,
      })
    } else {
      const tier = pickTiers.get(pick.roster_id) ?? 'Mid'
      const pickVal = lookupPickValue(
        valueMap,
        pick.season,
        pick.round,
        tier,
        currentSeasonStr,
      )
      side.received.push({
        kind: 'pick',
        id: `${pick.season}-${pick.round}-${pick.roster_id}`,
        label: `${pickLabelBase} (${tier})`,
        sublabel: `Orig: ${origOwnerName}`,
        shortTermPts: 0,
        starterPts: 0,
        parPts: 0,
        redraftValue: 0,
        multiSeasonPts: 0,
        multiSeasonPar: 0,
        dynastyValue: pickVal,
        baseDynastyValue: pickVal,
        pickTier: tier,
      })
    }
  }

  for (const faab of tx.waiver_budget ?? []) {
    const side = sideMap.get(faab.receiver)
    if (!side || faab.amount <= 0) continue
    side.received.push({
      kind: 'faab',
      id: `faab-${faab.sender}-${faab.receiver}-${faab.amount}`,
      label: `$${faab.amount} FAAB`,
      sublabel: 'Waiver Budget',
      shortTermPts: 0,
      starterPts: 0,
      parPts: 0,
      redraftValue: faab.amount * 3,
      multiSeasonPts: 0,
      multiSeasonPar: 0,
      dynastyValue: faab.amount * 2,
      baseDynastyValue: faab.amount * 2,
    })
  }

  const sides = Array.from(sideMap.values()).filter((s) => s.received.length > 0)
  const isCurrentSeason = snap.league.season === currentSeasonStr
  const remainingWeeks = isCurrentSeason ? Math.max(0, 17 - snap.lastScoredWeek) : 0

  // Determine minimum non-FAAB asset count & active short-term player count across sides
  const minPlayerCount = Math.max(
    1,
    Math.min(
      ...sides.map(
        (s) => s.received.filter((a) => a.kind === 'player' || a.resolvedFromPick).length || 1,
      ),
    ),
  )
  const minAssetCount = Math.max(
    1,
    Math.min(...sides.map((s) => s.received.filter((a) => a.kind !== 'faab').length || 1)),
  )

  const shortSlotDecay = [1.0, 0.55, 0.3, 0.15]
  const longExtraSlotDecay = [0.76, 0.58, 0.42, 0.3]

  for (const side of sides) {
    // Sort assets by dynasty value descending for clean display & package weighting
    side.received.sort((a, b) => b.dynastyValue - a.dynastyValue || b.shortTermPts - a.shortTermPts)

    const rawStPts = side.received.reduce((s, a) => s + a.shortTermPts, 0)
    const rawStarterPts = side.received.reduce((s, a) => s + a.starterPts, 0)
    const rawMultiPts = side.received.reduce((s, a) => s + a.multiSeasonPts, 0)
    const rawDynVal = side.received.reduce((s, a) => s + a.dynastyValue, 0)

    // Short-Term Lineup-Slot Adjusted Impact Score (in fantasy points)
    // Weighs actual starter points + points above replacement + remaining current-season projection,
    // and discounts extra bench pieces in uneven 2-for-1 / 3-for-1 trades
    const stValues = side.received
      .map((a) => {
        const onFieldImpact = a.starterPts * 0.6 + a.shortTermPts * 0.4 + a.parPts * 0.45
        const rosPts =
          remainingWeeks > 0 && a.redraftValue > 0
            ? (a.redraftValue / 1000) * 1.45 * remainingWeeks
            : 0
        return onFieldImpact + rosPts
      })
      .sort((a, b) => b - a)

    let stImpactScore = 0
    stValues.forEach((val, idx) => {
      if (idx < minPlayerCount) {
        stImpactScore += val
      } else {
        const extraIdx = Math.min(shortSlotDecay.length - 1, idx - minPlayerCount + 1)
        stImpactScore += val * shortSlotDecay[extraIdx]
      }
    })

    // Long-Term Package-Adjusted Dynasty Score
    // Discounts extra depth pieces in 3-for-1 / 4-for-1 packages + adds realized multi-season PAR
    const ltAssets = [...side.received].sort(
      (a, b) =>
        b.dynastyValue + b.multiSeasonPar * 14 - (a.dynastyValue + a.multiSeasonPar * 14),
    )

    let pkgDynastyValue = 0
    let parBonus = 0
    ltAssets.forEach((asset, idx) => {
      const slotWeight =
        idx < minAssetCount
          ? 1.0
          : longExtraSlotDecay[Math.min(longExtraSlotDecay.length - 1, idx - minAssetCount)]
      pkgDynastyValue += asset.dynastyValue * slotWeight
      parBonus += Math.min(3200, asset.multiSeasonPar * 14) * slotWeight
    })

    side.shortTermPts = Math.round(rawStPts * 10) / 10
    side.starterPts = Math.round(rawStarterPts * 10) / 10
    side.shortTermScore = Math.round(stImpactScore * 10) / 10
    side.currentDynastyValue = Math.round(rawDynVal)
    side.packageAdjustedValue = Math.round(pkgDynastyValue)
    side.realizedParBonus = Math.round(parBonus)
    side.multiSeasonPts = Math.round(rawMultiPts * 10) / 10
    side.longTermScore = Math.round(pkgDynastyValue + parBonus)
  }

  // Stud Cornerstone Bonus: if the single highest-value asset in the trade is an elite stud (>=5000)
  // and beats the other side's top asset by >=1500, grant a 12% stud consolidation bonus on the gap
  if (sides.length >= 2) {
    const topByAsset = [...sides].sort(
      (a, b) => (b.received[0]?.dynastyValue ?? 0) - (a.received[0]?.dynastyValue ?? 0),
    )
    const bestAssetVal = topByAsset[0].received[0]?.dynastyValue ?? 0
    const secondBestVal = topByAsset[1].received[0]?.dynastyValue ?? 0
    if (bestAssetVal >= 5000 && bestAssetVal - secondBestVal >= 1500) {
      const studBonus = Math.round((bestAssetVal - secondBestVal) * 0.14)
      topByAsset[0].packageAdjustedValue += studBonus
      topByAsset[0].longTermScore += studBonus
    }
  }

  return sides
}

function classifyWinners(
  sides: TradeSide[],
  isDynasty: boolean,
  isCurrentSeason: boolean,
  weeksElapsed: number,
): {
  shortTermWinner: TradeWinnerSide
  longTermWinner: TradeWinnerSide
  verdict: DynastyVerdictType
  verdictLabel: string
  shortTermMargin: number
  longTermMargin: number
} {
  if (sides.length < 2) {
    return {
      shortTermWinner: 'even',
      longTermWinner: 'even',
      verdict: 'even',
      verdictLabel: 'Even',
      shortTermMargin: 0,
      longTermMargin: 0,
    }
  }

  const byShort = [...sides].sort((a, b) => b.shortTermScore - a.shortTermScore)
  const byLong = [...sides].sort((a, b) => b.longTermScore - a.longTermScore)

  const shortGap = byShort[0].shortTermScore - byShort[1].shortTermScore
  const shortDeadzone = Math.max(12, byShort[0].shortTermScore * 0.08)

  let shortTermWinner: TradeWinnerSide = 'even'
  if (isCurrentSeason && weeksElapsed === 0 && byShort[0].shortTermScore === 0) {
    shortTermWinner = 'pending'
  } else if (shortGap > shortDeadzone) {
    shortTermWinner = byShort[0].rosterId
  }

  const longGap = byLong[0].longTermScore - byLong[1].longTermScore
  const longDeadzone = Math.max(300, byLong[0].longTermScore * 0.075)

  let longTermWinner: TradeWinnerSide = 'even'
  if (longGap > longDeadzone) {
    longTermWinner = byLong[0].rosterId
  }

  if (!isDynasty) {
    if (shortTermWinner === 'pending') {
      return {
        shortTermWinner,
        longTermWinner,
        verdict: 'pending',
        verdictLabel: 'Too Early',
        shortTermMargin: Math.round(shortGap * 10) / 10,
        longTermMargin: Math.round(longGap),
      }
    }
    const isBig = shortGap > Math.max(50, byShort[0].shortTermScore * 0.24)
    return {
      shortTermWinner,
      longTermWinner,
      verdict: shortTermWinner === 'even' ? 'even' : isBig ? 'fleece' : 'slight-edge',
      verdictLabel:
        shortTermWinner === 'even'
          ? 'Even Trade'
          : isBig
            ? `Fleece · ${byShort[0].teamName}`
            : `Edge · ${byShort[0].teamName}`,
      shortTermMargin: Math.round(shortGap * 10) / 10,
      longTermMargin: Math.round(longGap),
    }
  }

  let verdict: DynastyVerdictType = 'even'
  let verdictLabel = 'Fair & Even'

  if (shortTermWinner === 'pending' && longTermWinner === 'even') {
    verdict = 'pending'
    verdictLabel = 'Too Early'
  } else if (
    typeof shortTermWinner === 'number' &&
    typeof longTermWinner === 'number' &&
    shortTermWinner !== longTermWinner
  ) {
    verdict = 'win-win'
    verdictLabel = 'Win-Win · Contender vs Rebuilder'
  } else if (
    typeof shortTermWinner === 'number' &&
    shortTermWinner === longTermWinner
  ) {
    const bigShort = shortGap > Math.max(45, byShort[0].shortTermScore * 0.22)
    const bigLong = longGap > Math.max(1100, byLong[0].longTermScore * 0.2)
    verdict = bigShort || bigLong ? 'fleece' : 'slight-edge'
    verdictLabel =
      verdict === 'fleece'
        ? `Fleece · ${byLong[0].teamName}`
        : `Edge · ${byLong[0].teamName}`
  } else if (typeof longTermWinner === 'number') {
    const bigLong = longGap > Math.max(1400, byLong[0].longTermScore * 0.24)
    verdict = bigLong ? 'fleece' : 'slight-edge'
    verdictLabel = bigLong
      ? `Long-Term Fleece · ${byLong[0].teamName}`
      : `Long-Term Edge · ${byLong[0].teamName}`
  } else if (typeof shortTermWinner === 'number') {
    verdict = 'slight-edge'
    verdictLabel = `Win-Now Edge · ${byShort[0].teamName}`
  }

  return {
    shortTermWinner,
    longTermWinner,
    verdict,
    verdictLabel,
    shortTermMargin: Math.round(shortGap * 10) / 10,
    longTermMargin: Math.round(longGap),
  }
}

export function analyzeLeagueTrades(
  bundle: LeagueHistoryBundle,
  playersMap: Map<string, SleeperPlayerLite>,
  valueMap: DynastyValueMap,
): AnalyzedTrade[] {
  const seasonsByYear = new Map(bundle.seasons.map((s) => [s.league.season, s]))
  const latestSnap = bundle.seasons[0]
  if (!latestSnap) return []

  const currentIdentities = buildIdentityMap(latestSnap)
  const pickTiers = computeTierByRoster(latestSnap.rosters)
  const seasonPpgLookup = buildSeasonPpgLookup(bundle)
  const analyzed: AnalyzedTrade[] = []

  for (const snap of bundle.seasons) {
    const seasonIdentities = buildIdentityMap(snap)
    const isCurrentSeason = snap.league.season === bundle.currentLeague.season

    for (const tx of snap.transactions) {
      const sides = buildTradeSides(
        tx,
        snap,
        bundle,
        playersMap,
        valueMap,
        seasonsByYear,
        currentIdentities,
        seasonIdentities,
        pickTiers,
        seasonPpgLookup,
      )
      if (sides.length < 2) continue

      const weeksElapsedInSeason = Math.max(0, snap.lastScoredWeek - (tx.leg || 1) + 1)
      const isOffseason = (tx.leg || 1) <= 1 && snap.lastScoredWeek === 0
      const winners = classifyWinners(
        sides,
        bundle.isDynasty,
        isCurrentSeason,
        weeksElapsedInSeason,
      )

      const totalTradeVolume = sides.reduce((sum, s) => sum + s.longTermScore, 0)

      analyzed.push({
        id: tx.transaction_id,
        season: snap.league.season,
        week: tx.leg || 1,
        created: tx.created,
        isOffseason,
        isCurrentSeason,
        sides,
        ...winners,
        totalTradeVolume,
        weeksElapsedInSeason,
      })
    }
  }

  return analyzed.sort((a, b) => b.created - a.created)
}

export function getFocusOutcome(
  trade: AnalyzedTrade,
  focusRosterId: number,
): FocusPerspectiveOutcome {
  const wonShort = trade.shortTermWinner === focusRosterId
  const wonLong = trade.longTermWinner === focusRosterId
  const lostShort =
    typeof trade.shortTermWinner === 'number' && trade.shortTermWinner !== focusRosterId
  const lostLong =
    typeof trade.longTermWinner === 'number' && trade.longTermWinner !== focusRosterId

  if (trade.verdict === 'pending') return 'pending'
  if (wonShort && wonLong) return 'won-both'
  if (wonShort && !wonLong) return 'won-short'
  if (!wonShort && wonLong) return 'won-long'
  if (lostShort || lostLong) return 'lost-both'
  return 'even'
}
