import type { SleeperLeague } from '../types/trades'

export interface LeagueScoringProfile {
  ppr: number
  tepBonus: number
  passTd: number
  passInt: number
  rushAttBonus: number
  rushFdBonus: number
  recFdBonus: number
  passFdBonus: number
  bigPlayBonus: number
  startersCount: number
  qbStarters: number
  rbStarters: number
  wrStarters: number
  teStarters: number
  flexStarters: number
  isSuperflex: boolean
  tags: string[]
  posMultipliers: Record<'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF', number>
  posAdjustmentNotes: Record<string, string>
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

export function buildLeagueScoringProfile(league: SleeperLeague): LeagueScoringProfile {
  const s = league.scoring_settings ?? {}
  const positions = league.roster_positions ?? []

  const ppr = Number(s.rec ?? 0)
  const tepBonus = Number(s.bonus_rec_te ?? 0)
  const rbRecBonus = Number(s.bonus_rec_rb ?? 0)
  const wrRecBonus = Number(s.bonus_rec_wr ?? 0)
  const passTd = Number(s.pass_td ?? 4)
  const passInt = Number(s.pass_int ?? -1)
  const passCmp = Number(s.pass_cmp ?? 0)
  const rushAttBonus = Number(s.rush_att ?? 0)
  const rushFdBonus = Number(s.rush_fd ?? s.first_down ?? 0)
  const recFdBonus = Number(s.rec_fd ?? s.first_down ?? 0)
  const passFdBonus = Number(s.pass_fd ?? 0)

  const ydBonuses =
    Number(s.bonus_rush_yd_100 ?? 0) +
    Number(s.bonus_rec_yd_100 ?? 0) +
    Number(s.bonus_pass_yd_300 ?? 0)
  const bigPlayBonus =
    Number(s.pass_td_40p ?? 0) +
    Number(s.rush_td_40p ?? 0) +
    Number(s.rec_td_40p ?? 0) +
    ydBonuses

  const activeSlots = positions.filter((p) => p !== 'BN' && p !== 'IR' && p !== 'TAXI')
  const qbSlots = positions.filter((p) => p === 'QB').length
  const sfSlots = positions.filter((p) => p === 'SUPER_FLEX').length
  const rbSlots = positions.filter((p) => p === 'RB').length
  const wrSlots = positions.filter((p) => p === 'WR').length
  const teSlots = positions.filter((p) => p === 'TE').length
  const flexSlots = positions.filter(
    (p) => p === 'FLEX' || p === 'REC_FLEX' || p === 'WRRB_FLEX',
  ).length

  const isSuperflex = qbSlots >= 2 || sfSlots >= 1

  // Compute positional multipliers relative to FantasyCalc baseline
  // (FantasyCalc baseline already accounts for 1QB vs 2QB/SF and 0/0.5/1.0 PPR)
  let qbMul = 1.0
  let rbMul = 1.0
  let wrMul = 1.0
  let teMul = 1.0

  const notes: Record<string, string[]> = { QB: [], RB: [], WR: [], TE: [] }

  // QB scoring adjustments (6pt pass TD, pass completions, pass 1st downs, heavy INT penalty)
  if (passTd > 4) {
    const boost = (passTd - 4) * (isSuperflex ? 0.055 : 0.045)
    qbMul += boost
    notes.QB.push(`${passTd}pt Pass TD`)
  } else if (passTd < 4) {
    qbMul -= (4 - passTd) * 0.04
    notes.QB.push(`${passTd}pt Pass TD`)
  }
  if (passCmp > 0) {
    qbMul += clamp(passCmp * 0.25, 0, 0.14)
    notes.QB.push(`+${passCmp}/cmp`)
  }
  if (passFdBonus > 0) {
    qbMul += clamp(passFdBonus * 0.18, 0, 0.1)
    notes.QB.push(`+${passFdBonus} Pass FD`)
  }
  if (passInt <= -2) {
    qbMul -= clamp((Math.abs(passInt) - 1) * 0.02, 0, 0.06)
  }

  // TE scoring & lineup adjustments (TE Premium + 2TE)
  if (tepBonus > 0) {
    const boost = clamp(tepBonus * 0.28, 0, 0.42)
    teMul += boost
    notes.TE.push(`+${tepBonus} TEP`)
  }
  if (teSlots >= 2) {
    teMul += 0.18
    notes.TE.push(`${teSlots} TE slots`)
  }

  // RB scoring & lineup adjustments (Points Per Carry, Rush 1st Down, RB rec bonus, RB slots)
  if (rushAttBonus > 0) {
    const boost = clamp(rushAttBonus * 0.55, 0, 0.25)
    rbMul += boost
    notes.RB.push(`+${rushAttBonus} PPC`)
  }
  if (rushFdBonus > 0) {
    rbMul += clamp(rushFdBonus * 0.12, 0, 0.12)
    notes.RB.push(`+${rushFdBonus} Rush FD`)
  }
  if (rbRecBonus > 0) {
    rbMul += clamp(rbRecBonus * 0.2, 0, 0.18)
    notes.RB.push(`+${rbRecBonus} RB Rec`)
  }
  if (rbSlots >= 3) {
    rbMul += 0.08
    notes.RB.push(`${rbSlots} RB slots`)
  }

  // WR scoring & lineup adjustments (Rec 1st Down, WR rec bonus, 3+ WR / deep flex)
  if (recFdBonus > 0) {
    wrMul += clamp(recFdBonus * 0.12, 0, 0.12)
    teMul += clamp(recFdBonus * 0.08, 0, 0.08)
    notes.WR.push(`+${recFdBonus} Rec FD`)
  }
  if (wrRecBonus > 0) {
    wrMul += clamp(wrRecBonus * 0.2, 0, 0.18)
    notes.WR.push(`+${wrRecBonus} WR Rec`)
  }
  if (wrSlots >= 3) {
    wrMul += (wrSlots - 2) * 0.045
    notes.WR.push(`${wrSlots} WR slots`)
  }
  if (flexSlots >= 3) {
    wrMul += (flexSlots - 2) * 0.025
    rbMul += (flexSlots - 2) * 0.015
  }

  // Non-standard intermediate PPR (e.g. 0.75 PPR or 1.25 PPR)
  if (ppr > 1) {
    const extra = clamp((ppr - 1) * 0.12, 0, 0.15)
    wrMul += extra
    teMul += extra
  }

  const posMultipliers = {
    QB: Math.round(clamp(qbMul, 0.75, 1.45) * 1000) / 1000,
    RB: Math.round(clamp(rbMul, 0.8, 1.45) * 1000) / 1000,
    WR: Math.round(clamp(wrMul, 0.8, 1.45) * 1000) / 1000,
    TE: Math.round(clamp(teMul, 0.85, 1.65) * 1000) / 1000,
    K: 0.5,
    DEF: 0.5,
  }

  const tags: string[] = []
  tags.push(isSuperflex ? 'Superflex' : '1QB')
  tags.push(ppr === 1 ? '1.0 PPR' : ppr === 0.5 ? '0.5 PPR' : ppr === 0 ? 'Standard' : `${ppr} PPR`)
  if (tepBonus > 0) tags.push(`+${tepBonus} TEP`)
  if (teSlots >= 2) tags.push(`${teSlots}TE`)
  if (passTd !== 4) tags.push(`${passTd}pt Pass TD`)
  if (rushAttBonus > 0) tags.push(`+${rushAttBonus} PPC`)
  if (rushFdBonus > 0 || recFdBonus > 0) {
    tags.push(`+${Math.max(rushFdBonus, recFdBonus)} 1st Down`)
  }
  if (bigPlayBonus > 0) tags.push('Big-Play Bonuses')
  if (activeSlots.length > 0) tags.push(`Start ${activeSlots.length}`)

  const posAdjustmentNotes: Record<string, string> = {}
  for (const pos of ['QB', 'RB', 'WR', 'TE'] as const) {
    const mul = posMultipliers[pos]
    const diffPct = Math.round((mul - 1) * 100)
    if (diffPct !== 0) {
      const sign = diffPct > 0 ? '+' : ''
      const reason = notes[pos].length > 0 ? ` (${notes[pos].join(', ')})` : ''
      posAdjustmentNotes[pos] = `${pos} ${sign}${diffPct}%${reason}`
    }
  }

  return {
    ppr,
    tepBonus,
    passTd,
    passInt,
    rushAttBonus,
    rushFdBonus,
    recFdBonus,
    passFdBonus,
    bigPlayBonus,
    startersCount: activeSlots.length || 9,
    qbStarters: qbSlots + sfSlots,
    rbStarters: rbSlots,
    wrStarters: wrSlots,
    teStarters: teSlots,
    flexStarters: flexSlots,
    isSuperflex,
    tags,
    posMultipliers,
    posAdjustmentNotes,
  }
}
