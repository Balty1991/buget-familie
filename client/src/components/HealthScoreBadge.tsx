import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { calculateHealthScore, type AppData, type HealthScoreBreakdown } from "@/lib/finance-data";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { EnvelopeMark } from "@/components/EnvelopeMark";
import { HealthGauge } from "@/components/LedgerArt";

/**
 * Badge compact pentru ecranul Astăzi + sheet cu factorii explicabili.
 * Folosește doar date locale; nu modifică registrul.
 */
export function HealthScoreBadge({ data }: { data: AppData }) {
  const health = calculateHealthScore(data);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`bf-health-score ${health.tone}`}
        aria-label={`Scor sănătate financiară ${health.score} din 100. Apasă pentru detalii.`}
        onClick={() => setOpen(true)}
      >
        <HealthGauge score={health.score} tone={health.tone} size={92} />
        <small>
          {health.tone === "good" ? "Calm" : health.tone === "watch" ? "Atenție" : "Risc"}
        </small>
      </button>

      {open && <HealthScoreSheet health={health} onClose={() => setOpen(false)} />}
    </>
  );
}

function HealthScoreSheet({ health, onClose }: { health: HealthScoreBreakdown; onClose: () => void }) {
  const dialogRef = useFocusTrap<HTMLElement>(onClose);
  const toneLabel = health.tone === "good" ? "Calm" : health.tone === "watch" ? "Atenție" : "Risc";

  return createPortal(
    <div className="bf-modal-backdrop bf-health-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="bf-modal bf-health-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bf-health-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="bf-kicker">SĂNĂTATE FINANCIARĂ</p>
            <h2 id="bf-health-title">Scor {health.score} · {toneLabel}</h2>
          </div>
          <button className="bf-icon-button" aria-label="Închide" onClick={onClose}>
            <X size={19} />
          </button>
        </header>

        <p className="bf-health-sheet-intro">
          Scor local, calculat din registrul tău. Nu estimează venituri viitoare și nu modifică datele.
        </p>

        <div className="bf-health-sheet-ring-wrap" aria-hidden="true">
          <HealthGauge score={health.score} tone={health.tone} size={196} />
        </div>

        <ul className="bf-health-factors">
          {health.factors.map((factor) => (
            <li key={factor.id} className="bf-health-factor">
              <EnvelopeMark remaining={factor.value} state={factor.value < 0.45 ? "over" : factor.value < 0.75 ? "watch" : "healthy"} size={42} />
              <div>
                <div className="bf-health-factor-top">
                  <b>{factor.label}</b>
                  <span>{Math.round(factor.value * 100)} · {Math.round(factor.weight * 100)}%</span>
                </div>
                <div className="bf-health-factor-bar" aria-hidden="true">
                  <i style={{ width: `${Math.round(factor.value * 100)}%` }} />
                </div>
                <small>{factor.detail}</small>
              </div>
            </li>
          ))}
        </ul>

        <p className="bf-health-sheet-note">
          Marja 35% · Plicuri 25% · Scadențe 20% · Ritm 20%
        </p>
      </section>
    </div>,
    document.body,
  );
}
