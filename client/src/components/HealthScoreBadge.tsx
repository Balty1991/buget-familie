import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { calculateHealthScore, type AppData, type HealthScoreBreakdown } from "@/lib/finance-data";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { CalmGauge } from "@/components/CalmGauge";
import { EnvelopeMark } from "@/components/EnvelopeMark";
import { t } from "@/lib/i18n";

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
        className="os-calm-btn"
        aria-label={health.score === null
          ? t("Scor sănătate financiară indisponibil: încă nu sunt destule date. Apasă pentru a vedea ce lipsește.")
          : t("Scor sănătate financiară {score} din 100. Apasă pentru detalii.", { score: health.score })}
        onClick={() => setOpen(true)}
      >
        <CalmGauge value={health.score} />
      </button>

      {open && <HealthScoreSheet health={health} onClose={() => setOpen(false)} />}
    </>
  );
}

function HealthScoreSheet({ health, onClose }: { health: HealthScoreBreakdown; onClose: () => void }) {
  const dialogRef = useFocusTrap<HTMLElement>(onClose);
  const toneLabel = health.tone === "unknown" ? t("Încă nu se poate calcula") : health.tone === "good" ? t("Calm") : health.tone === "watch" ? t("Atenție") : t("Risc");

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
            <p className="bf-kicker">{t("SĂNĂTATE FINANCIARĂ")}</p>
            <h2 id="bf-health-title">{health.score === null ? toneLabel : t("Scor {score} · {tone}", { score: health.score, tone: toneLabel })}</h2>
          </div>
          <button className="bf-icon-button" aria-label={t("Închide")} onClick={onClose}>
            <X size={19} />
          </button>
        </header>

        <p className="bf-health-sheet-intro">
          {health.score === null
            ? t("Un scor calculat din nimic ar fi o părere, nu o măsurătoare. Apar câteva date în registru și nota devine reală.")
            : t("Scor local, calculat din registrul tău. Nu estimează venituri viitoare și nu modifică datele.")}
        </p>

        {health.missing.length > 0 && (
          <div className="bf-health-missing">
            <p className="bf-kicker">{health.score === null ? t("CE LIPSEȘTE") : t("CE AR FACE SCORUL MAI EXACT")}</p>
            <ul>
              {health.missing.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}

        <div className="bf-health-sheet-ring-wrap" aria-hidden="true">
          <CalmGauge value={health.score} />
        </div>

        <ul className="bf-health-factors">
          {health.factors.map((factor) => (
            <li key={factor.id} className={factor.known ? "bf-health-factor" : "bf-health-factor unknown"}>
              <EnvelopeMark remaining={factor.known ? factor.value : 0} state={!factor.known ? "watch" : factor.value < 0.45 ? "over" : factor.value < 0.75 ? "watch" : "healthy"} size={42} />
              <div>
                <div className="bf-health-factor-top">
                  <b>{factor.label}</b>
                  <span>{factor.known ? `${Math.round(factor.value * 100)} · ${Math.round(factor.weight * 100)}%` : t("nu intră în scor")}</span>
                </div>
                <div className="bf-health-factor-bar" aria-hidden="true">
                  <i style={{ width: factor.known ? `${Math.round(factor.value * 100)}%` : "0%" }} />
                </div>
                <small>{factor.detail}</small>
              </div>
            </li>
          ))}
        </ul>

        <p className="bf-health-sheet-note">
          {t("Marja 35% · Plicuri 25% · Scadențe 20% · Ritm 20%. Factorii fără date nu sunt numărați, iar ponderile se împart între cei rămași.")}
        </p>
      </section>
    </div>,
    document.body,
  );
}
