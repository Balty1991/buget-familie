/**
 * Bilanțul săptămânii: planificat vs realizat pe plic, cine a mișcat banii, text de trimis familiei.
 * Calculat numai din registrul local; nu scrie în AppData.
 */
import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarDays, ChevronRight, Share2 } from "lucide-react";
import { formatDate, type AppData } from "@/lib/finance-data";
import { formatWeeklyCheckInShare, weeklyCheckIn } from "@/lib/household-insights";

const money = new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 });

export function WeeklySummaryPanel({ data, onOpenJournal, onOpenPlan }: { data: AppData; onOpenJournal: () => void; onOpenPlan?: () => void }) {
  const collaborative = data.settings.members.length > 1;
  const [scope, setScope] = useState("family");
  const [shareState, setShareState] = useState<"idle" | "copied" | "shared">("idle");
  const member = data.settings.members.find((item) => item.id === scope);
  const check = weeklyCheckIn(data, undefined, member?.id);
  const label = member ? member.name : collaborative ? "Familie" : "Personal";
  const range = `${formatDate(check.start, { day: "2-digit", month: "short" })} – ${formatDate(check.end, { day: "2-digit", month: "short" })}`;
  const share = async () => {
    const text = formatWeeklyCheckInShare(check);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: `Bilanț ${check.familyName}`, text });
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
    <section id="bf-week-checkin" className={`bf-weekly-summary bf-week-checkin ${check.tone}`} aria-label={`Bilanțul săptămânii pentru ${label}`}>
      <div className="bf-weekly-summary-heading">
        <div>
          <p className="bf-kicker">BILANȚUL SĂPTĂMÂNII · {label.toUpperCase()}</p>
          <h2>Planificat și realizat</h2>
          <span className="bf-weekly-range"><CalendarDays size={14} /> {range}</span>
        </div>
        <button type="button" onClick={onOpenJournal}>Jurnal <ChevronRight size={15} /></button>
      </div>
      {collaborative && (
        <div className="bf-weekly-scope" role="group" aria-label="Perspectiva bilanțului">
          <button type="button" className={scope === "family" ? "active" : ""} onClick={() => setScope("family")}>Familie</button>
          {data.settings.members.map((item) => (
            <button type="button" key={item.id} className={scope === item.id ? "active" : ""} onClick={() => setScope(item.id)}>{item.name}</button>
          ))}
        </div>
      )}
      <p className="bf-week-checkin-step">{check.nextStep}</p>
      <div className="bf-weekly-summary-values">
        <article className="income"><span><ArrowDownRight size={17} /></span><div><small>Venituri</small><b>{money.format(check.income)}</b></div></article>
        <article className="expense"><span><ArrowUpRight size={17} /></span><div><small>Cheltuieli</small><b>{money.format(check.expense)}</b></div></article>
        <article className={`balance ${check.cashflow < 0 ? "negative" : ""}`}><div><small>Diferență</small><b>{check.cashflow >= 0 ? "+" : "−"}{money.format(Math.abs(check.cashflow))}</b></div><em>{check.transactionCount} mișcări</em></article>
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
        <div className="bf-week-envelopes" aria-label="Plicuri planificat versus realizat">
          {check.envelopes.map((item) => (
            <article key={item.id} className={item.state}>
              <header>
                <b>{item.label}</b>
                <strong>{money.format(item.spent)} <small>/ {money.format(item.planned)}</small></strong>
              </header>
              <div className="bf-week-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.round(item.usage * 100))}%` }} /></div>
              <small>{item.state === "over" ? `${money.format(Math.abs(item.remaining))} peste plan` : item.state === "watch" ? `${Math.round(item.usage * 100)}% din tranșă` : `${money.format(Math.max(0, item.remaining))} rămași`}</small>
            </article>
          ))}
        </div>
      ) : check.categories.length ? (
        <div className="bf-weekly-categories">
          {check.categories.map(([category, amount], index) => (
            <article key={category}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{category}</b><small>categorie urmărită săptămânal</small></div><strong>{money.format(amount)}</strong></article>
          ))}
        </div>
      ) : (
        <p className="bf-weekly-empty">Nu există încă mișcări în această săptămână pentru perspectiva aleasă.</p>
      )}
      <div className="bf-week-checkin-actions">
        <button type="button" className="bf-week-share" onClick={() => void share()}>
          <Share2 size={16} /> {shareState === "copied" ? "Copiat în clipboard" : shareState === "shared" ? "Trimis" : "Trimite bilanțul"}
        </button>
        {check.envelopes.some((item) => item.state === "over") && onOpenPlan ? (
          <button type="button" className="bf-week-plan" onClick={onOpenPlan}>Mută lei între plicuri <ChevronRight size={15} /></button>
        ) : null}
      </div>
    </section>
  );
}
