/** Două variante, una lângă alta: plicul potrivit sau banii nerepartizați. */
import { t } from "@/lib/i18n";

export function SpendFromChoice({
  envelopeLabel,
  envelopeLeft,
  freeLabel,
  freeHint,
  freeDisabled,
  picked,
  onEnvelope,
  onFree,
}: {
  envelopeLabel: string;
  envelopeLeft: string;
  freeLabel: string;
  freeHint: string;
  freeDisabled: boolean;
  picked: "envelope" | "free" | "none";
  onEnvelope: () => void;
  onFree: () => void;
}) {
  return (
    <div className="bf-spend-from" role="group" aria-label={t("De unde se iau banii")}>
      <button type="button" className={picked === "envelope" ? "is-on" : ""} onClick={onEnvelope}>
        <b>{t("Din plicul {name}", { name: envelopeLabel })}</b>
        <small>{t("rămân {amount}", { amount: envelopeLeft })}</small>
      </button>
      <button type="button" className={picked === "free" ? "is-on" : ""} disabled={freeDisabled} onClick={onFree}>
        <b>{t("Din nerepartizat")}</b>
        <small>{freeDisabled ? t("nu ajunge: lipsesc {amount}", { amount: freeHint }) : freeLabel}</small>
      </button>
    </div>
  );
}
