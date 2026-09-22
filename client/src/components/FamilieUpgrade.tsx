/**
 * Momentul în care Casa se face Familia: al doilea om, al doilea telefon, cota ghidului.
 * Nu blochează registrul. Când Billing e live, butonul duce la catalog; până atunci
 * spune pe față că plata încă nu e pornită.
 */
import { Sparkles } from "lucide-react";
import {
  BILLING_LIVE,
  formatPlanPriceRon,
  familieYearGiftMonths,
  openFamilieCatalog,
  TRIAL_DAYS,
  type UpgradeReason,
} from "@/lib/entitlements";
import { t } from "@/lib/i18n";
import "../familie-upgrade.css";

const COPY: Record<UpgradeReason, { kicker: string; title: string; body: string }> = {
  member: {
    kicker: "AL DOILEA OM",
    title: "Casa e un om. Familia e gospodăria.",
    body: "Adaugi pe cineva? Atunci e un singur abonament pentru toată casa, nu per cap.",
  },
  sync: {
    kicker: "AL DOILEA TELEFON",
    title: "Același registru, pe ambele telefoane.",
    body: "Sync-ul criptat e Familia. Backup-ul pe Descărcări rămâne gratuit.",
  },
  ai: {
    kicker: "COTA GHIDULUI",
    title: "Azi s-au terminat mesajele online.",
    body: "Ghidul local rămâne. Familia are 100 de mesaje pe zi, nu 20.",
  },
  envelope: {
    kicker: "PLICURI",
    title: "Casa are zece plicuri.",
    body: "Le poți folosi pe cele pe care le ai. Altele noi vin cu Familia.",
  },
};

export function FamilieUpgrade({ reason }: { reason: UpgradeReason }) {
  const copy = COPY[reason];
  const gift = familieYearGiftMonths();
  return (
    <aside className="bf-familie-upgrade" aria-labelledby={`bf-familie-${reason}`}>
      <p className="bf-kicker">{t(copy.kicker)}</p>
      <h3 id={`bf-familie-${reason}`}>{t(copy.title)}</h3>
      <p>{t(copy.body)}</p>
      <p className="bf-familie-upgrade-price">
        {t("{days} zile de probă", { days: String(TRIAL_DAYS) })}
        {" · "}
        {formatPlanPriceRon("familie", "year")}
        {gift > 0 ? ` — ${t("{n} luni cadou față de lună", { n: String(gift) })}` : ""}
        {" · "}
        {formatPlanPriceRon("familie", "month")}
      </p>
      <button type="button" className="bf-primary" onClick={openFamilieCatalog}>
        <Sparkles size={16} /> {t("Vezi planul Familia")}
      </button>
      {!BILLING_LIVE && (
        <small>{t("Plata trece prin Google Play, când listarea e live. Până atunci casa ta e deblocată — registrul nu se ține ostatic.")}</small>
      )}
    </aside>
  );
}
