import "../consultant.css";
import { useState } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { isoToday, type AppData } from "@/lib/finance-data";
import { askConfirm } from "@/lib/confirm-dialog";
import { isFamilie } from "@/lib/entitlements";
import { isOfflineOnly } from "@/lib/ui-prefs";
import { getLocale, t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";
import { FamilieUpgrade } from "@/components/FamilieUpgrade";
import { consultConsented, consultReady, consultTeaser, rememberConsultConsent, requestConsult, savedConsult, type ConsultSource, type SavedConsult } from "@/lib/consultant";

const SOURCE_NAME: Record<ConsultSource, string> = { gemini: "Gemini", groq: "Groq" };
const STATUS_LABEL = { bine: "Pe drumul bun", atentie: "Atenție", risc: "Risc" } as const;

/** Ledul cu numele celui care a răspuns, același ca în ghid. */
export function SourceLed({ source }: { source: "local" | ConsultSource }) {
  const name = source === "local" ? t("Pe telefon") : SOURCE_NAME[source];
  return <span className={`bf-src-chip is-${source}`}><i aria-hidden="true" />{name}</span>;
}

/**
 * Consultantul lunii: un raport scurt, cerut de om, cu pașii pentru luna următoare.
 * Raportul rămâne pe telefon pentru luna în curs; pleacă la AI doar rezumatul cifrelor.
 */
export function ConsultantCard({ data }: { data: AppData }) {
  const [saved, setSaved] = useState<SavedConsult | undefined>(() => savedConsult());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (isOfflineOnly()) return null;
  const familie = isFamilie();
  const ready = consultReady(data);
  const month = isoToday().slice(0, 7);
  const current = saved && saved.month === month ? saved : undefined;
  const lateInMonth = Number(isoToday().slice(8, 10)) >= 25;

  const ask = async () => {
    if (busy) return;
    if (!consultConsented()) {
      const ok = await askConfirm(t("Consultantul folosește un serviciu AI (Google Gemini sau Groq). Pleacă doar un rezumat cu cifre: totaluri pe luni și categorii, plicuri, datorii, obiective. Nu pleacă mișcările, magazinele, notițele sau numele voastre."), { title: t("Consultantul financiar"), confirmLabel: t("Am înțeles, cere raportul") });
      if (!ok) return;
      rememberConsultConsent();
    }
    setBusy(true);
    setError("");
    try {
      setSaved(await requestConsult(data));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Consultantul nu a putut răspunde acum. Mai încearcă puțin mai târziu."));
    } finally {
      setBusy(false);
    }
  };

  const report = saved?.report;
  return <section className="bf-consultant" aria-busy={busy}>
    <header>
      <span className="bf-consultant-icon"><Sparkles size={18} aria-hidden="true" /></span>
      <div><p className="bf-kicker">{t("CONSULTANTUL FINANCIAR")}</p><h2>{report && saved ? report.headline : t("Cum stăm luna asta?")}</h2></div>
      {saved && report ? <SourceLed source={saved.source} /> : null}
    </header>
    {!familie ? <>
      {/* Ce primește abonatul: prima frază, calculată pe telefon; restul, estompat. */}
      <p className="bf-consultant-summary">{consultTeaser(data)}</p>
      <div className="bf-consultant-teaser" aria-hidden="true"><i /><i /><i /></div>
      <FamilieUpgrade reason="ai" />
    </> : report && saved ? <>
      <p className={`bf-consultant-status is-${report.status}`}>{t(STATUS_LABEL[report.status])}{current ? "" : ` · ${t("raportul lunii trecute")}`}</p>
      <p className="bf-consultant-summary">{report.summary}</p>
      {report.actions.length ? <ol className="bf-consultant-actions">{report.actions.map((action) => <li key={action.title}><div><b>{action.title}</b><p>{action.detail}</p></div>{action.amount > 0 ? <em>{lei(action.amount)}{t("/lună")}</em> : null}</li>)}</ol> : null}
      {report.watch.length ? <div className="bf-consultant-watch"><small>{t("Urmăresc în continuare")}</small><ul>{report.watch.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
      {report.praise ? <p className="bf-consultant-praise">{report.praise}</p> : null}
      <footer><small>{t("Raport din {date}. Sfaturile sunt orientative, nu consultanță autorizată.", { date: new Date(saved.at).toLocaleDateString(getLocale(), { day: "numeric", month: "long" }) })}</small><button type="button" onClick={() => void ask()} disabled={busy}>{busy ? <Loader2 size={15} className="bf-spin" aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />} {t("Actualizează")}</button></footer>
    </> : <>
      <p className="bf-consultant-summary">{ready ? (lateInMonth ? t("Luna se apropie de final: raportul lunii e gata de cerut. Primești o evaluare sinceră și trei pași concreți, cu sume.") : t("Primești o evaluare sinceră a lunii față de lunile trecute și trei pași concreți, cu sume în lei.")) : t("Notează mișcări câteva zile și consultantul va avea ce analiza.")}</p>
      <button type="button" className="bf-primary bf-consultant-ask" disabled={busy || !ready} onClick={() => void ask()}>{busy ? <><Loader2 size={16} className="bf-spin" aria-hidden="true" /> {t("Consultantul analizează…")}</> : t("Cere raportul lunii")}</button>
    </>}
    {error ? <p className="bf-form-error" role="alert">{error}</p> : null}
  </section>;
}
