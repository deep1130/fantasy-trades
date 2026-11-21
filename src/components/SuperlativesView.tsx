import type { TradeSuperlatives } from '../types/trades'

interface SuperlativesViewProps {
  superlatives: TradeSuperlatives
  isDynasty: boolean
}

export function SuperlativesView({ superlatives, isDynasty }: SuperlativesViewProps) {
  const {
    biggestFleece,
    bestWinWin,
    bestPickFlip,
    mostActiveDuo,
    mostActiveGm,
    topShortTermGm,
    topLongTermGm,
  } = superlatives

  return (
    <div className="superlatives-grid">
      <div className="super-card">
        <p className="eyebrow">BIGGEST FLEECE</p>
        <h3>{biggestFleece ? biggestFleece.verdictLabel : '--'}</h3>
        <p>
          {biggestFleece
            ? `${biggestFleece.season} Week ${biggestFleece.week}: ${biggestFleece.sides.map((s) => s.teamName).join(' ↔ ')}. Margin of ${biggestFleece.longTermMargin.toLocaleString()} value / ${biggestFleece.shortTermMargin.toFixed(1)} pts.`
            : 'No lopsided trades found yet.'}
        </p>
      </div>

      {isDynasty && (
        <div className="super-card">
          <p className="eyebrow">BEST WIN-WIN (CONTENDER vs REBUILDER)</p>
          <h3>
            {bestWinWin
              ? bestWinWin.sides.map((s) => s.teamName).join(' ↔ ')
              : 'No Split-Winner Deal Yet'}
          </h3>
          <p>
            {bestWinWin
              ? `${bestWinWin.season} Week ${bestWinWin.week}: One side cashed in ${bestWinWin.shortTermMargin.toFixed(1)} win-now pts while the partner netted ${bestWinWin.longTermMargin.toLocaleString()} dynasty value.`
              : 'A Win-Win happens when one team wins Short-Term production and the other wins Long-Term dynasty value.'}
          </p>
        </div>
      )}

      {isDynasty && (
        <div className="super-card">
          <p className="eyebrow">BEST DRAFT PICK FLIP</p>
          <h3>{bestPickFlip ? bestPickFlip.asset.label : 'No Resolved Pick Yet'}</h3>
          <p>
            {bestPickFlip
              ? `Acquired by ${bestPickFlip.recipientName} in ${bestPickFlip.trade.season} (was ${bestPickFlip.asset.resolvedFromPick}). Current dynasty value: ${bestPickFlip.asset.dynastyValue.toLocaleString()} (${bestPickFlip.asset.multiSeasonPts.toFixed(1)} pts scored).`
              : 'Once traded future picks are drafted, this highlights the best pick-turned-player hit.'}
          </p>
        </div>
      )}

      <div className="super-card">
        <p className="eyebrow">TRADE ADDICT</p>
        <h3>{mostActiveGm ? `${mostActiveGm.teamName} (${mostActiveGm.tradeCount})` : '--'}</h3>
        <p>
          {mostActiveGm
            ? `@${mostActiveGm.ownerHandle} leads the league in trade volume, most often dealing with ${mostActiveGm.favoritePartnerName ?? 'multiple rivals'}.`
            : 'No trades recorded.'}
        </p>
      </div>

      <div className="super-card">
        <p className="eyebrow">MOST FREQUENT PARTNERS</p>
        <h3>
          {mostActiveDuo
            ? `${mostActiveDuo.teamAName} ↔ ${mostActiveDuo.teamBName}`
            : '--'}
        </h3>
        <p>
          {mostActiveDuo
            ? `${mostActiveDuo.tradeCount} deals completed together. Short-Term H2H: ${mostActiveDuo.aShortWins}-${mostActiveDuo.bShortWins}${isDynasty ? ` · Long-Term H2H: ${mostActiveDuo.aLongWins}-${mostActiveDuo.bLongWins}` : ''}.`
            : 'No recurring partners yet.'}
        </p>
      </div>

      <div className="super-card">
        <p className="eyebrow">WIN-NOW KING (SHORT-TERM)</p>
        <h3>
          {topShortTermGm
            ? `${topShortTermGm.teamName} (+${topShortTermGm.netShortTermPts.toFixed(1)} pts)`
            : '--'}
        </h3>
        <p>
          {topShortTermGm
            ? `${topShortTermGm.shortWins}-${topShortTermGm.shortLosses} in immediate post-trade production across ${topShortTermGm.tradeCount} deals.`
            : 'Waiting for scored post-trade weeks.'}
        </p>
      </div>

      {isDynasty && (
        <div className="super-card">
          <p className="eyebrow">DYNASTY ARCHITECT (LONG-TERM)</p>
          <h3>
            {topLongTermGm
              ? `${topLongTermGm.teamName} (${topLongTermGm.netLongTermValue >= 0 ? '+' : ''}${topLongTermGm.netLongTermValue.toLocaleString()})`
              : '--'}
          </h3>
          <p>
            {topLongTermGm
              ? `${topLongTermGm.longWins}-${topLongTermGm.longLosses} in long-term dynasty value & multi-year production.`
              : 'Waiting for dynasty value data.'}
          </p>
        </div>
      )}
    </div>
  )
}
