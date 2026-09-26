/** Bifa „Plătit”: se desenează o dată când apare, apoi rămâne. */
import { t } from "@/lib/i18n";

export function PaidCheck() {
  return <span className="bf-paid-check"><svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" /></svg>{t("Plătit")}</span>;
}
