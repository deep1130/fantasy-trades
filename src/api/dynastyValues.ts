import type { DynastyValueEntry, DynastyValueMap } from '../types/trades'

interface FantasyCalcPlayerRow {
  player: {
    name: string
    sleeperId?: string | null
    position: string
    maybeAge?: number | null
  }
  value: number
  redraftValue?: number
  overallRank?: number
}

const memoryValueCache = new Map<string, DynastyValueMap>()

function pickBaseFallback(round: number, tier: 'Early' | 'Mid' | 'Late', yearsOut: number): number {
  const roundBase: Record<number, number> = {
    1: 3100,
    2: 1600,
    3: 950,
    4: 500,
  }
  const base = roundBase[round] ?? Math.max(200, 400 - (round - 4) * 100)
  const tierMul = tier === 'Early' ? 1.38 : tier === 'Late' ? 0.8 : 1.0
  const discount = Math.pow(0.84, Math.max(0, yearsOut))
  return Math.round(base * tierMul * discount)
}

export function lookupPickValue(
  valueMap: DynastyValueMap,
  season: string,
  round: number,
  tier: 'Early' | 'Mid' | 'Late',
  currentSeason: string,
): number {
  const yearsOut = Math.max(0, Number(season) - Number(currentSeason))
  const suffix = round === 1 ? 'st' : round === 2 ? 'nd' : round === 3 ? 'rd' : 'th'
  const genericKey = `${season} ${round}${suffix}`

  // For picks 2+ years out (e.g. 2028/2029), rosters mean-revert—don't over-discount by today's record
  if (yearsOut >= 2) {
    const generic = valueMap.byPickKey.get(genericKey.toLowerCase())
    if (generic != null) {
      const gentleMul = tier === 'Early' ? 1.06 : tier === 'Late' ? 0.94 : 1.0
      return Math.round(generic * gentleMul)
    }
    return pickBaseFallback(round, 'Mid', Number.isFinite(yearsOut) ? yearsOut : 2)
  }

  const exactKey = `${genericKey} (${tier})`
  const exact = valueMap.byPickKey.get(exactKey.toLowerCase())
  if (exact != null) return exact

  const generic = valueMap.byPickKey.get(genericKey.toLowerCase())
  if (generic != null) {
    const tierMul = tier === 'Early' ? 1.35 : tier === 'Late' ? 0.82 : 1.0
    return Math.round(generic * tierMul)
  }

  return pickBaseFallback(round, tier, Number.isFinite(yearsOut) ? yearsOut : 1)
}

export async function fetchDynastyValues(params: {
  isDynasty: boolean
  isSuperflex: boolean
  totalTeams: number
  ppr: number
  signal?: AbortSignal
}): Promise<DynastyValueMap> {
  const numQbs = params.isSuperflex ? 2 : 1
  const pprParam = params.ppr >= 0.9 ? 1 : params.ppr >= 0.4 ? 0.5 : 0
  const teams = Math.max(8, Math.min(16, params.totalTeams || 12))
  const cacheKey = `${params.isDynasty ? 'dyn' : 'red'}_${numQbs}_${teams}_${pprParam}`

  const cached = memoryValueCache.get(cacheKey)
  if (cached) return cached

  const url =
    `https://api.fantasycalc.com/values/current?isDynasty=${params.isDynasty ? 'true' : 'false'}` +
    `&numQbs=${numQbs}&numTeams=${teams}&ppr=${pprParam}`

  try {
    const res = await fetch(url, { signal: params.signal })
    if (!res.ok) throw new Error(`FantasyCalc HTTP ${res.status}`)
    const rows = (await res.json()) as FantasyCalcPlayerRow[]

    const byPlayerId = new Map<string, DynastyValueEntry>()
    const byPickKey = new Map<string, number>()

    for (const row of rows) {
      if (!row?.player) continue
      const pos = row.player.position
      if (pos === 'PICK') {
        byPickKey.set(row.player.name.trim().toLowerCase(), row.value ?? 0)
        continue
      }
      const sleeperId = row.player.sleeperId
      if (!sleeperId) continue
      byPlayerId.set(String(sleeperId), {
        sleeperId: String(sleeperId),
        name: row.player.name,
        position: pos,
        dynastyValue: row.value ?? 0,
        redraftValue: row.redraftValue ?? row.value ?? 0,
        overallRank: row.overallRank ?? null,
        age: row.player.maybeAge ?? null,
      })
    }

    const result: DynastyValueMap = {
      byPlayerId,
      byPickKey,
      source: 'fantasycalc',
    }
    memoryValueCache.set(cacheKey, result)
    return result
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    return {
      byPlayerId: new Map(),
      byPickKey: new Map(),
      source: 'fallback',
    }
  }
}
