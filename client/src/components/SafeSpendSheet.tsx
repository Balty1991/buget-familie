/**
 * Foaie locală: de ce „Poți folosi azi” are valoarea X + countdown până la salariu.
 * Nu scrie în AppData; doar explică formula din registru.
 */
import { createPortal } from "react-dom";
import { CalendarClock, X } from "lucide-react";
import { formatDate, type AppData } from "@/lib/finance-data";
import { paydayTrack, safeSpendBreakdown } from "@/lib/household-insights";
import { PaydayStrip } from "@/components/LedgerArt";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { getLocale, t } from "@/lib/i18n";
import "../safe-spend-sheet.css";

const money = (value: number) =>
  new Intl.NumberFormat(getLocale(), { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(
    Number.isFinite(value) ? value : 0,
  );

export function SafeSpendSheet({ data, onClose, onGoPlan }: { data: AppData; onClose: () => void; onGoPlan: () => void }) {
  const dialogRef = useFocusTrap<HTMLElement>(onClose);
  const sheet = safeSpendBreakdown(data);
  const track = paydayTrack(data);

  return createPortal(
    <div className="bf-modal-backdrop bf-safe-spend-backdrop" role="presentation" onClick={onClose}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="bf-safe-spend-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bf-safe-spend-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="bf-kicker">{t("CÂT POT CHELTUI")}</p>
            <h2 id="bf-safe-spend-title">{t("De ce poți folosi")} <em>{money(sheet.spendable)}</em></h2>
          </div>
          <button type="button" className="bf-icon-button" aria-label={t("Închide")} onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        {track && (
          <div className="bf-safe-spend-payday">
            <CalendarClock size={18} aria-hidden="true" />
            <div>
              <b>
                {track.remaining === 0
                  ? t("Venitul e așteptat azi")
                  : t("{days} zile până la venit", { days: track.remaining })}
              </b>
              <small>
                {sheet.paydayDate
                  ? t("Țintă: {date}", { date: formatDate(sheet.paydayDate, { day: "2-digit", month: "long" }) })
                  : t("Setează data în Plan")}
              </small>
            </div>
            <PaydayStrip elapsed={track.elapsed} total={track.total} remaining={track.remaining} />
          </div>
        )}

        <ol className="bf-safe-spend-steps">
          {sheet.steps.map((step) => (
            <li key={step.label}>
              <span>{step.label}</span>
              <strong className={step.amount < 0 ? "neg" : ""}>
                {step.amount < 0 ? "−" : ""}
                {money(Math.abs(step.amount))}
              </strong>
              {step.note ? <small>{step.note}</small> : null}
            </li>
          ))}
        </ol>

        <p className="bf-safe-spend-summary">{sheet.summary}</p>
        <p className="bf-helper">
          {t("În plicuri mai sunt {envelopes}. Plicul e limită de plan, nu sold bancar.", {
            envelopes: money(sheet.envelopeLeft),
          })}
        </p>

        <footer>
          <button type="button" className="bf-secondary" onClick={onClose}>
            {t("Am înțeles")}
          </button>
          <button type="button" className="bf-primary" onClick={onGoPlan}>
            {t("Deschide Planul")}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
