import { Check, Sparkles } from "lucide-react";
import { BILLING_LIVE, familieYearGiftMonths, formatPlanPriceRon, PLANS, TRIAL_DAYS } from "@/lib/entitlements";
import { t } from "@/lib/i18n";

export function PremiumStudio() {
  const gift = familieYearGiftMonths();
  return (
    <section className="bf-premium-catalog" id="bf-familie-plan">
      <p className="bf-kicker">{t("UN SINGUR PLAN PENTRU CASĂ")}</p>
      <h2>{t("Casa e gratuită. Familia se cere când intră al doilea om sau al doilea telefon.")}</h2>
      <p>{t("Nu blocăm registrul. Notezi cheltuieli oricum. Plătești când gospodăria are nevoie de două telefoane, de mai mulți oameni sau de ghidul încăpător.")}</p>
      <div className="bf-premium-plans">
        <article>
          <p className="bf-kicker">{t("CASA")}</p>
          <h3>{t("Gratuit")}</h3>
          <p>{t("Pentru un om, pe un telefon.")}</p>
          <ul>
            <li><Check size={14} /> {t("Până la {n} plicuri", { n: String(PLANS.casa.envelopes) })}</li>
            <li><Check size={14} /> {t("Un membru, un telefon")}</li>
            <li><Check size={14} /> {t("Astăzi, Mișcări, Plan, scadențe")}</li>
            <li><Check size={14} /> {t("Ghid local + {n} mesaje online pe zi", { n: String(PLANS.casa.aiOnlinePerDay) })}</li>
            <li><Check size={14} /> {t("Export CSV și backup pe telefon")}</li>
          </ul>
        </article>
        <article className="is-featured">
          <p className="bf-kicker">{t("FAMILIA")}</p>
          <h3>
            {formatPlanPriceRon("familie", "year")}
            <small>
              {gift > 0 ? t("{n} luni cadou față de lună", { n: String(gift) }) : formatPlanPriceRon("familie", "month")}
            </small>
          </h3>
          <p>{t("Un abonament pentru până la {n} persoane. Nu per cap.", { n: String(PLANS.familie.members) })}</p>
          <ul>
            <li><Check size={14} /> {t("{days} zile de probă, apoi {month} sau {year}", { days: String(TRIAL_DAYS), month: formatPlanPriceRon("familie", "month"), year: formatPlanPriceRon("familie", "year") })}</li>
            <li><Check size={14} /> {t("Până la {n} telefoane, sincronizate criptat", { n: String(PLANS.familie.devices) })}</li>
            <li><Check size={14} /> {t("Decontare: cine cui datorează")}</li>
            <li><Check size={14} /> {t("Închiderea ciclului, cu ce a rămas în plicuri")}</li>
            <li><Check size={14} /> {t("Ghid online {n} mesaje pe zi", { n: String(PLANS.familie.aiOnlinePerDay) })}</li>
          </ul>
        </article>
      </div>
      <p className="bf-premium-promise"><Sparkles size={14} /> {t("Dacă anulezi, registrul rămâne pe telefon. Nu luăm ostatic datele.")}</p>
      <small className="bf-helper">
        {BILLING_LIVE
          ? t("Plata trece prin Google Play. Poți anula oricând din abonamentele contului Google.")
          : t("Plata trece prin Google Play, când listarea e live. Până atunci casa ta e deblocată — registrul nu se ține ostatic.")}
        {" · "}
        {t("Buget Familie nu e sfat financiar, credit sau investiție. Este un registru de familie.")}
      </small>
    </section>
  );
}
