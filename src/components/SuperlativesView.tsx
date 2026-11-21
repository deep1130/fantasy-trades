import { Flame, Scale, ShieldAlert, Sparkles } from 'lucide-react'
import type { AnalyzedTrade, TradeSuperlatives } from '../types/trades'

interface SuperlativesViewProps {
  trades: AnalyzedTrade[]
  superlatives: TradeSuperlatives
  isDynasty: boolean
}

export function SuperlativesView({ trades, superlatives, isDynasty }: SuperlativesViewProps) {
  const topFleeces = [...trades]
    .sort((a, b) =>
      isDynasty ? b.longTermMargin - a.longTermMargin : b.shortTermMargin - a.shortTermMargin,
    )
    .slice(0, 5)

  const topWinWins = trades
    .filter((t) => t.verdict === 'win-win')
    .sort((a, b) => b.totalTradeVolume - a.totalTradeVolume)
    .slice(0, 5)

  const resolvedPickHits = trades
    .flatMap((t) =>
      t.sides.flatMap((s) =>
        s.received
          .filter((a) => a.kind === 'pick' && a.resolvedFromPick)
          .map((asset) => ({ trade: t, side: s, asset })),
      ),
    )
    .sort((a, b) => b.asset.dynastyValue - a.asset.dynastyValue)
    .slice(0, 5)

  return (
    <div className="superlatives-grid">
      {/* Panel 1: Biggest Fleeces & Lopsided Wins */}
      <div className="superlative-box">
        <div className="box-header">
          <Sparkles size={16} style={{ color: 'var(--lucky-text)' }} />
          <h3>Biggest Trade Fleeces</h3>
        </div>
        <p className="box-desc">
          The most lopsided deals in league history ranked by net{' '}
          {isDynasty ? 'long-term dynasty value' : 'short-term lineup impact'}.
        </p>
        <div className="robbery-list">
          {topFleeces.length === 0 ? (
            <div className="empty-sub">No trades recorded yet.</div>
          ) : (
            topFleeces.map((t) => {
              const winId = isDynasty ? t.longTermWinner : t.shortTermWinner
              const winner = t.sides.find((s) => s.rosterId === winId) ?? t.sides[0]
              const loser = t.sides.find((s) => s.rosterId !== winner.rosterId) ?? t.sides[1]
              return (
                <div key={t.id} className="robbery-item lucky-escape">
                  <div className="robbery-left">
                    <span className="robbery-week">
                      {t.season} · WEEK {t.week}
                    </span>
                    <strong>{winner.teamName} fleeced {loser?.teamName ?? 'rival'}</strong>
                    <span className="robbery-detail">
                      Got {winner.received.slice(0, 2).map((r) => r.label).join(', ')}
                    </span>
                  </div>
                  <div className="robbery-right">
                    <span className="luck-tag pos">
                      {isDynasty
                        ? `+${t.longTermMargin.toLocaleString()} val`
                        : `+${t.shortTermMargin.toFixed(1)} pts`}
                    </span>
                    <span className="robbery-opp">ST Δ {t.shortTermMargin.toFixed(1)} pts</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Panel 2: Best Win-Win Splits (Dynasty) or Most Active Partners */}
      {isDynasty ? (
        <div className="superlative-box">
          <div className="box-header">
            <Scale size={16} style={{ color: 'var(--accent-text)' }} />
            <h3>Best Win-Win Deals (Contender vs Rebuilder)</h3>
          </div>
          <p className="box-desc">
            Healthy dynasty swaps where one team won immediate Short-Term points and the partner
            won Long-Term youth &amp; picks.
          </p>
          <div className="robbery-list">
            {topWinWins.length === 0 ? (
              <div className="empty-sub">No split-winner deals recorded yet.</div>
            ) : (
              topWinWins.map((t) => {
                const stWin = t.sides.find((s) => s.rosterId === t.shortTermWinner)
                const ltWin = t.sides.find((s) => s.rosterId === t.longTermWinner)
                return (
                  <div key={t.id} className="robbery-item split-deal">
                    <div className="robbery-left">
                      <span className="robbery-week">
                        {t.season} · WEEK {t.week}
                      </span>
                      <strong>
                        {stWin?.teamName} ↔ {ltWin?.teamName}
                      </strong>
                      <span className="robbery-detail">
                        Win-Now: {stWin?.teamName} · Future: {ltWin?.teamName}
                      </span>
                    </div>
                    <div className="robbery-right">
                      <span className="luck-tag pos">+{t.shortTermMargin.toFixed(1)} ST pts</span>
                      <span className="robbery-opp">
                        +{t.longTermMargin.toLocaleString()} LT val
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      ) : (
        <div className="superlative-box">
          <div className="box-header">
            <Flame size={16} style={{ color: 'var(--accent-text)' }} />
            <h3>Most Active Deal Makers</h3>
          </div>
          <p className="box-desc">
            League leaders in trade volume and recurring partnerships.
          </p>
          <div className="robbery-list">
            {superlatives.mostActiveGm && (
              <div className="robbery-item lucky-escape">
                <div className="robbery-left">
                  <span className="robbery-week">TRADE ADDICT</span>
                  <strong>{superlatives.mostActiveGm.teamName}</strong>
                  <span className="robbery-detail">
                    {superlatives.mostActiveGm.tradeCount} deals · ST{' '}
                    {superlatives.mostActiveGm.shortWins}-{superlatives.mostActiveGm.shortLosses}
                  </span>
                </div>
                <div className="robbery-right">
                  <span className="luck-tag pos">
                    {superlatives.mostActiveGm.netShortTermPts >= 0 ? '+' : ''}
                    {superlatives.mostActiveGm.netShortTermPts.toFixed(1)} pts
                  </span>
                </div>
              </div>
            )}
            {superlatives.mostActiveDuo && (
              <div className="robbery-item split-deal">
                <div className="robbery-left">
                  <span className="robbery-week">MOST FREQUENT PARTNERS</span>
                  <strong>
                    {superlatives.mostActiveDuo.teamAName} ↔ {superlatives.mostActiveDuo.teamBName}
                  </strong>
                  <span className="robbery-detail">
                    {superlatives.mostActiveDuo.tradeCount} deals together
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Panel 3 (Dynasty): Best Resolved Draft Pick Flips */}
      {isDynasty && (
        <div className="superlative-box">
          <div className="box-header">
            <Flame size={16} style={{ color: 'var(--amber-text)' }} />
            <h3>Best Draft Pick Flips</h3>
          </div>
          <p className="box-desc">
            Traded future picks that resolved into high-value drafted rookies across league history.
          </p>
          <div className="robbery-list">
            {resolvedPickHits.length === 0 ? (
              <div className="empty-sub">
                No traded picks have resolved into completed drafts yet.
              </div>
            ) : (
              resolvedPickHits.map((item) => (
                <div
                  key={`${item.trade.id}-${item.asset.id}`}
                  className="robbery-item lucky-escape"
                >
                  <div className="robbery-left">
                    <span className="robbery-week">
                      ACQUIRED IN {item.trade.season} · WAS {item.asset.resolvedFromPick}
                    </span>
                    <strong>{item.asset.label}</strong>
                    <span className="robbery-detail">
                      Landed by {item.side.teamName} · {item.asset.multiSeasonPts.toFixed(1)} career pts
                    </span>
                  </div>
                  <div className="robbery-right">
                    <span className="luck-tag pos">
                      {item.asset.dynastyValue.toLocaleString()} val
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Panel 4: Toughest Losses */}
      <div className="superlative-box">
        <div className="box-header">
          <ShieldAlert size={16} style={{ color: 'var(--unlucky-text)' }} />
          <h3>Most Active &amp; Top Value Leaders</h3>
        </div>
        <p className="box-desc">
          Franchise-level trade awards across all seasons loaded.
        </p>
        <div className="robbery-list">
          {superlatives.topShortTermGm && (
            <div className="robbery-item lucky-escape">
              <div className="robbery-left">
                <span className="robbery-week">WIN-NOW KING (SHORT-TERM)</span>
                <strong>{superlatives.topShortTermGm.teamName}</strong>
                <span className="robbery-detail">
                  {superlatives.topShortTermGm.shortWins}-{superlatives.topShortTermGm.shortLosses}{' '}
                  short-term record
                </span>
              </div>
              <div className="robbery-right">
                <span className="luck-tag pos">
                  +{superlatives.topShortTermGm.netShortTermPts.toFixed(1)} pts
                </span>
              </div>
            </div>
          )}
          {isDynasty && superlatives.topLongTermGm && (
            <div className="robbery-item lucky-escape">
              <div className="robbery-left">
                <span className="robbery-week">DYNASTY ARCHITECT (LONG-TERM)</span>
                <strong>{superlatives.topLongTermGm.teamName}</strong>
                <span className="robbery-detail">
                  {superlatives.topLongTermGm.longWins}-{superlatives.topLongTermGm.longLosses}{' '}
                  long-term record
                </span>
              </div>
              <div className="robbery-right">
                <span className="luck-tag pos">
                  +{superlatives.topLongTermGm.netLongTermValue.toLocaleString()} val
                </span>
              </div>
            </div>
          )}
          {superlatives.mostActiveDuo && (
            <div className="robbery-item bad-beat">
              <div className="robbery-left">
                <span className="robbery-week">BIGGEST TRADE RIVALS</span>
                <strong>
                  {superlatives.mostActiveDuo.teamAName} ↔ {superlatives.mostActiveDuo.teamBName}
                </strong>
                <span className="robbery-detail">
                  {superlatives.mostActiveDuo.tradeCount} deals · ST{' '}
                  {superlatives.mostActiveDuo.aShortWins}-{superlatives.mostActiveDuo.bShortWins}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
