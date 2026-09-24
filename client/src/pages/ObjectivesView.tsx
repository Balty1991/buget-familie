/**
 * Ecranul Obligații. Se încarcă singur, fără Setări, Sync sau bon.
 */
import "../objective-edit.css";
import "../mobile-obligations-pass.css";
import { useState } from "react";
import { BellRing, Bot, CalendarClock, CalendarDays, Check, ChevronRight, Gift, Pencil, PiggyBank, Plus, Trash2 } from "lucide-react";
import { debtPaymentHistory, debtSnowball, isoDate, isoToday, pendingRecurringInPlan, type AppData, type Debt, type SavingsGoal, type Transaction } from "@/lib/finance-data";
import { BudgetBar, dateText, money } from "@/pages/home-kit";
import { t } from "@/lib/i18n";
import { upcomingPlannedEvents } from "@/lib/planned-events";

export function DebtPaymentHistory({ data, debt }: { data: AppData; debt: Debt }) { const history = debtPaymentHistory(data, debt.id); if (!history.length) return <p className="bf-debt-history empty">{t("Nu există încă plăți confirmate pentru această datorie.")}</p>; return <div className="bf-debt-history"><p>{t("PLĂȚI ÎNREGISTRATE")}</p>{history.slice(0, 4).map((payment) => <div key={payment.id}><span><b>{payment.title.includes("achitată integral") ? t("Achitată integral") : t("Plată parțială")}</b><small>{dateText(payment.date, true)} · {payment.source}</small></span><span><strong>{money(payment.amount)}</strong><small>{t("rămân {amount}", { amount: money(payment.debtRemainingAfter ?? debt.remaining) })}</small></span></div>)}</div>; }

type ScheduleRow = { index: number; date: string; amount: number; paid?: Transaction };
function debtScheduleRows(data: AppData, debt: Debt): ScheduleRow[] {
  const monthly = Math.max(0, debt.monthly);
  if (!monthly) return [];
  const history = debtPaymentHistory(data, debt.id).slice().sort((a, b) => a.date.localeCompare(b.date));
  const first = debt.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(debt.dueDate) ? new Date(debt.dueDate + "T12:00:00") : new Date();
  const original = Math.max(debt.remaining + history.reduce((sum, item) => sum + item.amount, 0), monthly);
  const count = Math.min(120, Math.max(1, Math.ceil(original / monthly)));
  return Array.from({ length: count }, (_, offset) => {
    const index = offset + 1;
    const dateObject = new Date(first.getFullYear(), first.getMonth() + offset, Math.min(first.getDate(), new Date(first.getFullYear(), first.getMonth() + offset + 1, 0).getDate()), 12);
    const date = isoDate(dateObject);
    const paid = history.find((item) => item.date.slice(0, 7) === date.slice(0, 7));
    return { index, date, amount: Math.min(monthly, Math.max(0, original - offset * monthly)), paid };
  });
}
function DebtSchedule({ data, debt, onPay }: { data: AppData; debt: Debt; onPay: () => void }) {
  const rows = debtScheduleRows(data, debt);
  const [expanded, setExpanded] = useState(false);
  if (!rows.length) return null;
  const visible = expanded ? rows : rows.slice(0, 6);
  const paidCount = rows.filter((row) => row.paid).length;
  return <div className="bf-debt-schedule"><div className="bf-debt-schedule-head"><div><p>{t("SCADENȚAR COMPLET")}</p><b>{paidCount} din {rows.length} rate bifate</b></div><span>{money(debt.remaining)} rămas</span></div><div className="bf-debt-schedule-list">{visible.map((row) => <div className={"bf-debt-schedule-row " + (row.paid ? "paid" : "")} key={row.date}><button type="button" className="bf-schedule-check" aria-label={row.paid ? "Rata " + row.index + t(" achitată") : t("Confirmă rata ") + row.index} onClick={row.paid ? undefined : onPay}>{row.paid ? <Check size={15} /> : <span />}</button><span><b>Rata {String(row.index).padStart(2, "0")}</b><small>{dateText(row.date, true)}{row.paid ? t(" · plătită la ") + dateText(row.paid.date, true) : t(" · neplătită")}</small></span><strong>{money(row.paid?.amount || row.amount)}</strong></div>)}</div>{rows.length > 6 && <button type="button" className="bf-schedule-more" onClick={() => setExpanded((value) => !value)}>{expanded ? t("Arată mai puține") : t("Arată toate cele ") + rows.length + " rate"}</button>}</div>;
}
function DebtPayoffSimulator({ data }: { data: AppData }) {
  const [extra, setExtra] = useState(0);
  const active = data.debts.filter((debt) => debt.remaining > 0);
  const total = active.reduce((sum, debt) => sum + debt.remaining, 0);
  const minimum = active.reduce((sum, debt) => sum + Math.max(0, debt.monthly), 0);
  if (!total || !minimum) return null;
  const baseMonths = Math.ceil(total / minimum);
  const simulatedMonths = Math.ceil(total / (minimum + extra));
  const savedMonths = Math.max(0, baseMonths - simulatedMonths);
  const maxExtra = Math.max(100, Math.ceil(minimum * 1.5 / 100) * 100);
  return <section className="bf-debt-simulator"><div className="bf-debt-simulator-head"><div><p className="bf-kicker">{t("SIMULATOR DE DECIZIE")}</p><h2>{t("Dacă plătești")} <em>{t("în plus")}</em>?</h2><span>{t("Testează un efort lunar suplimentar. Nu schimbă datele tale, doar îți arată scenariul.")}</span></div><div className="bf-debt-simulator-result"><strong>{savedMonths ? "−" + savedMonths : "0"}</strong><small>{t("luni câștigate")}</small></div></div><div className="bf-debt-slider"><div><span>{t("Sumă extra / lună")}</span><b>{money(extra)}</b></div><input type="range" min="0" max={maxExtra} step="50" value={extra} onChange={(event) => setExtra(Number(event.target.value))} aria-label={t("Sumă suplimentară lunară")} /><div className="bf-debt-slider-labels"><small>0 RON</small><small>{money(maxExtra)}</small></div></div><div className="bf-debt-simulator-summary"><span><b>{baseMonths}</b><small>{t("luni acum")}</small></span><span><b>{simulatedMonths}</b><small>{t("luni cu extra")}</small></span><span><b>{money(minimum + extra)}</b><small>{t("efort lunar")}</small></span></div></section>;
}
export function ObjectivesView({ data, onEditDebt, onEditSaving, onPayDebt, onDeleteDebt, onDeleteSaving, openDebt, openSaving, onOpenRecurring, onPayRecurring, onOpenGoals, onOpenCalendar, onOpenEvents, onOpenAssistant }: { data: AppData; onEditDebt: (item: Debt) => void; onEditSaving: (item: SavingsGoal) => void; onPayDebt: (item: Debt) => void; onDeleteDebt: (id: string) => void; onDeleteSaving: (id: string) => void; openDebt: () => void; openSaving: () => void; onOpenRecurring: () => void; onPayRecurring: (id: string) => void; onOpenGoals: () => void; onOpenCalendar: () => void; onOpenEvents: () => void; onOpenAssistant: () => void }) {
  const [laterIds, setLaterIds] = useState<string[]>([]);
  const totalDebt = data.debts.reduce((sum, item) => sum + item.remaining, 0);
  const totalSavings = data.savings.reduce((sum, item) => sum + item.current, 0);
  const monthlyRates = data.debts.reduce((sum, item) => sum + item.monthly, 0);
  const snowball = debtSnowball(data);
  const rankedDebts = snowball.order.length ? [...snowball.order.map((item) => item.debt), ...data.debts.filter((item) => item.remaining <= 0)] : data.debts;
  const today = isoToday();
  const inferDue = (item: { dueDate?: string; due?: string }) => {
    if (item.dueDate) return item.dueDate;
    const day = Number(String(item.due || "").match(/\d{1,2}/)?.[0]);
    if (!Number.isFinite(day) || day < 1 || day > 31) return "";
    const now = new Date();
    const lastThis = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const thisMonth = isoDate(new Date(now.getFullYear(), now.getMonth(), Math.min(day, lastThis), 12));
    if (thisMonth >= today) return thisMonth;
    const lastNext = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate();
    return isoDate(new Date(now.getFullYear(), now.getMonth() + 1, Math.min(day, lastNext), 12));
  };
  const upcoming = [
    ...data.debts.filter((item) => item.remaining > 0).map((item) => ({
      id: `debt-${item.id}`,
      kind: "debt" as const,
      date: inferDue(item),
      label: item.name,
      detail: t("Rată {amount}/lună", { amount: money(item.monthly) }),
      amount: item.monthly || item.remaining,
      onConfirm: () => onPayDebt(item),
    })).filter((item) => item.date),
    ...data.savings.filter((item) => item.dueDate).map((item) => ({
      id: `saving-${item.id}`,
      kind: "saving" as const,
      date: item.dueDate!,
      label: item.name,
      detail: t("Obiectiv"),
      amount: Math.max(0, item.target - item.current),
      onConfirm: onOpenGoals,
    })),
    /**
     * Evenimentele din calendar stau lângă rate și facturi, fiindcă la fel se cer:
     * la o dată știută, cu o sumă știută. Suma arătată e cât mai lipsește din fond,
     * nu costul întreg — restul e deja pus deoparte.
     */
    ...upcomingPlannedEvents(data.settings.plannedEvents, today, 120).map((status) => ({
      id: `event-${status.event.id}`,
      kind: "event" as const,
      date: status.date,
      label: status.event.name,
      detail: status.remaining > 0 ? t("mai ai de strâns {amount}", { amount: money(status.remaining) }) : t("fondul e complet"),
      amount: status.remaining,
      onConfirm: onOpenEvents,
    })),
    ...pendingRecurringInPlan(data).map((item) => ({
      id: `recurring-${item.id}`,
      kind: "recurring" as const,
      date: item.dueDate,
      label: item.name,
      detail: item.category,
      amount: item.amount,
      onConfirm: () => onPayRecurring(item.id),
    })),
  ].filter((entry) => !laterIds.includes(entry.id)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
  const kindLabel = (kind: "debt" | "saving" | "recurring" | "event") => kind === "debt" ? t("Rată") : kind === "saving" ? t("Obiectiv") : kind === "event" ? t("Eveniment") : t("Factură / abonament");
  const whenLabel = (date: string) => {
    if (date < today) return t("Întârziată");
    if (date === today) return t("Azi");
    return dateText(date, true);
  };
  return (
    <div className="bf-page bf-obligations-workspace">
      <section className="bf-upcoming-hero" aria-labelledby="bf-upcoming-title">
        <div>
          <p className="bf-kicker">{t("CE URMEAZĂ")}</p>
          <h1 id="bf-upcoming-title">{t("Ce trebuie")} <em>{t("plătit, rezervat sau amânat.")}</em></h1>
          <p>{t("Rate, facturi și obiective pe o singură listă. Confirmarea creează mișcarea — nu trimite bani din bancă.")}</p>
        </div>
        <div className="bf-obligations-links">
          <button className="bf-goals-link" onClick={onOpenGoals}><PiggyBank size={16} /> {t("Obiective pe termen lung")}</button>
          <button className="bf-goals-link" onClick={onOpenCalendar}><CalendarDays size={16} /> {t("Calendar de scadențe")}</button>
          <button className="bf-goals-link" onClick={onOpenEvents}><Gift size={16} /> {t("Evenimente viitoare")}</button>
        </div>
        <section className="bf-sub-board" aria-label={t("Abonamente")}>
          <div className="bf-section-heading">
            <div>
              <p className="bf-kicker">{t("ABONAMENTE")}</p>
              <h2>{t("În fiecare lună")}</h2>
            </div>
            <button type="button" onClick={onOpenRecurring}>{data.recurring.some((item) => item.active) ? t("Gestionează") : t("Adaugă")}</button>
          </div>
          {data.recurring.some((item) => item.active) ? (
            <ul>
              {data.recurring.filter((item) => item.active).map((item) => (
                <li key={item.id}>
                  <b>{item.name}</b>
                  <small>{t("în fiecare lună")} · {t("Ziua {day}", { day: item.dueDay })}</small>
                  <strong>{money(item.amount)}</strong>
                </li>
              ))}
            </ul>
          ) : <p>{t("Chirie, telefon, Netflix — un nume și o sumă. Fără logo.")}</p>}
        </section>
        {upcoming.length ? (
          <div className="bf-upcoming-list">
            {upcoming.map((entry, index) => (
              <article key={entry.id} className={`bf-upcoming-item kind-${entry.kind}${index === 0 ? " is-next" : ""}${entry.date < today ? " is-overdue" : ""}`}>
                <div className="bf-upcoming-item-main">
                  <span>{entry.kind === "saving" ? <PiggyBank size={17} /> : entry.kind === "recurring" ? <CalendarClock size={17} /> : entry.kind === "event" ? <Gift size={17} /> : <BellRing size={17} />}</span>
                  <div>
                    <b>{entry.label}</b>
                    <small>{kindLabel(entry.kind)} · {whenLabel(entry.date)} · {entry.detail}</small>
                  </div>
                  <strong>{money(entry.amount)}</strong>
                </div>
                <div className="bf-upcoming-actions">
                  <button type="button" className="pay" onClick={entry.onConfirm}><Check size={16} /> {entry.kind === "saving" || entry.kind === "event" ? t("Deschide") : t("Confirmă plata")}</button>
                  <button type="button" onClick={() => setLaterIds((current) => [...current, entry.id])}>{t("Mai târziu")}</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="bf-upcoming-empty">
            <b>{t("Nu ai scadențe apropiate.")}</b>
            <p>{t("Adaugă o rată, o factură recurentă sau un obiectiv — apar aici, în ordine.")}</p>
          </div>
        )}
      </section>
      <details className="bf-debt-tools">
        <summary>{t("Simulează o plată în plus")}</summary>
        <DebtPayoffSimulator data={data} />
      </details>
      <section className="bf-obligation-ai">
        <div className="bf-obligation-ai-icon"><Bot size={22} /></div>
        <div>
          <p className="bf-kicker">{t("GHIDUL TĂU PENTRU OBLIGAȚII")}</p>
          <h2>{t("Îți urmăresc ratele, pas cu pas.")}</h2>
          <p>{t("Spune-mi ce datorie ai, ce rată ai plătit și îți arăt imediat ce urmează și cât mai rămâne.")}</p>
        </div>
        <button type="button" onClick={onOpenAssistant} className="bf-primary">{t("Deschide ghidul")} <ChevronRight size={16} /></button>
      </section>
      <section className="bf-obligation-ledger">
        <article className="debt"><span>{t("Sold datorii")}</span><b>{money(totalDebt)}</b><small>{t("{amount} rate declarate / lună", { amount: money(monthlyRates) })}</small></article>
        <article className="savings"><span>{t("Economii urmărite")}</span><b>{money(totalSavings)}</b><small>{t("{count} obiective înregistrate", { count: data.savings.length })}</small></article>
        <button onClick={onOpenRecurring}><CalendarClock size={18} /><span>{t("Scadențe programate")}</span><b>{data.recurring.length + data.debts.filter((item) => item.remaining > 0 && item.monthly > 0 && item.dueDate).length}</b><ChevronRight size={16} /></button>
      </section>
      <section className="bf-obligation-actions">
        <button type="button" className="bf-secondary bf-obligation-cta debt" onClick={openDebt}><Plus size={17} /> {t("Adaugă datorie")}</button>
        <button type="button" className="bf-secondary bf-obligation-cta savings" onClick={openSaving}><Plus size={17} /> {t("Creează economisire")}</button>
      </section>
      <div className="bf-obligation-lanes">
        <section className="bf-obligation-lane debt">
          <header><div><p className="bf-kicker">{t("DE PLĂTIT")}</p><h2>{t("Rate și împrumuturi")}</h2></div><span>{data.debts.length}</span></header>
          {rankedDebts.map((debt) => (
            <article className={`bf-obligation-entry${snowball.next?.debt.id === debt.id ? " next" : ""}`} key={debt.id}>
              <div className="bf-obligation-entry-main">
                <span><BellRing size={17} /></span>
                <div>
                  <b>{debt.name}</b>
                  {snowball.next?.debt.id === debt.id ? <em className="bf-snowball-tag">{t("01 · următoarea")}</em> : null}
                  <small>{debt.due} · {t("rată {amount}/lună", { amount: money(debt.monthly) })}</small>
                </div>
                <strong>{money(debt.remaining)}</strong>
              </div>
              <DebtPaymentHistory data={data} debt={debt} />
              <DebtSchedule data={data} debt={debt} onPay={() => onPayDebt(debt)} />
              <div className="bf-obligation-entry-actions">
                <button className="pay" onClick={() => onPayDebt(debt)}><Check size={16} /> {t("Confirmă plata")}</button>
                <button onClick={() => onEditDebt(debt)}><Pencil size={15} /> {t("Editează")}</button>
                <button className="delete" aria-label={`Șterge ${debt.name}`} onClick={() => onDeleteDebt(debt.id)}><Trash2 size={16} /></button>
              </div>
            </article>
          ))}
          {!data.debts.length && (
            <div className="bf-obligation-empty">
              <BellRing size={21} />
              <span><b>{t("Nu ai datorii înregistrate.")}</b><small>{t("Adaugă doar obligațiile pe care vrei să le rezervi în plan.")}</small></span>
              <button type="button" className="bf-secondary" onClick={openDebt}>{t("Adaugă")}</button>
            </div>
          )}
        </section>
        <section className="bf-obligation-lane savings">
          <header><div><p className="bf-kicker">{t("DE CONSTRUIT")}</p><h2>{t("Economii și obiective")}</h2></div><span>{data.savings.length}</span></header>
          {data.savings.map((saving) => (
            <article className="bf-obligation-entry" key={saving.id}>
              <div className="bf-obligation-entry-main">
                <span><PiggyBank size={17} /></span>
                <div><b>{saving.name}</b><small>{saving.due}</small></div>
                <strong>{money(saving.current)}</strong>
              </div>
              <div className="bf-obligation-progress">
                <BudgetBar used={saving.current} total={saving.target} tone="gold" />
                <small>{t("{left} rămași până la {target}", { left: money(Math.max(0, saving.target - saving.current)), target: money(saving.target) })}</small>
              </div>
              <div className="bf-obligation-entry-actions">
                <button onClick={() => onEditSaving(saving)}><Pencil size={15} /> {t("Editează")}</button>
                <button className="delete" aria-label={`Șterge ${saving.name}`} onClick={() => onDeleteSaving(saving.id)}><Trash2 size={16} /></button>
              </div>
            </article>
          ))}
          {!data.savings.length && (
            <div className="bf-obligation-empty">
              <PiggyBank size={21} />
              <span><b>{t("Nu ai obiective de economisire.")}</b><small>{t("Începe cu fondul de siguranță sau un obiectiv concret.")}</small></span>
              <button type="button" className="bf-secondary" onClick={openSaving}>{t("Creează")}</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
