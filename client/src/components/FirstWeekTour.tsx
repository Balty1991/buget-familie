import { useState } from "react";
import { ChevronRight, WalletCards, ReceiptText, Smartphone, X } from "lucide-react";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { FIRST_WEEK_TIPS, type FirstWeekTipId } from "@/lib/first-week-tour";
import { t } from "@/lib/i18n";

const ICONS: Record<FirstWeekTipId, typeof ReceiptText> = {
  capture: ReceiptText,
  envelopes: WalletCards,
  sync: Smartphone,
};

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
  const dialogRef = useFocusTrap<HTMLElement>(onClose);
  const [step, setStep] = useState(0);
  const tip = FIRST_WEEK_TIPS[step];
  const Icon = ICONS[tip.id];
  const last = step >= FIRST_WEEK_TIPS.length - 1;

  const closeIfBackdrop = (event: { target: EventTarget | null; currentTarget: EventTarget }) => {
    if (event.target === event.currentTarget) onClose();
  };

  const primary = () => {
    if (tip.id === "capture") onCapture();
    else if (tip.id === "envelopes") onPlan();
    else onSync();
    onClose();
  };

  return (
    <div className="bf-modal-backdrop bf-first-week-backdrop" role="presentation" onPointerDown={closeIfBackdrop}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="bf-modal bf-first-week-tour"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bf-first-week-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="bf-kicker">{t("PRIMA SĂPTĂMÂNĂ")}</p>
            <h2 id="bf-first-week-title">{t("Trei gesturi, fără grabă")}</h2>
          </div>
          <button type="button" className="bf-icon-button" aria-label={t("Închide")} onClick={onClose}>
            <X size={19} />
          </button>
        </header>
        <div className="bf-first-week-visual" aria-hidden="true">
          <Icon size={28} />
        </div>
        <p className="bf-kicker">{t(tip.kicker)}</p>
        <h3>{t(tip.title)}</h3>
        <p>{t(tip.detail)}</p>
        <div className="bf-onboarding-progress" aria-label={t("Pasul {current} din {total}", { current: step + 1, total: FIRST_WEEK_TIPS.length })}>
          {FIRST_WEEK_TIPS.map((item, index) => (
            <span key={item.id} className={index === step ? "active" : index < step ? "done" : ""} />
          ))}
        </div>
        <div className="bf-whats-new-actions">
          {!last ? (
            <button type="button" className="bf-primary" onClick={() => setStep((value) => value + 1)}>
              {t("Continuă")} <ChevronRight size={17} />
            </button>
          ) : (
            <button type="button" className="bf-primary" onClick={primary}>
              {tip.id === "sync" ? t("Deschide Sync") : tip.id === "envelopes" ? t("Deschide Planul") : t("Adaugă o mișcare")}
            </button>
          )}
          <button type="button" className="bf-link-button" onClick={onClose}>
            {t("Am înțeles")}
          </button>
        </div>
      </section>
    </div>
  );
}
