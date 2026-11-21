import { useEffect } from 'react'
import { ArrowUpRight, X } from 'lucide-react'
import type { AnalyzedTrade } from '../types/trades'
import { TradeCard } from './TradeCard'

interface TradeModalProps {
  trade: AnalyzedTrade
  leagueName: string
  isDynasty: boolean
  focusRosterId: number | null
  onClose: () => void
  onOpenInFeed: (tradeId: string) => void
  onFilterAssetChain: (chainKey: string, label: string) => void
}

export function TradeModal({
  trade,
  leagueName,
  isDynasty,
  focusRosterId,
  onClose,
  onOpenInFeed,
  onFilterAssetChain,
}: TradeModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Trade details"
      onClick={onClose}
    >
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-topbar">
          <span className="eyebrow">
            TRADE INSPECTOR <span>·</span> {trade.season}{' '}
            {trade.isOffseason ? 'OFFSEASON' : `WEEK ${trade.week}`}
          </span>
          <div className="modal-actions">
            <button
              type="button"
              className="modal-action-btn"
              onClick={() => onOpenInFeed(trade.id)}
            >
              <span>Open in Trades Feed</span>
              <ArrowUpRight size={12} />
            </button>
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Close trade modal"
            >
              <X size={15} />
              <span>Close</span>
            </button>
          </div>
        </div>

        <div className="modal-body">
          <TradeCard
            trade={trade}
            leagueName={leagueName}
            isDynasty={isDynasty}
            focusRosterId={focusRosterId}
            highlighted
            onFilterAssetChain={(chainKey, label) => {
              onClose()
              onFilterAssetChain(chainKey, label)
            }}
          />
        </div>
      </div>
    </div>
  )
}
