# Fantasy Trades

Sleeper Fantasy Football Trade Analyzer for Dynasty & Redraft leagues.

## Features
- **League ID or `@username` Lookup**: Load any Sleeper league directly or switch across your active leagues.
- **Multi-Season Dynasty History**: Automatically traces `previous_league_id` chains across seasons and resolves traded draft picks to the actual drafted players.
- **Short-Term vs. Long-Term Grading**:
  - **Short-Term Winner**: Measures post-trade same-season fantasy points (plus starter points and fresh ROS value).
  - **Long-Term Winner (Dynasty)**: Combines live SF/1QB/PPR FantasyCalc dynasty values (players + Early/Mid/Late pick projections + resolved picks) with multi-season realized production.
  - **2×2 Verdict Classification**: Distinguishes *Total Fleeces* from *Win-Win (Contender vs. Rebuilder)* deals.
- **Filtering & Analytics**: Filter by manager, league mate (with head-to-head record), season, verdict, or player/pick search, plus GM Leaderboard, Partner Matrix, and League Superlatives.

## Development
```bash
pnpm install
pnpm dev
pnpm build
```
