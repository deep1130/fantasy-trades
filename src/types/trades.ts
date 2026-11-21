import type { LeagueScoringProfile } from '../engine/scoringProfile'

export interface SleeperLeague {
  league_id: string
  name: string
  season: string
  status: string
  total_rosters: number
  previous_league_id?: string | null
  settings: Record<string, number | string | null>
  scoring_settings: Record<string, number>
  roster_positions?: string[]
  avatar?: string | null
}

export interface SleeperRoster {
  roster_id: number
  owner_id: string | null
  players: string[] | null
  starters?: string[] | null
  settings: {
    wins?: number
    losses?: number
    ties?: number
    fpts?: number
    fpts_decimal?: number
    ppts?: number
    ppts_decimal?: number
  }
}

export interface SleeperUser {
  user_id: string
  display_name: string
  avatar?: string | null
  metadata?: {
    team_name?: string
    avatar?: string
  }
}

export interface SleeperMatchup {
  roster_id: number
  matchup_id: number | null
  points: number
  starters?: string[]
  players?: string[]
  players_points?: Record<string, number>
}

export interface SleeperDraftPickTraded {
  season: string
  round: number
  roster_id: number
  previous_owner_id: number
  owner_id: number
}

export interface SleeperWaiverBudget {
  sender: number
  receiver: number
  amount: number
}

export interface SleeperTransaction {
  transaction_id: string
  type: string
  status: string
  leg: number
  roster_ids: number[]
  adds: Record<string, number> | null
  drops: Record<string, number> | null
  draft_picks?: SleeperDraftPickTraded[]
  waiver_budget?: SleeperWaiverBudget[]
  created: number
}

export interface SleeperDraft {
  draft_id: string
  season: string
  type: string
  status: string
  settings: {
    rounds?: number
    teams?: number
  }
  slot_to_roster_id?: Record<string, number> | null
  draft_order?: Record<string, number> | null
}

export interface SleeperDraftPick {
  round: number
  draft_slot: number
  pick_no: number
  roster_id: number
  player_id: string
  metadata?: {
    first_name?: string
    last_name?: string
    position?: string
    team?: string
  }
}

export interface SleeperPlayerLite {
  id: string
  name: string
  position: string
  team: string
  age: number | null
}

export interface NflState {
  week: number
  season: string
  season_type: string
  display_week?: number
}

export interface UserLeagueSummary {
  league_id: string
  name: string
  season: string
  total_rosters: number
  status: string
  isDynasty: boolean
  isSuperflex: boolean
  ownerRosterId?: number
}

export interface SeasonSnapshot {
  league: SleeperLeague
  rosters: SleeperRoster[]
  users: SleeperUser[]
  matchupsByWeek: Record<number, SleeperMatchup[]>
  transactions: SleeperTransaction[]
  drafts: {
    draft: SleeperDraft
    picks: SleeperDraftPick[]
  }[]
  lastScoredWeek: number
}

export interface LeagueHistoryBundle {
  currentLeague: SleeperLeague
  nflState: NflState
  isDynasty: boolean
  isSuperflex: boolean
  tepBonus: number
  ppr: number
  scoringProfile: LeagueScoringProfile
  seasons: SeasonSnapshot[]
}

export interface DynastyValueEntry {
  sleeperId: string
  name: string
  position: string
  dynastyValue: number
  redraftValue: number
  overallRank: number | null
  age: number | null
}

export interface DynastyValueMap {
  byPlayerId: Map<string, DynastyValueEntry>
  byPickKey: Map<string, number>
  source: 'fantasycalc' | 'fallback'
}

export interface TradedAsset {
  kind: 'player' | 'pick' | 'faab'
  id: string
  label: string
  sublabel?: string
  position?: string
  age?: number | null
  shortTermPts: number
  starterPts: number
  playoffStarterPts: number
  parPts: number
  redraftValue: number
  multiSeasonPts: number
  multiSeasonPar: number
  dynastyValue: number
  baseDynastyValue?: number
  scoringMultiplier?: number
  leaguePpg?: number
  gamesPlayed?: number
  resolvedFromPick?: string
  resolvedDraftedByRosterId?: number
  pickKey?: string
  pickTier?: 'Early' | 'Mid' | 'Late'
  flipCount?: number
  chainKey?: string
}

export interface TradeSide {
  rosterId: number
  ownerId: string | null
  teamName: string
  ownerHandle: string
  avatarUrl: string | null
  seasonRecord: string | null
  received: TradedAsset[]
  shortTermScore: number
  shortTermPts: number
  starterPts: number
  playoffStarterPts: number
  shortTermGrade: string
  longTermScore: number
  longTermGrade: string
  currentDynastyValue: number
  packageAdjustedValue: number
  realizedParBonus: number
  multiSeasonPts: number
}

export type TradeWinnerSide = number | 'even' | 'pending'

export type DynastyVerdictType =
  | 'fleece'
  | 'win-win'
  | 'slight-edge'
  | 'even'
  | 'pending'

export type FocusPerspectiveOutcome =
  | 'won-both'
  | 'won-short'
  | 'won-long'
  | 'lost-both'
  | 'even'
  | 'pending'

export interface AnalyzedTrade {
  id: string
  season: string
  week: number
  created: number
  isOffseason: boolean
  isCurrentSeason: boolean
  sides: TradeSide[]
  shortTermWinner: TradeWinnerSide
  longTermWinner: TradeWinnerSide
  verdict: DynastyVerdictType
  verdictLabel: string
  shortTermMargin: number
  longTermMargin: number
  totalTradeVolume: number
  weeksElapsedInSeason: number
}

export interface GmTradeSummary {
  rosterId: number
  ownerId: string | null
  teamName: string
  ownerHandle: string
  avatarUrl: string | null
  tradeCount: number
  shortWins: number
  shortLosses: number
  shortEven: number
  longWins: number
  longLosses: number
  longEven: number
  netShortTermPts: number
  netLongTermValue: number
  fleecesWon: number
  fleecesLost: number
  winWinCount: number
  favoritePartnerName: string | null
  favoritePartnerCount: number
}

export interface PartnerPairStats {
  rosterA: number
  rosterB: number
  teamAName: string
  teamBName: string
  tradeCount: number
  aShortWins: number
  bShortWins: number
  aLongWins: number
  bLongWins: number
  aNetShortPts: number
  aNetLongValue: number
  lastTradeCreated: number
}

export interface TradeSuperlatives {
  biggestFleece: AnalyzedTrade | null
  bestWinWin: AnalyzedTrade | null
  bestPickFlip: { trade: AnalyzedTrade; asset: TradedAsset; recipientName: string } | null
  mostActiveDuo: PartnerPairStats | null
  mostActiveGm: GmTradeSummary | null
  topShortTermGm: GmTradeSummary | null
  topLongTermGm: GmTradeSummary | null
}
