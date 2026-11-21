import { useMemo, useState } from 'react'
import { ArrowLeftRight, Check, Copy, Plus, RotateCcw, X } from 'lucide-react'
import { lookupPickValue } from '../api/dynastyValues'
import type {
  DynastyValueMap,
  GmTradeSummary,
  LeagueHistoryBundle,
  SleeperPlayerLite,
} from '../types/trades'

interface CalcAsset {
  id: string
  kind: 'player' | 'pick'
  label: string
  sublabel: string
  position: string
  dynastyVal: number
  redraftVal: number
  isFirstRound?: boolean
}

interface TradeCalcViewProps {
  bundle: LeagueHistoryBundle
  gms: GmTradeSummary[]
  playersMap: Map<string, SleeperPlayerLite>
  valueMap: DynastyValueMap
  defaultRosterId: number | null
}

function ordinal(r: number): string {
  return r === 1 ? '1st' : r === 2 ? '2nd' : r === 3 ? '3rd' : `${r}th`
}

function gradeFromRatio(ratio: number): string {
  if (ratio >= 0.45) return 'A+'
  if (ratio >= 0.25) return 'A'
  if (ratio >= 0.13) return 'A-'
  if (ratio >= 0.04) return 'B+'
  if (ratio >= -0.04) return 'B'
  if (ratio >= -0.13) return 'B-'
  if (ratio >= -0.25) return 'C+'
  if (ratio >= -0.4) return 'C'
  if (ratio >= -0.55) return 'C-'
  if (ratio >= -0.75) return 'D'
  return 'F'
}

function scoreSide(
  assets: CalcAsset[],
  minCount: number,
  isDynasty: boolean,
): { raw: number; adjusted: number; redraft: number } {
  const sorted = [...assets].sort((a, b) => b.dynastyVal - a.dynastyVal)
  const decay = [0.76, 0.58, 0.42, 0.3]
  let raw = 0
  let adjusted = 0
  let redraft = 0

  sorted.forEach((a, idx) => {
    const val = isDynasty ? a.dynastyVal : a.redraftVal
    raw += val
    redraft += a.redraftVal
    let w = 1.0
    if (idx >= minCount) {
      if (isDynasty && (a.dynastyVal >= 2200 || a.isFirstRound)) w = 0.94
      else w = decay[Math.min(decay.length - 1, idx - minCount)]
    }
    adjusted += val * w
  })

  return { raw: Math.round(raw), adjusted: Math.round(adjusted), redraft: Math.round(redraft) }
}

export function TradeCalcView({
  bundle,
  gms,
  playersMap,
  valueMap,
  defaultRosterId,
}: TradeCalcViewProps) {
  const latest = bundle.seasons[0]
  const firstId = defaultRosterId ?? gms[0]?.rosterId ?? 1
  const secondId = gms.find((g) => g.rosterId !== firstId)?.rosterId ?? gms[1]?.rosterId ?? 2

  const [teamAId, setTeamAId] = useState<number>(firstId)
  const [teamBId, setTeamBId] = useState<number>(secondId)
  const [teamAGives, setTeamAGives] = useState<string[]>([])
  const [teamBGives, setTeamBGives] = useState<string[]>([])
  const [searchA, setSearchA] = useState('')
  const [searchB, setSearchB] = useState('')
  const [copied, setCopied] = useState(false)

  // Compute MaxPF pick tiers for current league rosters
  const pickTiers = useMemo(() => {
    const rosters = latest?.rosters ?? []
    const hasMaxPf = rosters.some((r) => (r.settings.ppts ?? 0) > 0)
    const sorted = [...rosters].sort((a, b) => {
      if (hasMaxPf) {
        const pa = (a.settings.ppts ?? 0) + (a.settings.ppts_decimal ?? 0) / 100
        const pb = (b.settings.ppts ?? 0) + (b.settings.ppts_decimal ?? 0) / 100
        if (pa !== pb) return pa - pb
      }
      return (a.settings.wins ?? 0) - (b.settings.wins ?? 0)
    })
    const map = new Map<number, 'Early' | 'Mid' | 'Late'>()
    sorted.forEach((r, i) => {
      const ratio = i / Math.max(1, sorted.length)
      map.set(r.roster_id, ratio < 0.34 ? 'Early' : ratio < 0.67 ? 'Mid' : 'Late')
    })
    return map
  }, [latest])

  // Build real roster + owned draft pick inventory per rosterId
  const inventoryByRoster = useMemo(() => {
    const map = new Map<number, CalcAsset[]>()
    if (!latest) return map

    const teamNameMap = new Map(gms.map((g) => [g.rosterId, g.teamName]))
    const curYear = Number(bundle.currentLeague.season)
    const futureYears = bundle.isDynasty ? [String(curYear + 1), String(curYear + 2), String(curYear + 3)] : []

    // Build live draft pick ownership using Sleeper traded_picks
    const pickOwner = new Map<string, { season: string; round: number; origRoster: number; ownerRoster: number }>()
    for (const r of latest.rosters) {
      for (const yr of futureYears) {
        for (let rd = 1; rd <= 4; rd += 1) {
          pickOwner.set(`${yr}-${rd}-${r.roster_id}`, {
            season: yr,
            round: rd,
            origRoster: r.roster_id,
            ownerRoster: r.roster_id,
          })
        }
      }
    }
    for (const tp of latest.tradedPicks ?? []) {
      const key = `${tp.season}-${tp.round}-${tp.roster_id}`
      if (pickOwner.has(key)) {
        pickOwner.get(key)!.ownerRoster = tp.owner_id
      }
    }

    for (const r of latest.rosters) {
      const list: CalcAsset[] = []
      for (const pid of r.players ?? []) {
        const p = playersMap.get(pid)
        const v = valueMap.byPlayerId.get(pid)
        const pos = (p?.position ?? v?.position ?? 'WR') as 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF'
        const mul = bundle.scoringProfile.posMultipliers[pos] ?? 1.0
        const dynVal = Math.round((v?.dynastyValue ?? 0) * mul)
        const redVal = Math.round((v?.redraftValue ?? 0) * mul)
        list.push({
          id: `p:${pid}`,
          kind: 'player',
          label: p?.name ?? v?.name ?? `Player ${pid}`,
          sublabel: `${pos} · ${p?.team ?? 'FA'}${p?.age ? ` · ${p.age}y` : ''}`,
          position: pos,
          dynastyVal: dynVal,
          redraftVal: redVal,
        })
      }

      // Add owned future picks
      for (const [key, pk] of pickOwner.entries()) {
        if (pk.ownerRoster !== r.roster_id) continue
        const tier = pickTiers.get(pk.origRoster) ?? 'Mid'
        const val = lookupPickValue(valueMap, pk.season, pk.round, tier, bundle.currentLeague.season)
        const origName = teamNameMap.get(pk.origRoster) ?? `Team ${pk.origRoster}`
        const yrOut = Number(pk.season) - curYear
        list.push({
          id: `k:${key}`,
          kind: 'pick',
          label: `${pk.season} ${ordinal(pk.round)}${yrOut <= 1 ? ` (${tier})` : ''}`,
          sublabel: `Orig: ${origName}`,
          position: 'PICK',
          dynastyVal: val,
          redraftVal: 0,
          isFirstRound: pk.round === 1,
        })
      }

      list.sort((a, b) =>
        bundle.isDynasty ? b.dynastyVal - a.dynastyVal : b.redraftVal - a.redraftVal,
      )
      map.set(r.roster_id, list)
    }

    return map
  }, [latest, gms, playersMap, valueMap, bundle, pickTiers])

  const invA = inventoryByRoster.get(teamAId) ?? []
  const invB = inventoryByRoster.get(teamBId) ?? []
  const selectedA = invA.filter((x) => teamAGives.includes(x.id))
  const selectedB = invB.filter((x) => teamBGives.includes(x.id))

  // Team A RECEIVES selectedB; Team B RECEIVES selectedA
  const evaluation = useMemo(() => {
    const minCount = Math.max(1, Math.min(selectedA.length || 1, selectedB.length || 1))
    let aRec = scoreSide(selectedB, minCount, bundle.isDynasty)
    let bRec = scoreSide(selectedA, minCount, bundle.isDynasty)

    // Stud Cornerstone Bonus
    if (selectedA.length > 0 && selectedB.length > 0 && bundle.isDynasty) {
      const topARec = Math.max(...selectedB.map((x) => x.dynastyVal), 0)
      const topBRec = Math.max(...selectedA.map((x) => x.dynastyVal), 0)
      if (topARec >= 5000 && topARec - topBRec >= 1500) {
        aRec = { ...aRec, adjusted: aRec.adjusted + Math.round((topARec - topBRec) * 0.14) }
      } else if (topBRec >= 5000 && topBRec - topARec >= 1500) {
        bRec = { ...bRec, adjusted: bRec.adjusted + Math.round((topBRec - topARec) * 0.14) }
      }
    }

    const totalAdj = aRec.adjusted + bRec.adjusted
    const aPct = totalAdj > 0 ? Math.round((aRec.adjusted / totalAdj) * 100) : 50
    const avg = totalAdj / 2
    const aGrade = avg > 0 ? gradeFromRatio((aRec.adjusted - avg) / avg) : '--'
    const bGrade = avg > 0 ? gradeFromRatio((bRec.adjusted - avg) / avg) : '--'
    const diff = aRec.adjusted - bRec.adjusted

    const totalRed = aRec.redraft + bRec.redraft
    const stAvg = totalRed / 2
    const aStGrade = stAvg > 0 ? gradeFromRatio((aRec.redraft - stAvg) / stAvg) : '--'
    const bStGrade = stAvg > 0 ? gradeFromRatio((bRec.redraft - stAvg) / stAvg) : '--'

    return { aRec, bRec, aPct, aGrade, bGrade, aStGrade, bStGrade, diff }
  }, [selectedA, selectedB, bundle.isDynasty])

  const teamA = gms.find((g) => g.rosterId === teamAId)
  const teamB = gms.find((g) => g.rosterId === teamBId)

  const toggleItem = (id: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  }

  const handleCopyProposal = async () => {
    if (selectedA.length === 0 && selectedB.length === 0) return
    const lines = [
      `⚖️ Trade Proposal — ${bundle.currentLeague.name}`,
      `• ${teamA?.teamName ?? 'Team A'} receives: ${selectedB.map((x) => x.label).join(', ') || 'Nothing'} [Grade: ${evaluation.aGrade}]`,
      `• ${teamB?.teamName ?? 'Team B'} receives: ${selectedA.map((x) => x.label).join(', ') || 'Nothing'} [Grade: ${evaluation.bGrade}]`,
      `📊 Balance: ${evaluation.aPct}% / ${100 - evaluation.aPct}% (Δ ${Math.abs(evaluation.diff).toLocaleString()} league-adjusted val)`,
    ]
    await navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const filterList = (list: CalcAsset[], q: string) => {
    const clean = q.trim().toLowerCase()
    if (!clean) return list.slice(0, 28)
    return list.filter((x) => `${x.label} ${x.sublabel}`.toLowerCase().includes(clean)).slice(0, 28)
  }

  return (
    <div className="calc-wrap">
      {/* Live Verdict Banner */}
      <div className="calc-verdict-box">
        <div className="calc-verdict-top">
          <div>
            <span className="eyebrow">LIVE LEAGUE TRADE SIMULATOR · SCORING ADJUSTED</span>
            <h3 style={{ margin: '4px 0 0', font: '600 17px var(--display)' }}>
              {selectedA.length === 0 && selectedB.length === 0
                ? 'Select players or owned draft picks from both rosters below'
                : Math.abs(evaluation.diff) <= Math.max(300, (evaluation.aRec.adjusted + evaluation.bRec.adjusted) * 0.04)
                  ? 'Fair & Balanced Deal'
                  : evaluation.diff > 0
                    ? `${teamA?.teamName ?? 'Team A'} wins by +${evaluation.diff.toLocaleString()} val`
                    : `${teamB?.teamName ?? 'Team B'} wins by +${Math.abs(evaluation.diff).toLocaleString()} val`}
            </h3>
          </div>
          <div className="foot-actions">
            <button
              type="button"
              className="quick-pill"
              onClick={() => {
                setTeamAGives([])
                setTeamBGives([])
              }}
            >
              <RotateCcw size={11} />
              <span>Reset</span>
            </button>
            <button
              type="button"
              className="quick-pill active"
              onClick={() => void handleCopyProposal()}
              disabled={selectedA.length === 0 && selectedB.length === 0}
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              <span>{copied ? 'Copied!' : 'Copy Proposal'}</span>
            </button>
          </div>
        </div>

        {/* Visual Split Balance Bar */}
        <div className="split-bar-wrap" style={{ marginTop: 12 }}>
          <div className="split-bar-labels">
            <span>
              {teamA?.teamName} receives: <strong>{evaluation.aGrade}</strong> (
              {evaluation.aRec.adjusted.toLocaleString()} val
              {bundle.isDynasty ? ` · ST ${evaluation.aStGrade}` : ''})
            </span>
            <span>
              {teamB?.teamName} receives: <strong>{evaluation.bGrade}</strong> (
              {evaluation.bRec.adjusted.toLocaleString()} val
              {bundle.isDynasty ? ` · ST ${evaluation.bStGrade}` : ''})
            </span>
          </div>
          <div className="split-bar-track">
            <div className="split-bar-fill-a" style={{ width: `${evaluation.aPct}%` }} />
            <div className="split-bar-fill-b" style={{ width: `${100 - evaluation.aPct}%` }} />
          </div>
        </div>
      </div>

      {/* Two-Column Roster Pickers */}
      <div className="calc-grid">
        {[
          {
            label: 'TEAM A SENDS',
            teamId: teamAId,
            otherId: teamBId,
            setTeamId: (id: number) => {
              setTeamAId(id)
              setTeamAGives([])
            },
            selected: selectedA,
            selectedIds: teamAGives,
            setSelectedIds: setTeamAGives,
            inv: filterList(invA, searchA),
            search: searchA,
            setSearch: setSearchA,
          },
          {
            label: 'TEAM B SENDS',
            teamId: teamBId,
            otherId: teamAId,
            setTeamId: (id: number) => {
              setTeamBId(id)
              setTeamBGives([])
            },
            selected: selectedB,
            selectedIds: teamBGives,
            setSelectedIds: setTeamBGives,
            inv: filterList(invB, searchB),
            search: searchB,
            setSearch: setSearchB,
          },
        ].map((col) => (
          <div key={col.label} className="calc-col">
            <div className="calc-col-head">
              <span className="eyebrow">{col.label}</span>
              <select
                className="m-inspector-select"
                value={col.teamId}
                onChange={(e) => col.setTeamId(Number(e.target.value))}
              >
                {gms
                  .filter((g) => g.rosterId !== col.otherId)
                  .map((g) => (
                    <option key={g.rosterId} value={g.rosterId}>
                      {g.teamName} (@{g.ownerHandle})
                    </option>
                  ))}
              </select>
            </div>

            {col.selected.length > 0 && (
              <div className="calc-selected-chips">
                {col.selected.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="quick-pill active"
                    onClick={() => toggleItem(item.id, col.selectedIds, col.setSelectedIds)}
                  >
                    <span>{item.label}</span>
                    <strong>{(bundle.isDynasty ? item.dynastyVal : item.redraftVal).toLocaleString()}</strong>
                    <X size={10} />
                  </button>
                ))}
              </div>
            )}

            <input
              type="text"
              className="compact-select"
              style={{ width: '100%', marginTop: 8, cursor: 'text' }}
              placeholder="Filter roster or owned picks…"
              value={col.search}
              onChange={(e) => col.setSearch(e.target.value)}
            />

            <div className="calc-roster-list">
              {col.inv.map((item) => {
                const picked = col.selectedIds.includes(item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`calc-asset-btn ${picked ? 'picked' : ''}`}
                    onClick={() => toggleItem(item.id, col.selectedIds, col.setSelectedIds)}
                  >
                    <div className="asset-main" style={{ textAlign: 'left' }}>
                      <div className="asset-name">
                        <span className="asset-pos">{item.position}</span>
                        <span>{item.label}</span>
                      </div>
                      <div className="asset-sub">{item.sublabel}</div>
                    </div>
                    <div className="calc-asset-right">
                      <span>{(bundle.isDynasty ? item.dynastyVal : item.redraftVal).toLocaleString()}</span>
                      {picked ? <Check size={13} /> : <Plus size={13} />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="calc-hint">
        <ArrowLeftRight size={11} /> Uses real Sleeper rosters, live traded draft pick ownership,
        MaxPF pick tiers, and your league’s exact scoring multipliers.
      </p>
    </div>
  )
}
