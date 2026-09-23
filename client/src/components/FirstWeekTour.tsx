import { useState } from "react";
import { FIRST_WEEK_TIPS, type FirstWeekTipId } from "@/lib/first-week-tour";
import { t } from "@/lib/i18n";

/**
 * Indiciu lângă Notează, nu un modal care acoperă Astăzi.
 * Trei gesturi, pe rând, fără să blocheze restul ecranului.
 */
export function FirstWeekTour({
  onClose,
  onCapture,
  onPlan,
  onSync,
}: {
  onClose: () => void;
  onCapture: () => void;
  onPlan: () => void;
  onSync: () => void;
}) {
  const [step, setStep] = useState(0);
  const tip = FIRST_WEEK_TIPS[step];
  const last = step >= FIRST_WEEK_TIPS.length - 1;
  const go = (id: FirstWeekTipId) => {
    onClose();
    if (id === "capture") onCapture();
    else if (id === "envelopes") onPlan();
    else onSync();
  };

  return (
    <aside className="bf-coach-note" aria-labelledby="bf-coach-title">
      <p className="bf-kicker">{t(tip.kicker)}</p>
      <h2 id="bf-coach-title">{t(tip.title)}</h2>
      <p>{t(tip.detail)}</p>
      <div className="bf-coach-actions">
        <button type="button" className="bf-primary" onClick={() => go(tip.id)}>
          {tip.id === "capture" ? t("Notează") : tip.id === "envelopes" ? t("Deschide planul") : t("Sincronizare")}
        </button>
        {!last && (
          <button type="button" className="bf-link-button" onClick={() => setStep((value) => value + 1)}>
            {t("Continuă")}
          </button>
        )}
        <button type="button" className="bf-link-button" onClick={onClose}>{t("Am înțeles")}</button>
      </div>
    </aside>
  );
}
