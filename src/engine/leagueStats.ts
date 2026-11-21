import type {
  AnalyzedTrade,
  GmTradeSummary,
  LeagueHistoryBundle,
  PartnerPairStats,
  TradeSuperlatives,
  TradedAsset,
} from '../types/trades'

export function computeLeagueStats(
  bundle: LeagueHistoryBundle,
  trades: AnalyzedTrade[],
): {
  gmSummaries: GmTradeSummary[]
  partnerPairs: PartnerPairStats[]
  superlatives: TradeSuperlatives
} {
  const latest = bundle.seasons[0]
  if (!latest) {
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

  const userMap = new Map(latest.users.map((u) => [u.user_id, u]))
  const gmMap = new Map<number, GmTradeSummary>()

  for (const r of latest.rosters) {
    const u = r.owner_id ? userMap.get(r.owner_id) : undefined
    const handle = u?.display_name || `Team ${r.roster_id}`
    const teamName = u?.metadata?.team_name?.trim() || handle
    gmMap.set(r.roster_id, {
      rosterId: r.roster_id,
      ownerId: r.owner_id,
      teamName,
      ownerHandle: handle,
      tradeCount: 0,
      shortWins: 0,
      shortLosses: 0,
      shortEven: 0,
      longWins: 0,
      longLosses: 0,
      longEven: 0,
      netShortTermPts: 0,
      netLongTermValue: 0,
      fleecesWon: 0,
      fleecesLost: 0,
      winWinCount: 0,
      favoritePartnerName: null,
      favoritePartnerCount: 0,
    })
  }

  const partnerCounts = new Map<number, Map<number, number>>()
  const pairMap = new Map<string, PartnerPairStats>()

  for (const trade of trades) {
    const sides = trade.sides
    if (sides.length < 2) continue

    const avgShort = sides.reduce((s, x) => s + x.shortTermScore, 0) / sides.length
    const avgLong = sides.reduce((s, x) => s + x.longTermScore, 0) / sides.length

    for (const side of sides) {
      const gm = gmMap.get(side.rosterId)
      if (!gm) continue

      gm.tradeCount += 1
      gm.netShortTermPts = Math.round((gm.netShortTermPts + (side.shortTermScore - avgShort)) * 10) / 10
      gm.netLongTermValue = Math.round(gm.netLongTermValue + (side.longTermScore - avgLong))

      if (trade.shortTermWinner === side.rosterId) gm.shortWins += 1
      else if (typeof trade.shortTermWinner === 'number') gm.shortLosses += 1
      else if (trade.shortTermWinner === 'even') gm.shortEven += 1

      if (trade.longTermWinner === side.rosterId) gm.longWins += 1
      else if (typeof trade.longTermWinner === 'number') gm.longLosses += 1
      else if (trade.longTermWinner === 'even') gm.longEven += 1

      if (trade.verdict === 'fleece') {
        if (trade.longTermWinner === side.rosterId || trade.shortTermWinner === side.rosterId) {
          gm.fleecesWon += 1
        } else {
          gm.fleecesLost += 1
        }
      } else if (trade.verdict === 'win-win') {
        gm.winWinCount += 1
      }
    }

    // Track pairwise partner records
    for (let i = 0; i < sides.length; i += 1) {
      for (let j = i + 1; j < sides.length; j += 1) {
        const s1 = sides[i]
        const s2 = sides[j]
        const [a, b] = s1.rosterId < s2.rosterId ? [s1, s2] : [s2, s1]

        // Count partners per GM
        if (!partnerCounts.has(a.rosterId)) partnerCounts.set(a.rosterId, new Map())
        if (!partnerCounts.has(b.rosterId)) partnerCounts.set(b.rosterId, new Map())
        partnerCounts.get(a.rosterId)!.set(b.rosterId, (partnerCounts.get(a.rosterId)!.get(b.rosterId) ?? 0) + 1)
        partnerCounts.get(b.rosterId)!.set(a.rosterId, (partnerCounts.get(b.rosterId)!.get(a.rosterId) ?? 0) + 1)

        const key = `${a.rosterId}-${b.rosterId}`
        const existing = pairMap.get(key) ?? {
          rosterA: a.rosterId,
          rosterB: b.rosterId,
          teamAName: gmMap.get(a.rosterId)?.teamName ?? a.teamName,
          teamBName: gmMap.get(b.rosterId)?.teamName ?? b.teamName,
          tradeCount: 0,
          aShortWins: 0,
          bShortWins: 0,
          aLongWins: 0,
          bLongWins: 0,
          aNetShortPts: 0,
          aNetLongValue: 0,
          lastTradeCreated: 0,
        }

        existing.tradeCount += 1
        if (trade.shortTermWinner === a.rosterId) existing.aShortWins += 1
        if (trade.shortTermWinner === b.rosterId) existing.bShortWins += 1
        if (trade.longTermWinner === a.rosterId) existing.aLongWins += 1
        if (trade.longTermWinner === b.rosterId) existing.bLongWins += 1
        existing.aNetShortPts =
          Math.round((existing.aNetShortPts + (a.shortTermScore - b.shortTermScore)) * 10) / 10
        existing.aNetLongValue = Math.round(
          existing.aNetLongValue + (a.longTermScore - b.longTermScore),
        )
        existing.lastTradeCreated = Math.max(existing.lastTradeCreated, trade.created)
        pairMap.set(key, existing)
      }
    }
  }

  for (const gm of gmMap.values()) {
    const counts = partnerCounts.get(gm.rosterId)
    if (!counts) continue
    let bestId = -1
    let bestCount = 0
    for (const [partnerId, count] of counts.entries()) {
      if (count > bestCount) {
        bestCount = count
        bestId = partnerId
      }
    }
    if (bestId !== -1) {
      gm.favoritePartnerName = gmMap.get(bestId)?.teamName ?? `Team ${bestId}`
      gm.favoritePartnerCount = bestCount
    }
  }

  const gmSummaries = Array.from(gmMap.values()).sort(
    (a, b) => b.netLongTermValue - a.netLongTermValue || b.netShortTermPts - a.netShortTermPts,
  )
  const partnerPairs = Array.from(pairMap.values()).sort(
    (a, b) => b.tradeCount - a.tradeCount || b.lastTradeCreated - a.lastTradeCreated,
  )

  // Superlatives
  const fleeces = trades
    .filter((t) => t.verdict === 'fleece')
    .sort((a, b) => b.longTermMargin - a.longTermMargin)
  const biggestFleece =
    fleeces[0] ??
    [...trades].sort((a, b) => b.longTermMargin - a.longTermMargin)[0] ??
    null

  const winWins = trades
    .filter((t) => t.verdict === 'win-win')
    .sort((a, b) => b.totalTradeVolume - a.totalTradeVolume)
  const bestWinWin = winWins[0] ?? null

  let bestPickFlip: { trade: AnalyzedTrade; asset: TradedAsset; recipientName: string } | null = null
  for (const trade of trades) {
    for (const side of trade.sides) {
      for (const asset of side.received) {
        if (asset.kind === 'pick' && asset.resolvedFromPick) {
          if (!bestPickFlip || asset.dynastyValue > bestPickFlip.asset.dynastyValue) {
            bestPickFlip = { trade, asset, recipientName: side.teamName }
          }
        }
      }
    }
  }

  const mostActiveGm = [...gmSummaries].sort((a, b) => b.tradeCount - a.tradeCount)[0] ?? null
  const topShortTermGm = [...gmSummaries].sort((a, b) => b.netShortTermPts - a.netShortTermPts)[0] ?? null
  const topLongTermGm = [...gmSummaries].sort((a, b) => b.netLongTermValue - a.netLongTermValue)[0] ?? null

  return {
    gmSummaries,
    partnerPairs,
    superlatives: {
      biggestFleece,
      bestWinWin,
      bestPickFlip,
      mostActiveDuo: partnerPairs[0] ?? null,
      mostActiveGm: mostActiveGm && mostActiveGm.tradeCount > 0 ? mostActiveGm : null,
      topShortTermGm: topShortTermGm && topShortTermGm.tradeCount > 0 ? topShortTermGm : null,
      topLongTermGm: topLongTermGm && topLongTermGm.tradeCount > 0 ? topLongTermGm : null,
    },
  }
}
