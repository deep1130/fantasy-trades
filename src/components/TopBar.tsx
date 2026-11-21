import { ArrowLeftRight } from 'lucide-react'

interface TopBarProps {
  seasonLabel: string
  valueSource: 'fantasycalc' | 'fallback' | null
}

export function TopBar({ seasonLabel, valueSource }: TopBarProps) {
  return (
    <header className="topbar">
      <a href="./" className="brand" title="Trade Ledger">
        <span className="brand-mark">
          <ArrowLeftRight size={15} />
        </span>
        <span>
          TRADE<span className="brand-light">LEDGER</span>
        </span>
      </a>
      <div className="topbar-right">
        <span className="season-label">{seasonLabel}</span>
        <span className="live-dot" />
        <span className="live-label">
          {valueSource === 'fantasycalc' ? 'LIVE VALUES' : 'SLEEPER DATA'}
        </span>
      </div>
    </header>
  )
}
