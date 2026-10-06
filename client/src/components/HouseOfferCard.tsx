/**
 * Momentul din care casa poate plăti: bilanțul săptămânii către partener.
 * Primul pleacă gratis. Prețul apare după, nu la instalare.
 * Din browser nu se încasează nimic — plata e Google Play, pe telefon.
 */
import { useEffect, useState } from "react";
import { Share2, Smartphone } from "lucide-react";
import { FamilieUpgrade } from "@/components/FamilieUpgrade";
import { BILLING_LIVE, formatPlanPriceRon, openFamilieCatalog, TRIAL_DAYS } from "@/lib/entitlements";
import { formatDate, type AppData } from "@/lib/finance-data";
import { hasActiveFamilie } from "@/lib/billing-store";
import { checkInRebalance, familyWeekExtras, formatWeeklyCheckInShare, weeklyCheckIn, weeklyDigestHeadline } from "@/lib/household-insights";
import { houseOfferPhase, noteOfferSend, OFFER_SENDS_EVENT, readOfferSends } from "@/lib/house-offer";
import { otherPhoneHasLogged } from "@/lib/habit-hold";
import { t } from "@/lib/i18n";
import { gateSecondPhone, gateWeeklyShare } from "@/lib/launch-offer";
import { getOrCreateDeviceId } from "@/lib/sync-devices";
import { money } from "@/pages/home-kit";
import "../house-offer.css";

export function HouseOfferCard({ data }: { data: AppData }) {
  const [sends, setSends] = useState(() => readOfferSends());
  const [blocked, setBlocked] = useState<"share" | "sync" | null>(null);
  const [shareState, setShareState] = useState<"idle" | "copied" | "shared">("idle");
  const [draft, setDraft] = useState("");
  useEffect(() => {
    const sync = () => setSends(readOfferSends());
    window.addEventListener(OFFER_SENDS_EVENT, sync);
    return () => window.removeEventListener(OFFER_SENDS_EVENT, sync);
  }, []);
  if (data.transactions.length === 0) return null;

  const check = weeklyCheckIn(data);
  const headline = weeklyDigestHeadline(data);
  const phase = houseOfferPhase(sends);
  const earned = otherPhoneHasLogged(data, getOrCreateDeviceId());
  const year = formatPlanPriceRon("familie", "year");
  const month = formatPlanPriceRon("familie", "month");
  const ask = !earned
    ? t("Abonamentul se cere după ce celălalt telefon notează o mișcare. Până atunci, bilanțul pleacă gratuit.")
    : phase === "ready"
      ? t("Celălalt telefon a notat. Familia e {year} pe an, pentru toată casa. Luna, {month}, costă mai mult. Proba de {days} zile pornește la următorul bilanț, nu la instalare.", { year, month, days: String(TRIAL_DAYS) })
      : phase === "priced"
        ? t("Partenerul a primit bilanțul o dată. Următorul pornește proba de {days} zile: {year} pentru toată casa. Luna, {month}, costă mai mult.", { days: String(TRIAL_DAYS), year, month })
        : t("De aici încolo, bilanțul săptămânal e Familia: {year}. Luna, {month}, costă mai mult. Proba e de {days} zile și nu pornește la instalare. Registrul rămâne pe telefon dacă anulezi.", { year, month, days: String(TRIAL_DAYS) });
  const shareText = () => {
    const extras = familyWeekExtras(data);
    return [formatWeeklyCheckInShare(check, checkInRebalance(data)), ...(extras.length ? ["", ...extras] : [])].join("\n");
  };
  const allow = () => {
    const gate = gateWeeklyShare({ billingLive: BILLING_LIVE, hasPaidFamilie: hasActiveFamilie(), otherPhoneLogged: earned });
    if (gate === "blocked") {
      setBlocked("share");
      return false;
    }
    setBlocked(null);
    return true;
  };
  const openSecondPhone = () => {
    const gate = gateSecondPhone({ billingLive: BILLING_LIVE, hasPaidFamilie: hasActiveFamilie(), otherPhoneLogged: earned });
    if (gate === "blocked") {
      setBlocked("sync");
      return;
    }
    setBlocked(null);
    window.dispatchEvent(new Event("buget-familie:open-sync"));
  };
  const canSend = check.transactionCount > 0;
  const send = async () => {
    if (!canSend || !allow()) return;
    const text = shareText();
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: t("Bilanț {family}", { family: check.familyName }), text });
        setShareState("shared");
        setDraft("");
        setSends(noteOfferSend());
        return;
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareState("copied");
      setDraft("");
      setSends(noteOfferSend());
    } catch {
      setDraft(text);
      setShareState("idle");
      setSends(noteOfferSend());
    }
  };
  const range = `${formatDate(check.start, { day: "2-digit", month: "short" })} – ${formatDate(check.end, { day: "2-digit", month: "short" })}`;
  const sign = check.cashflow < 0 ? "−" : "+";

  return (
    <section className="bf-house-offer" aria-label={t("Oferta pentru casă")}>
      <p className="bf-kicker">{t("CUM PLĂTEȘTE CASA")}</p>
      <h2>{t("Trimite săptămâna")}</h2>
      <p className="bf-house-offer-range">{range}</p>
      <p className="bf-house-offer-line">{headline.title}</p>
      {canSend ? (
        <dl className="bf-house-offer-figures">
          <div><dt>{t("Venituri")}</dt><dd>{money(check.income)}</dd></div>
          <div><dt>{t("Cheltuieli")}</dt><dd>{money(check.expense)}</dd></div>
          <div><dt>{t("Diferență")}</dt><dd>{sign}{money(Math.abs(check.cashflow))}</dd></div>
        </dl>
      ) : (
        <p className="bf-house-offer-line">{t("Săptămâna asta nu are încă mișcări.")}</p>
      )}
      {blocked && <FamilieUpgrade reason={blocked === "sync" ? "sync" : "share"} />}
      <p className="bf-house-offer-ask">{ask}</p>
      <div className="bf-house-offer-phone">
        <p className="bf-kicker">{t("AL DOILEA TELEFON")}</p>
        <p>{earned
          ? t("Un singur abonament pe an ține ambele telefoane. Registrul rămâne pe telefon dacă anulezi.")
          : t("Pune aplicația și pe telefonul celălalt. Abonamentul se cere abia după ce notează acolo.")}</p>
        <button type="button" className="bf-house-offer-go" onClick={openSecondPhone}>
          <Smartphone size={16} aria-hidden="true" /> {t("Pune-l pe telefonul celălalt")}
        </button>
      </div>
      {draft && (
        <label className="bf-house-offer-draft">
          {t("Nu s-a putut copia. Selectează textul și trimite-l din WhatsApp.")}
          <textarea readOnly value={draft} rows={6} />
        </label>
      )}
      <div className="bf-house-offer-actions">
        <button type="button" className="bf-house-offer-go" disabled={!canSend} onClick={() => void send()}>
          <Share2 size={16} aria-hidden="true" />
          {shareState === "copied" ? t("Copiat") : shareState === "shared" ? t("Trimis") : t("Trimite pe WhatsApp")}
        </button>
        <button type="button" className="bf-house-offer-plan" onClick={openFamilieCatalog}>{t("Vezi planul Familia")}</button>
      </div>
      <p className="bf-house-offer-note">{t("Plata se face în Google Play, pe telefon. Aici nu se ia niciun ban.")}</p>
    </section>
  );
}
