/** Atelierul Financiar 2.0 — plăți recurente rezervate în planul până la salariu. */
import "../recurring.css";
import { useState } from "react";
import { CalendarClock, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { autoPostDueRecurring, confirmRecurringPayment, expenseCategories, inPlanPeriod, newId, parseRomanianAmount, pendingRecurringInPlan, sourceBalance, type AppData, type RecurringPayment } from "@/lib/finance-data";
import { getLocale, t } from "@/lib/i18n";
import { dateText } from "@/pages/home-kit";

const money = (value: number) => new Intl.NumberFormat(getLocale(), { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(value);

export function RecurringPanel({ data, onChange }: { data: AppData; onChange: (next: AppData) => void }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Casă & facturi");
  const [sourceId, setSourceId] = useState(data.settings.paymentSources[0]?.id || "");
  const [memberId, setMemberId] = useState(data.settings.members[0]?.id || "");
  const [dueDay, setDueDay] = useState("1");
  const [autoPost, setAutoPost] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const pending = pendingRecurringInPlan(data);
  const source = data.settings.paymentSources.find((item) => item.id === sourceId);
  const member = data.settings.members.find((item) => item.id === memberId);

  const resetForm = () => {
    setName("");
    setAmount("");
    setDueDay("1");
    setAutoPost(false);
    setError("");
    setEditingId(null);
  };

  const startEdit = (item: RecurringPayment) => {
    setEditingId(item.id);
    setName(item.name);
    setAmount(String(item.amount).replace(".", ","));
    setCategory(item.category);
    setSourceId(item.sourceId);
    setMemberId(item.memberId);
    setDueDay(String(item.dueDay));
    setAutoPost(Boolean(item.autoPost));
    setError("");
  };

  const save = () => {
    const numeric = parseRomanianAmount(amount);
    const due = Math.round(parseRomanianAmount(dueDay));
    if (!name.trim() || numeric <= 0 || !source || !member || due < 1 || due > 31) {
      return setError(t("Completează denumirea, suma, ziua (1–31), membrul și sursa."));
    }
    const now = new Date().toISOString();
    if (editingId) {
      const next: RecurringPayment[] = data.recurring.map((entry) => entry.id === editingId
        ? { ...entry, name: name.trim(), amount: numeric, category, sourceId, memberId, dueDay: due, autoPost, updatedAt: now }
        : entry);
      onChange(autoPostDueRecurring({ ...data, recurring: next }));
      resetForm();
      return;
    }
    const item: RecurringPayment = { id: newId("recurring"), name: name.trim(), amount: numeric, category, sourceId, memberId, dueDay: due, active: true, autoPost, updatedAt: now };
    onChange(autoPostDueRecurring({ ...data, recurring: [...data.recurring, item] }));
    resetForm();
  };

  const pay = (item: typeof pending[number]) => {
    const next = confirmRecurringPayment(data, item.id);
    if (next) onChange(next);
  };

  return (
    <div className="bf-recurring">
      <section className="bf-recurring-hero">
        <CalendarClock size={24} />
        <div>
          <p className="bf-kicker">{t("SCADENȚE CONTROLATE")}</p>
          <h2>{t("Chirie și abonamente, fără uitare")}</h2>
          <p>{t("La deschiderea aplicației, plățile automate scadente din luna curentă intră în registru o singură dată. Poți păstra orice scadență pe confirmare manuală.")}</p>
        </div>
      </section>
      <section className="bf-recurring-card">
        <p className="bf-kicker">{editingId ? t("MODIFICĂ SCADENȚA") : t("ADĂUGĂ O SCADENȚĂ")}</p>
        <div className="bf-recurring-form">
          <label>{t("Denumire")}<input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("ex. Chirie")} /></label>
          <label>{t("Sumă (lei)")}<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" /></label>
          <label>{t("Ziua lunii")}<input inputMode="numeric" value={dueDay} onChange={(event) => setDueDay(event.target.value)} placeholder={t("ex. 5")} /></label>
          <label>{t("Membru")}<select value={memberId} onChange={(event) => setMemberId(event.target.value)}>{data.settings.members.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>{t("Plătit din")}<select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>{data.settings.paymentSources.map((item) => <option key={item.id} value={item.id}>{item.name} · {money(sourceBalance(data, item.id))}</option>)}</select></label>
          <label>{t("Categorie")}<select value={category} onChange={(event) => setCategory(event.target.value)}>{[...expenseCategories, ...data.settings.customCategories].map((item) => <option key={item} value={item}>{t(item)}</option>)}</select></label>
        </div>
        <label className="bf-recurring-auto">
          <input type="checkbox" checked={autoPost} onChange={(event) => setAutoPost(event.target.checked)} />
          <span>
            <b>{t("Adaugă automat în registru")}</b>
            <small>{t("La prima deschidere din ziua scadenței sau după; nu poate dubla plata.")}</small>
          </span>
        </label>
        {error && <p className="bf-form-error" role="alert">{error}</p>}
        <div className="bf-recurring-form-actions">
          <button className="bf-primary" onClick={save}>{editingId ? <><Check size={17} /> {t("Actualizează scadența")}</> : <><Plus size={17} /> {t("Salvează scadența")}</>}</button>
          {editingId && <button type="button" className="bf-secondary" onClick={resetForm}><X size={16} /> {t("Anulează modificarea")}</button>}
        </div>
      </section>
      <section className="bf-recurring-card">
        <div className="bf-section-heading">
          <div>
            <p className="bf-kicker">{t("ÎN PERIOADA ACTIVĂ")}</p>
            <h2>{t("De rezervat până la venit")}</h2>
          </div>
          <strong>{money(pending.reduce((sum, item) => sum + item.amount, 0))}</strong>
        </div>
        <div className="bf-recurring-list">
          {pending.map((item) => (
            <article key={item.id}>
              <div>
                <b>{item.name}</b>
                <small>{t("Scadență: {date}", { date: dateText(item.dueDate, true) })} · {data.settings.paymentSources.find((entry) => entry.id === item.sourceId)?.name}{(() => { const balance = sourceBalance(data, item.sourceId); return ` · ${money(balance)}${balance < item.amount ? ` — ${t("nu acoperă")}` : ""}`; })()}</small>
              </div>
              <strong>{money(item.amount)}</strong>
              <div className="bf-recurring-actions">
                <button className="bf-secondary" onClick={() => pay(item)}><Check size={16} /> {t("Plătită")}</button>
                <button type="button" className="bf-recurring-edit" aria-label={t("Modifică {name}", { name: item.name })} onClick={() => startEdit(item)}><Pencil size={16} /></button>
              </div>
            </article>
          ))}
          {!pending.length && <p className="bf-empty-inline">{t("Nu ai plăți recurente de rezervat în intervalul ales sau toate au fost confirmate.")}</p>}
        </div>
      </section>
      <section className="bf-recurring-card">
        <p className="bf-kicker">{t("TOATE SCADENȚELE")}</p>
        <div className="bf-recurring-list">
          {data.recurring.map((item) => {
            const paid = data.transactions.some((tx) => tx.recurringId === item.id && inPlanPeriod(tx.date, data.settings.salaryPlan));
            const toggleAuto = () => onChange(autoPostDueRecurring({ ...data, recurring: data.recurring.map((entry) => entry.id === item.id ? { ...entry, autoPost: !entry.autoPost, updatedAt: new Date().toISOString() } : entry) }));
            const remove = () => {
              const now = new Date().toISOString();
              onChange({ ...data, recurring: data.recurring.filter((entry) => entry.id !== item.id), deleted: [...data.deleted, { entity: "recurring" as const, id: item.id, deletedAt: now }].slice(-500) });
              if (editingId === item.id) resetForm();
            };
            return (
              <article key={item.id} className={!item.active ? "muted" : editingId === item.id ? "is-editing" : ""}>
                <div>
                  <b>{item.name}</b>
                  <small>{t("Ziua {day}", { day: item.dueDay })} · {t(item.category)}</small>
                </div>
                <strong>{money(item.amount)}</strong>
                <span className={paid ? "done" : ""}>{paid ? t("Înregistrată") : item.autoPost ? t("Automată") : item.active ? t("Confirmare manuală") : t("Oprită")}</span>
                <div className="bf-recurring-actions">
                  <button className="bf-recurring-toggle" onClick={toggleAuto}>{item.autoPost ? t("Treci pe manual") : t("Treci pe automat")}</button>
                  <button type="button" className="bf-recurring-edit" aria-label={t("Modifică {name}", { name: item.name })} onClick={() => startEdit(item)}><Pencil size={16} /></button>
                  <button className="bf-recurring-delete" aria-label={t("Șterge {name}", { name: item.name })} onClick={() => window.confirm(t("Ștergi scadența „{name}”?", { name: item.name })) && remove()}><Trash2 size={16} /></button>
                </div>
              </article>
            );
          })}
          {!data.recurring.length && <p className="bf-empty-inline">{t("Adaugă facturile, ratele și contribuțiile care trebuie rezervate înainte de salariu.")}</p>}
        </div>
      </section>
    </div>
  );
}
