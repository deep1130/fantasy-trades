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
  TradedAsset,
} from '../types/trades'

interface RosterIdentity {
  rosterId: number
  ownerId: string | null
  teamName: string
  ownerHandle: string
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
    })
  }
  return map
}

function computeTierByRoster(rosters: SleeperRoster[]): Map<number, 'Early' | 'Mid' | 'Late'> {
  const scored = [...rosters].sort((a, b) => {
    const winsA = a.settings.wins ?? 0
    const winsB = b.settings.wins ?? 0
    if (winsA !== winsB) return winsA - winsB // worst record first (Early pick)
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

  // Prefer rookie/shorter draft (<= 8 rounds) over startup draft if both exist
  const rookie = completed.find((d) => (d.draft.settings?.rounds ?? 99) <= 8)
  return rookie ?? completed[0]
}

function resolveTradedPick(
  pickSeason: string,
  round: number,
  originalRosterId: number,
  seasonsByYear: Map<string, SeasonSnapshot>,
): { pick: SleeperDraftPick; draftSlot: number } | null {
  const snapshot = seasonsByYear.get(pickSeason)
  const draftEntry = findSeasonRookieDraft(snapshot)
  if (!draftEntry) return null

  const { draft, picks } = draftEntry
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
  return null
}

function computePlayerPointsFromTrade(
  playerId: string,
  receivingRosterId: number,
  tradeSeason: string,
  tradeWeek: number,
  txCreatedMs: number,
  bundle: LeagueHistoryBundle,
): {
  sameSeasonPts: number
  sameSeasonStarterPts: number
  multiSeasonPts: number
  weeksPlayedSameSeason: number
} {
  let sameSeasonPts = 0
  let sameSeasonStarterPts = 0
  let multiSeasonPts = 0
  let weeksPlayedSameSeason = 0

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
      const ptsFromTeam = teamMatchup?.players_points?.[playerId]
      const onReceivingRoster = teamMatchup?.players?.includes(playerId)

      // In trade week itself, skip if player wasn't on receiving roster yet (e.g. Sunday night trade)
      if (isSameSeason && w === startWeek && txCreatedMs > 0) {
        if (teamMatchup && teamMatchup.players && !onReceivingRoster) {
          continue
        }
      }

      let pts = 0
      if (typeof ptsFromTeam === 'number') {
        pts = ptsFromTeam
      } else {
        // Fallback: check any matchup in that week for raw player points if player moved later
        for (const m of matchups) {
          const val = m.players_points?.[playerId]
          if (typeof val === 'number') {
            pts = val
            break
          }
        }
      }

      if (pts !== 0 || onReceivingRoster) {
        multiSeasonPts += pts
        if (isSameSeason) {
          sameSeasonPts += pts
          weeksPlayedSameSeason += 1
          if (teamMatchup?.starters?.includes(playerId)) {
            sameSeasonStarterPts += pts
          }
        }
      }
    }
  }

  return {
    sameSeasonPts,
    sameSeasonStarterPts,
    multiSeasonPts,
    weeksPlayedSameSeason,
  }
}

function estimateFallbackPlayerValue(
  player: SleeperPlayerLite | undefined,
  multiSeasonPts: number,
  isDynasty: boolean,
): number {
  const baseFromPts = Math.min(6500, Math.round(multiSeasonPts * 6))
  if (!isDynasty) return Math.max(400, baseFromPts)
  const age = player?.age ?? 26
  const ageFactor = age <= 24 ? 1.25 : age >= 29 ? 0.65 : 1.0
  return Math.max(350, Math.round(baseFromPts * ageFactor))
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
      received: [],
      shortTermScore: 0,
      shortTermPts: 0,
      starterPts: 0,
      longTermScore: 0,
      currentDynastyValue: 0,
      multiSeasonPts: 0,
    })
  }

  // Players added to each roster
  for (const [playerId, receivingRosterId] of Object.entries(tx.adds ?? {})) {
    const side = sideMap.get(receivingRosterId)
    if (!side) continue

    const pLite = playersMap.get(playerId)
    const valEntry = valueMap.byPlayerId.get(playerId)
    const pts = computePlayerPointsFromTrade(
      playerId,
      receivingRosterId,
      snap.league.season,
      tx.leg || 1,
      tx.created,
      bundle,
    )

    const dynastyVal =
      valEntry?.dynastyValue ??
      estimateFallbackPlayerValue(pLite, pts.multiSeasonPts, bundle.isDynasty)
    const redraftVal =
      valEntry?.redraftValue ??
      estimateFallbackPlayerValue(pLite, pts.sameSeasonPts, false)

    const asset: TradedAsset = {
      kind: 'player',
      id: playerId,
      label: pLite?.name ?? valEntry?.name ?? `Player ${playerId}`,
      sublabel: pLite
        ? `${pLite.position} · ${pLite.team}${pLite.age ? ` · ${pLite.age}y` : ''}`
        : valEntry?.position ?? '',
      position: pLite?.position ?? valEntry?.position,
      age: pLite?.age ?? valEntry?.age ?? null,
      shortTermPts: pts.sameSeasonPts,
      starterPts: pts.sameSeasonStarterPts,
      redraftValue: redraftVal,
      multiSeasonPts: pts.multiSeasonPts,
      dynastyValue: dynastyVal,
    }
    side.received.push(asset)
  }

  // Draft picks received
  for (const pick of tx.draft_picks ?? []) {
    const side = sideMap.get(pick.owner_id)
    if (!side) continue

    const resolved = resolveTradedPick(
      pick.season,
      pick.round,
      pick.roster_id,
      seasonsByYear,
    )
    const origOwnerName =
      currentIdentities.get(pick.roster_id)?.teamName ?? `Team ${pick.roster_id}`
    const pickLabelBase = `${pick.season} ${ordinalRound(pick.round)}`

    if (resolved) {
      const draftedPlayerId = resolved.pick.player_id
      const pLite = playersMap.get(draftedPlayerId)
      const valEntry = valueMap.byPlayerId.get(draftedPlayerId)
      const draftedName =
        pLite?.name ??
        valEntry?.name ??
        `${resolved.pick.metadata?.first_name ?? ''} ${resolved.pick.metadata?.last_name ?? ''}`.trim() ??
        `Player ${draftedPlayerId}`

      const pts = computePlayerPointsFromTrade(
        draftedPlayerId,
        pick.owner_id,
        pick.season,
        1,
        0,
        bundle,
      )

      const dynastyVal =
        valEntry?.dynastyValue ??
        estimateFallbackPlayerValue(pLite, pts.multiSeasonPts, bundle.isDynasty)

      // If pick resolved in the SAME season as an offseason trade, include its same-season pts
      const sameSeasonPickPts =
        pick.season === snap.league.season ? pts.sameSeasonPts : 0
      const sameSeasonStarter =
        pick.season === snap.league.season ? pts.sameSeasonStarterPts : 0

      const slotStr = `${pick.round}.${String(resolved.draftSlot).padStart(2, '0')}`
      side.received.push({
        kind: 'pick',
        id: `${pick.season}-${pick.round}-${pick.roster_id}`,
        label: `${pick.season} ${slotStr} · ${draftedName}`,
        sublabel: `${pLite?.position ?? resolved.pick.metadata?.position ?? 'PICK'} · via ${origOwnerName}`,
        position: pLite?.position ?? resolved.pick.metadata?.position,
        age: pLite?.age ?? valEntry?.age ?? null,
        shortTermPts: sameSeasonPickPts,
        starterPts: sameSeasonStarter,
        redraftValue: valEntry?.redraftValue ?? 0,
        multiSeasonPts: pts.multiSeasonPts,
        dynastyValue: dynastyVal,
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
        redraftValue: 0,
        multiSeasonPts: 0,
        dynastyValue: pickVal,
        pickTier: tier,
      })
    }
  }

  // FAAB received
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
      redraftValue: faab.amount * 4,
      multiSeasonPts: 0,
      dynastyValue: faab.amount * 3,
    })
  }

  const sides = Array.from(sideMap.values()).filter((s) => s.received.length > 0)
  const isCurrentSeason = snap.league.season === currentSeasonStr
  const weeksElapsed = Math.max(0, snap.lastScoredWeek - (tx.leg || 1) + 1)

  for (const side of sides) {
    let stPts = 0
    let starterPts = 0
    let stRedraftBlend = 0
    let ltDynasty = 0
    let ltMultiPts = 0

    for (const a of side.received) {
      stPts += a.shortTermPts
      starterPts += a.starterPts
      stRedraftBlend += a.redraftValue
      ltDynasty += a.dynastyValue
      ltMultiPts += a.multiSeasonPts
    }

    side.shortTermPts = Math.round(stPts * 10) / 10
    side.starterPts = Math.round(starterPts * 10) / 10
    // Blend ROS redraft value when trade is fresh (<4 scored weeks since trade)
    const rosWeight = isCurrentSeason && weeksElapsed < 4 ? 0.015 : 0
    side.shortTermScore = Math.round((stPts + stRedraftBlend * rosWeight) * 10) / 10
    side.currentDynastyValue = Math.round(ltDynasty)
    side.multiSeasonPts = Math.round(ltMultiPts * 10) / 10
    side.longTermScore = Math.round(ltDynasty + ltMultiPts * 2.5)
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
  const shortDeadzone = Math.max(15, byShort[0].shortTermScore * 0.08)

  let shortTermWinner: TradeWinnerSide = 'even'
  if (isCurrentSeason && weeksElapsed === 0 && byShort[0].shortTermScore === 0) {
    shortTermWinner = 'pending'
  } else if (shortGap > shortDeadzone) {
    shortTermWinner = byShort[0].rosterId
  }

  const longGap = byLong[0].longTermScore - byLong[1].longTermScore
  const longDeadzone = Math.max(350, byLong[0].longTermScore * 0.08)

  let longTermWinner: TradeWinnerSide = 'even'
  if (longGap > longDeadzone) {
    longTermWinner = byLong[0].rosterId
  }

  if (!isDynasty) {
    // In redraft, longTermWinner mirrors ROS/final score
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
    const isBig = shortGap > Math.max(60, byShort[0].shortTermScore * 0.25)
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

  // Dynasty 2x2 classification
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
    const bigShort = shortGap > Math.max(50, byShort[0].shortTermScore * 0.22)
    const bigLong = longGap > Math.max(1200, byLong[0].longTermScore * 0.2)
    verdict = bigShort || bigLong ? 'fleece' : 'slight-edge'
    verdictLabel =
      verdict === 'fleece'
        ? `Total Fleece · ${byLong[0].teamName}`
        : `Swept Edge · ${byLong[0].teamName}`
  } else if (typeof longTermWinner === 'number') {
    const bigLong = longGap > Math.max(1500, byLong[0].longTermScore * 0.25)
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
