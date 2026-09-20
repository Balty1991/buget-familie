import { Check, Sparkles } from "lucide-react";
import { BILLING_LIVE, formatPlanPriceRon, PLANS, TRIAL_DAYS } from "@/lib/entitlements";
import { t } from "@/lib/i18n";

export function PremiumStudio() {
  const familiePrice = (
    <>
      {formatPlanPriceRon("familie", "year")}{" "}
      <small>{formatPlanPriceRon("familie", "month")}</small>
    </>
  );

  return (
    <section className="bf-premium-catalog">
      <p className="bf-kicker">{t(BILLING_LIVE ? "ABONAMENT · GOOGLE PLAY" : "CATALOG · PREVIZUALIZARE")}</p>
      <h2>{t("Casa e gratuită. Familia e un singur plan pentru toată gospodăria.")}</h2>
      <p>
        {BILLING_LIVE
          ? t("Pe Google Play, Casa rămâne registrul de bază. Familia deblochează sync, plicuri nelimitate și ghidul mai încăpător — fără reclame pe ecranele cu bani.")
          : t("Nu cerem bani acum. Tot catalogul e deblocat în testare — plicuri, sync, ghid. Prețurile de mai jos sunt previzualizare pentru Play; nu există plăți simulate.")}
      </p>
      <div className="bf-premium-plans">
        <article>
          <p className="bf-kicker">{t("CASA")}</p>
          <h3>{t("Gratuit")}</h3>
          <p>{t("Pentru un om care vrea să vadă pe ce se duc banii.")}</p>
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
            {BILLING_LIVE ? familiePrice : <>{familiePrice} <small>{t("(catalog)")}</small></>}
          </h3>
          <p>{t("Un abonament pentru până la {n} persoane. Nu per cap.", { n: String(PLANS.familie.members) })}</p>
          <ul>
            <li><Check size={14} /> {t("Plicuri nelimitate, pe membru și pe sursă")}</li>
            <li><Check size={14} /> {t("Sincronizare criptată între telefoane")}</li>
            <li><Check size={14} /> {t("Ghid online încăpător, OCR bonuri, PDF")}</li>
            <li><Check size={14} /> {t("Feed familie: cine a scos, din ce plic")}</li>
            <li><Check size={14} /> {t("{n} zile de probă, anulare din Google Play", { n: String(TRIAL_DAYS) })}</li>
          </ul>
        </article>
      </div>
      <p className="bf-premium-promise"><Sparkles size={14} /> {t("Dacă anulezi, registrul rămâne pe telefon. Nu luăm ostatic datele.")}</p>
      <small className="bf-helper">
        {BILLING_LIVE
          ? t("Plata trece prin Google Play. Poți anula oricând din abonamentele contului Google.")
          : t("Play Billing încă oprit (BILLING_LIVE=false). Catalogul e doar previzualizare — fără charge.")}
        {" · "}
        {t("Buget Familie nu e sfat financiar, credit sau investiție. Este un registru de familie.")}
      </small>
    </section>
  );
}
