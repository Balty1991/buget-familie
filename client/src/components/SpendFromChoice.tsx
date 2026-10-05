/** Două variante, una lângă alta: plicul potrivit sau banii nerepartizați. */
import type { CSSProperties } from "react";
import { t } from "@/lib/i18n";

const row: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };
const choice: CSSProperties = { display: "grid", gap: 2, minHeight: 58, padding: "8px 10px", border: "1px solid var(--cf-line, #bfd2c6)", borderRadius: 12, background: "var(--cf-surface, #fffefa)", color: "inherit", textAlign: "left" };
const on: CSSProperties = { ...choice, borderColor: "var(--cf-primary, #1d8064)" };
const off: CSSProperties = { ...choice, opacity: 0.55 };

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
    <div className="bf-spend-from" style={row} role="group" aria-label={t("De unde se iau banii")}>
      <button type="button" style={picked === "envelope" ? on : choice} onClick={onEnvelope}>
        <b>{t("Din plicul {name}", { name: envelopeLabel })}</b>
        <small style={{ color: "var(--cf-muted, #60776b)", fontSize: 12 }}>{t("rămân {amount}", { amount: envelopeLeft })}</small>
      </button>
      <button type="button" style={freeDisabled ? off : picked === "free" ? on : choice} disabled={freeDisabled} onClick={onFree}>
        <b>{t("Din nerepartizat")}</b>
        <small style={{ color: "var(--cf-muted, #60776b)", fontSize: 12 }}>{freeDisabled ? t("nu ajunge: lipsesc {amount}", { amount: freeHint }) : freeLabel}</small>
      </button>
    </div>
  );
}
