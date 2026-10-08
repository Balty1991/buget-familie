import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, X } from "lucide-react";
import { healthScoreStory, type AppData, type HealthScoreStory } from "@/lib/finance-data";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { CalmGauge } from "@/components/CalmGauge";
import { EnvelopeMark } from "@/components/EnvelopeMark";
import { t } from "@/lib/i18n";
import { ChartTip } from "@/components/ChartFrame";
import type { MainView } from "@/pages/home-kit";

/** Unde se repară fiecare factor: plicurile și marja în Plicuri, scadențele în Obligații, ritmul în Mișcări. */
const FIX_VIEW: Record<string, { view: MainView; label: string }> = {
  margin: { view: "plan", label: "Vezi plicurile și banii liberi" },
  envelopes: { view: "plan", label: "Vezi plicurile" },
  dues: { view: "obligations", label: "Vezi scadențele" },
  pace: { view: "journal", label: "Vezi mișcările" },
};

/**
 * Badge compact pentru ecranul Astăzi + sheet cu factorii explicabili și povestea pe cicluri.
 * Folosește doar date locale; nu modifică registrul.
 */
export function HealthScoreBadge({ data, onGo }: { data: AppData; onGo?: (view: MainView) => void }) {
  const story = healthScoreStory(data);
  const health = story.current;
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

      {open && <HealthScoreSheet story={story} onClose={() => setOpen(false)} onGo={onGo ? (view) => { setOpen(false); onGo(view); } : undefined} />}
    </>
  );
}

function HealthScoreSheet({ story, onClose, onGo }: { story: HealthScoreStory; onClose: () => void; onGo?: (view: MainView) => void }) {
  const health = story.current;
  const dialogRef = useFocusTrap<HTMLElement>(onClose);
  const toneLabel = health.tone === "unknown" ? t("Încă nu se poate calcula") : health.tone === "good" ? t("Calm") : health.tone === "watch" ? t("Atenție") : t("Risc");
  const maxSeries = Math.max(1, ...story.series.map((item) => item.score ?? 0));
  const [tip, setTip] = useState(story.series.find((item) => item.score !== null)?.end || "");

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

        {/* Ce trage scorul cel mai mult în jos, cu drumul direct la locul unde se repară. */}
        {(() => {
          if (!onGo || health.score === null) return null;
          const weakest = health.factors.filter((factor) => factor.known && factor.value < 0.75 && FIX_VIEW[factor.id]).sort((a, b) => (1 - b.value) * b.weight - (1 - a.value) * a.weight)[0];
          if (!weakest) return null;
          const fix = FIX_VIEW[weakest.id];
          return <div className="bf-health-cause"><p><b>{t("Ce trage scorul în jos: {label}", { label: weakest.label })}</b><small>{weakest.detail}</small></p><button type="button" className="bf-primary" onClick={() => onGo(fix.view)}>{t(fix.label)} <ChevronRight size={15} aria-hidden="true" /></button></div>;
        })()}

        <p className="bf-health-sheet-intro">
          {health.score === null
            ? t("Un scor calculat din nimic ar fi o părere, nu o măsurătoare. Apar câteva date în registru și nota devine reală.")
            : t("Scor local, calculat din registrul tău. Nu estimează venituri viitoare și nu modifică datele.")}
        </p>

        {story.series.some((item) => item.score !== null) && (
          <section className="bf-health-story" aria-label={t("Scor pe cicluri salariale")}>
            <p className="bf-kicker">{t("PE CICLURI")}</p>
            <h3>{t("Cum s-a mișcat scorul")}</h3>
            <div className="bf-health-story-bars" role="group" aria-label={t("Serie scor pe cicluri")}>
              {story.series.map((point) => (
                <button
                  key={point.end}
                  type="button"
                  className={`bf-health-story-bar ${point.tone}${point.score === null ? " is-empty" : ""}`}
                  aria-pressed={tip === point.end}
                  aria-label={point.score === null ? t("Fără scor") : t("Scor {score} · {label}", { score: point.score, label: point.label })}
                  onClick={() => setTip((current) => current === point.end ? "" : point.end)}
                >
                  <i style={{ height: point.score === null ? "0%" : `${Math.max(8, (point.score / maxSeries) * 100)}%` }} />
                  <b>{point.score === null ? "—" : point.score}</b>
                  <small>{point.label}</small>
                </button>
              ))}
            </div>
            {(() => {
              const point = story.series.find((item) => item.end === tip);
              if (!point) return null;
              return <ChartTip><b>{point.label}</b><span>{point.score === null ? t("Fără scor") : t("Scor {score} · {label}", { score: point.score, label: point.label })}</span></ChartTip>;
            })()}
            {story.moved.length > 0 ? (
              <ul className="bf-health-moved">
                {story.moved.map((item) => (
                  <li key={item.id}>
                    <b className={item.delta >= 0 ? "up" : "down"}>{item.delta >= 0 ? `+${item.delta}` : item.delta}</b>
                    <span>{item.detail}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="bf-health-moved-empty">{t("Încă nu e o diferență clară față de ciclul anterior.")}</p>
            )}
          </section>
        )}

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
