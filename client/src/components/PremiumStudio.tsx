import { Check, Sparkles } from "lucide-react";
import { BILLING_LIVE, PLANS } from "@/lib/entitlements";
import { t } from "@/lib/i18n";

const lei = (value: number) =>
  Number.isInteger(value)
    ? `${value} lei`
    : `${value.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lei`;

export function PremiumStudio() {
  return (
    <section className="bf-premium-catalog">
      <p className="bf-kicker">{t("ABONAMENT · DUPĂ LISTARE")}</p>
      <h2>{t("Casa e gratuită. Familia e un singur plan pentru toată gospodăria.")}</h2>
      <p>{t("Nu cerem bani acum. Pe Google Play, Casa rămâne registrul de bază. Familia deblochează sync, plicuri nelimitate și ghidul mai încăpător — fără reclame pe ecranele cu bani.")}</p>
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
          <h3>{BILLING_LIVE ? <>{lei(PLANS.familie.priceYear)}{t("/an")} <small>{lei(PLANS.familie.priceMonth)}{t("/lună")}</small></> : t("Preț pe Play, după listare")}</h3>
          <p>{t("Un abonament pentru până la 6 persoane. Nu per cap.")}</p>
          <ul>
            <li><Check size={14} /> {t("Plicuri nelimitate, pe membru și pe sursă")}</li>
            <li><Check size={14} /> {t("Sincronizare criptată între telefoane")}</li>
            <li><Check size={14} /> {t("Ghid online încăpător, OCR bonuri, PDF")}</li>
            <li><Check size={14} /> {t("Feed familie: cine a scos, din ce plic")}</li>
            <li><Check size={14} /> {t("14 zile de probă, anulare din Google Play")}</li>
          </ul>
        </article>
      </div>
      <p className="bf-premium-promise"><Sparkles size={14} /> {t("Dacă anulezi, registrul rămâne pe telefon. Nu luăm ostatic datele.")}</p>
      <small className="bf-helper">
        {BILLING_LIVE
          ? t("Plata trece prin Google Play. Poți anula oricând din abonamentele contului Google.")
          : t("Abonament Play Billing — îl activăm separat, după listare")}
        {" · "}
        {t("Buget Familie nu e sfat financiar, credit sau investiție. Este un registru de familie.")}
      </small>
    </section>
  );
}
