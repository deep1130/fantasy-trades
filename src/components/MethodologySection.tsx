import { ChevronDown, TrendingUp } from 'lucide-react'

export function MethodologySection() {
  return (
    <details className="model-details" open>
      <summary>
        <span className="method-icon">
          <TrendingUp size={18} />
        </span>
        <div className="model-heading">
          <span className="model-tag">HOW IT WORKS &amp; METHODOLOGY</span>
          <strong>
            How Short-Term Impact, Long-Term Dynasty Value, Package Tax &amp; League Scoring work
          </strong>
        </div>
        <ChevronDown className="model-chevron" size={17} />
      </summary>

      <div className="model-content">
        <div className="model-cards-grid">
          <div className="model-card">
            <div className="model-card-header">
              <span className="model-card-tag">WIN-NOW PRODUCTION</span>
              <h4>1. Short-Term Winner (Lineup Impact &amp; PAR)</h4>
            </div>
            <p>
              Measures immediate on-field help delivered in the season the trade was made. Rather
              than blindly summing bench points, Short-Term Score weights{' '}
              <strong>points actually started in the acquiring lineup</strong> plus{' '}
              <strong>Points Above Replacement (PAR)</strong>:
            </p>
            <p>
              <code>ST = 0.60 × StarterPts + 0.40 × TotalPts + 0.45 × PAR + FreshROS</code>
            </p>
            <p>
              Future draft picks score <code>0</code> immediate points—so a contender trading a
              future 1st for an elite veteran naturally wins Short-Term.
            </p>
          </div>

          <div className="model-card">
            <div className="model-card-header">
              <span className="model-card-tag">DYNASTY ASSET VALUE</span>
              <h4>2. Long-Term Winner (Dynasty Value + Multi-Year PAR)</h4>
            </div>
            <p>
              Combines live <strong>FantasyCalc</strong> dynasty market values (calibrated to your
              league’s QB count, team count, and PPR settings) with{' '}
              <strong>Multi-Season Points Above Replacement (PAR)</strong> banked since the trade.
            </p>
            <p>
              Only points scored <em>above positional replacement level</em> earn historical
              production credit—so low-PPG bench fillers never inflate multi-year scores, while
              veterans who delivered title-caliber starter seasons retain credit.
            </p>
          </div>

          <div className="model-card">
            <div className="model-card-header">
              <span className="model-card-tag">FOUR QUARTERS ≠ ONE DOLLAR</span>
              <h4>3. Package Consolidation Tax &amp; Stud Bonus</h4>
            </div>
            <p>
              In fantasy football, roster and starting lineup slots are finite. Trading 1 superstar
              for 3 mediocre bench pieces should not grade as a loss for the superstar side.
            </p>
            <p>
              In uneven <code>2-for-1</code> or <code>3-for-1</code> deals, extra pieces beyond the
              smaller side’s asset count decay (<code>76% → 58% → 42%</code>), and deals featuring
              a true cornerstone (<code>&ge; 5,000</code> value) award a{' '}
              <strong>14% Stud Consolidation Bonus</strong> on the top-asset gap.
            </p>
          </div>

          <div className="model-card">
            <div className="model-card-header">
              <span className="model-card-tag">CUSTOM LEAGUE SCORING</span>
              <h4>4. League Scoring &amp; Starting Lineup Multipliers</h4>
            </div>
            <p>
              Every league’s <code>scoring_settings</code> and <code>roster_positions</code> apply
              positional multipliers (<code>QB</code>, <code>RB</code>, <code>WR</code>,{' '}
              <code>TE</code>) plus true League PPG across all positions:
            </p>
            <p>
              • <strong>TE Premium &amp; 2TE:</strong> Scales TEs for <code>+0.5 / +1.0 TEP</code>{' '}
              and 2-TE lineups.
              <br />• <strong>QB Format:</strong> Adjusts for <code>Superflex / 2QB</code> and{' '}
              <code>6pt Pass TD</code>.
              <br />• <strong>RB / WR Bonuses:</strong> Factors in <code>PPC</code>, First Downs,
              and <code>3+ WR / FLEX</code> depth.
            </p>
          </div>

          <div className="model-card">
            <div className="model-card-header">
              <span className="model-card-tag">DRAFT PICK RESOLUTION</span>
              <h4>5. Draft Pick Slot Mapping &amp; Projections</h4>
            </div>
            <p>
              For completed rookie drafts across your league’s <code>previous_league_id</code>{' '}
              history chain, traded picks resolve to the exact draft slot and drafted player (e.g.{' '}
              <code>2024 1.03 · Malik Nabers</code>) and track their career points and dynasty
              value.
            </p>
            <p>
              Unresolved future picks are classified as <code>Early</code>, <code>Mid</code>, or{' '}
              <code>Late</code> based on the original owner’s standings.
            </p>
          </div>

          <div className="model-card">
            <div className="model-card-header">
              <span className="model-card-tag">2×2 DYNASTY VERDICTS</span>
              <h4>6. Win-Win Splits vs. Total Fleeces</h4>
            </div>
            <p>
              Comparing Short-Term Winner against Long-Term Winner classifies every dynasty deal:
            </p>
            <p>
              • <strong>Win-Win (Contender vs. Rebuilder):</strong> Team A won Short-Term points;
              Team B won Long-Term dynasty value.
              <br />• <strong>Fleece / Swept Edge:</strong> One manager won both timelines.
              <br />• <strong>Fair &amp; Even:</strong> Both sides fall within an ~8% deadzone.
            </p>
          </div>
        </div>
      </div>
    </details>
  )
}
