import { ArrowLeftRight } from 'lucide-react'

interface TopBarProps {
  seasonLabel: string
  valueSource: 'fantasycalc' | 'fallback' | null
}

export function TopBar({ seasonLabel, valueSource }: TopBarProps) {
  return (
    <header className="topbar">
      <a href="./" className="brand" title="Fantasy Trades">
        <span className="brand-mark">
          <ArrowLeftRight size={15} />
        </span>
        <span>
          FANTASY<span className="brand-light">TRADES</span>
        </span>
      </a>
      <div className="topbar-right">
        <span className="season-label">{seasonLabel}</span>
        <span className="live-dot" />
        <span className="live-label">
          {valueSource === 'fantasycalc' ? 'LIVE DATA' : 'SLEEPER DATA'}
        </span>
      </div>
    </header>
  )
}
