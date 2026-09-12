/**
 * Bilanțul săptămânii: planificat vs realizat pe plic, cine a mișcat banii, text de trimis familiei.
 * Calculat numai din registrul local; nu scrie în AppData.
 */
import "../assistant-checkin.css";
import "../weekly-checkin.css";
import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, ArrowLeftRight, CalendarDays, Check, ChevronRight, FileDown, Share2 } from "lucide-react";
import { formatDate, transferBetweenEnvelopes, type AppData } from "@/lib/finance-data";
import { checkInRebalance, formatWeeklyCheckInShare, weeklyCheckIn, weeklyDigestHeadline } from "@/lib/household-insights";
import { downloadWeeklyDigestPdf } from "@/lib/weekly-digest-pdf";
import { getLocale, t } from "@/lib/i18n";

const money = new Intl.NumberFormat(getLocale(), { style: "currency", currency: "RON", maximumFractionDigits: 0 });

export function WeeklySummaryPanel({ data, onChange, onOpenJournal, onOpenPlan }: { data: AppData; onChange?: (value: AppData) => void; onOpenJournal: () => void; onOpenPlan?: () => void }) {
  const collaborative = data.settings.members.length > 1;
  const [scope, setScope] = useState("family");
  const [shareState, setShareState] = useState<"idle" | "copied" | "shared">("idle");
  // După transfer plicul nu mai e în deficit, deci propunerea dispare. Fără această confirmare,
  // cardul s-ar evapora la apăsare și utilizatorul n-ar ști dacă s-a întâmplat ceva.
  const [movedNote, setMovedNote] = useState("");
  const member = data.settings.members.find((item) => item.id === scope);
  const check = weeklyCheckIn(data, undefined, member?.id);
  const digest = weeklyDigestHeadline(data);
  // Propunerea se calculează pe familie: limitele plicurilor sunt comune, nu personale.
  const rebalance = checkInRebalance(data);
  const label = member ? member.name : collaborative ? t("Familie") : t("Personal");
  const range = `${formatDate(check.start, { day: "2-digit", month: "short" })} – ${formatDate(check.end, { day: "2-digit", month: "short" })}`;
  const share = async () => {
    const text = formatWeeklyCheckInShare(check, rebalance);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: t("Bilanț {family}", { family: check.familyName }), text });
        setShareState("shared");
        return;
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareState("copied");
    } catch {
      setShareState("idle");
    }
  };

  return (
    <section id="bf-week-checkin" className={`bf-weekly-summary bf-week-checkin ${check.tone}`} aria-label={t("Bilanțul săptămânii pentru {label}", { label })}>
      <div className="bf-weekly-summary-heading">
        <div>
          <p className="bf-kicker">{t("BILANȚUL SĂPTĂMÂNII")} · {label.toUpperCase()}</p>
          <h2>{t("Planificat și realizat")}</h2>
          <span className="bf-weekly-range"><CalendarDays size={14} /> {range}</span>
        </div>
        <button type="button" onClick={onOpenJournal}>{t("Jurnal")} <ChevronRight size={15} /></button>
      </div>
      {collaborative && (
        <div className="bf-weekly-scope" role="group" aria-label={t("Perspectiva bilanțului")}>
          <button type="button" className={scope === "family" ? "active" : ""} onClick={() => setScope("family")}>{t("Familie")}</button>
          {data.settings.members.map((item) => (
            <button type="button" key={item.id} className={scope === item.id ? "active" : ""} onClick={() => setScope(item.id)}>{item.name}</button>
          ))}
        </div>
      )}
      <article className={`bf-week-digest ${digest.tone}`} aria-label={t("Digestul săptămânii")}>
        <p className="bf-kicker">{t("DIGEST LOCAL")}</p>
        <b>{digest.title}</b>
        <small>{digest.detail}</small>
      </article>
      <p className="bf-week-checkin-step">{check.nextStep}</p>
      {!rebalance && movedNote && (
        <p className="bf-week-rebalance-done" role="status"><Check size={14} /> {movedNote}</p>
      )}
      {rebalance && (
        <div className="bf-week-rebalance" role="group" aria-label={t("Propunere de reechilibrare")}>
          <span aria-hidden="true"><ArrowLeftRight size={16} /></span>
          <div>
            <b>{t("Mută {amount} din „{from}” în „{to}”", { amount: money.format(rebalance.amount), from: rebalance.fromLabel, to: rebalance.toLabel })}</b>
            <small>
              {rebalance.covers
                ? t("Acoperă tot deficitul de {amount}.", { amount: money.format(rebalance.deficit) })
                : t("Acoperă {amount} din deficitul de {deficit}; restul cere o reducere a cheltuielilor.", { amount: money.format(rebalance.amount), deficit: money.format(rebalance.deficit) })}
              {" "}{t("Se schimbă doar limitele plicurilor, nu se mișcă bani între surse.")}
            </small>
          </div>
          {onChange && (
            <button
              type="button"
              onClick={() => {
                const next = transferBetweenEnvelopes(data, { fromAllocationId: rebalance.fromId, toAllocationId: rebalance.toId, amount: rebalance.amount, note: t("Reechilibrare din bilanțul săptămânii") });
                if (!next) return;
                setMovedNote(t("Ai mutat {amount} din „{from}” în „{to}”.", { amount: money.format(rebalance.amount), from: rebalance.fromLabel, to: rebalance.toLabel }));
                onChange(next);
              }}
            >
              {t("Mută acum")}
            </button>
          )}
        </div>
      )}
      <div className="bf-weekly-summary-values">
        <article className="income"><span><ArrowDownRight size={17} /></span><div><small>{t("Venituri")}</small><b>{money.format(check.income)}</b></div></article>
        <article className="expense"><span><ArrowUpRight size={17} /></span><div><small>{t("Cheltuieli")}</small><b>{money.format(check.expense)}</b></div></article>
        <article className={`balance ${check.cashflow < 0 ? "negative" : ""}`}><div><small>{t("Diferență")}</small><b>{check.cashflow >= 0 ? "+" : "−"}{money.format(Math.abs(check.cashflow))}</b></div><em>{t("{count} mișcări", { count: check.transactionCount })}</em></article>
      </div>
      {collaborative && check.members.some((item) => item.expense > 0) && (
        <ul className="bf-week-members">
          {check.members.map((item) => (
            <li key={item.memberId}>
              <b>{item.name}</b>
              <i><em style={{ width: `${Math.round(item.share * 100)}%` }} /></i>
              <strong>{money.format(item.expense)}</strong>
            </li>
          ))}
        </ul>
      )}
      {check.envelopes.length > 0 ? (
        <div className="bf-week-envelopes" aria-label={t("Plicuri planificat versus realizat")}>
          {check.envelopes.map((item) => (
            <article key={item.id} className={item.state}>
              <header>
                <b>{item.label}</b>
                <strong>{money.format(item.spent)} <small>/ {money.format(item.planned)}</small></strong>
              </header>
              <div className="bf-week-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.round(item.usage * 100))}%` }} /></div>
              <small>{item.state === "over" ? t("{amount} peste plan", { amount: money.format(Math.abs(item.remaining)) }) : item.state === "watch" ? t("{pct}% din tranșă", { pct: Math.round(item.usage * 100) }) : t("{amount} rămași", { amount: money.format(Math.max(0, item.remaining)) })}</small>
            </article>
          ))}
        </div>
      ) : check.categories.length ? (
        <div className="bf-weekly-categories">
          {check.categories.map(([category, amount], index) => (
            <article key={category}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{category}</b><small>{t("categorie urmărită săptămânal")}</small></div><strong>{money.format(amount)}</strong></article>
          ))}
        </div>
      ) : (
        <p className="bf-weekly-empty">{t("Nu există încă mișcări în această săptămână pentru perspectiva aleasă.")}</p>
      )}
      <div className="bf-week-checkin-actions">
        <button type="button" className="bf-week-share" onClick={() => void share()}>
          <Share2 size={16} /> {shareState === "copied" ? t("Copiat în clipboard") : shareState === "shared" ? t("Trimis") : t("Trimite bilanțul")}
        </button>
        <button type="button" className="bf-week-plan" onClick={() => void downloadWeeklyDigestPdf(data).catch(() => undefined)}>
          <FileDown size={16} /> {t("PDF digest")}
        </button>
        {check.envelopes.some((item) => item.state === "over") && onOpenPlan ? (
          <button type="button" className="bf-week-plan" onClick={onOpenPlan}>{t("Mută lei între plicuri")} <ChevronRight size={15} /></button>
        ) : null}
      </div>
    </section>
  );
}
