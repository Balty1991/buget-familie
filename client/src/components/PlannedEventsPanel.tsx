/**
 * Atelierul Financiar — evenimentele viitoare și banii pe care îi cer.
 *
 * Ecranul răspunde la o singură întrebare: „ce mă așteaptă în calendar și cât pun
 * deoparte de acum, ca să nu mă ia prin surprindere”. Sumele puse deoparte sunt note
 * de planificare, nu transferuri: registrul, sursele și plicurile rămân neatinse.
 */
import "../planned-events.css";
import { useMemo, useState } from "react";
import { CalendarHeart, Check, Gift, PartyPopper, Pencil, Plus, Plane, GraduationCap, Sparkles, Trash2, Wallet, X } from "lucide-react";
import { isoToday, newId, parseRomanianAmount, type AppData } from "@/lib/finance-data";
import {
  addContribution,
  plannedEventSuggestions,
  plannedEventsPressure,
  removeContribution,
  rollPlannedEvent,
  upcomingPlannedEvents,
  type PlannedEvent,
  type PlannedEventKind,
  type PlannedEventRepeat,
  type PlannedEventStatus,
} from "@/lib/planned-events";
import { daysLabel, moneyFormat, t } from "@/lib/i18n";
import { dateText } from "@/pages/home-kit";
import { RoDateInput } from "@/components/RoDateInput";
import { askConfirm } from "@/lib/confirm-dialog";

const money = (value: number) => moneyFormat(value, { maximumFractionDigits: 0 });
const kindIcon = (kind: PlannedEventKind, size = 17) => kind === "anniversary" ? <CalendarHeart size={size} /> : kind === "holiday" ? <Gift size={size} /> : kind === "trip" ? <Plane size={size} /> : kind === "school" ? <GraduationCap size={size} /> : <PartyPopper size={size} />;
const kindName = (kind: PlannedEventKind) => kind === "anniversary" ? t("Aniversare") : kind === "holiday" ? t("Sărbătoare") : kind === "trip" ? t("Vacanță") : kind === "school" ? t("Școală") : t("Altceva");
const kinds: PlannedEventKind[] = ["holiday", "anniversary", "school", "trip", "other"];

export function PlannedEventsPanel({ data, onChange }: { data: AppData; onChange: (next: AppData) => void }) {
  const today = isoToday();
  const events = data.settings.plannedEvents;
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [estimate, setEstimate] = useState("");
  const [kind, setKind] = useState<PlannedEventKind>("holiday");
  const [repeat, setRepeat] = useState<PlannedEventRepeat>("yearly");
  const [note, setNote] = useState("");
  const [anchor, setAnchor] = useState<"easter" | undefined>(undefined);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [putFor, setPutFor] = useState<string | null>(null);
  const [putAmount, setPutAmount] = useState("");
  const [openJournal, setOpenJournal] = useState<string | null>(null);

  const suggestions = useMemo(() => plannedEventSuggestions(today), [today]);
  const upcoming = useMemo(() => upcomingPlannedEvents(events, today), [events, today]);
  const pressure = useMemo(() => plannedEventsPressure(events, today), [events, today]);
  const soon = useMemo(() => plannedEventsPressure(events, today, 90), [events, today]);

  const writeEvents = (next: PlannedEvent[]) => onChange({ ...data, settings: { ...data.settings, plannedEvents: next } });
  const replaceEvent = (id: string, map: (event: PlannedEvent) => PlannedEvent) => writeEvents(events.map((item) => item.id === id ? map(item) : item));

  const resetForm = () => {
    setName(""); setDate(""); setEstimate(""); setKind("holiday"); setRepeat("yearly"); setNote(""); setAnchor(undefined); setEditingId(null); setError("");
  };

  const startEdit = (event: PlannedEvent) => {
    setEditingId(event.id);
    setName(event.name);
    setDate(event.date);
    setEstimate(event.estimate ? String(event.estimate).replace(".", ",") : "");
    setKind(event.kind);
    setRepeat(event.repeat);
    setNote(event.note || "");
    setAnchor(event.anchor);
    setError("");
    window.setTimeout(() => document.getElementById("bf-planned-event-form")?.scrollIntoView({ behavior: "smooth", block: "center" }), 40);
  };

  const save = () => {
    const amount = Math.max(0, parseRomanianAmount(estimate));
    if (!name.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError(t("Scrie o denumire și alege data din calendar."));
    const now = new Date().toISOString();
    if (editingId) {
      replaceEvent(editingId, (event) => ({ ...event, name: name.trim().slice(0, 60), date, estimate: amount, kind, repeat, anchor: repeat === "yearly" ? anchor : undefined, note: note.trim().slice(0, 200) || undefined, updatedAt: now }));
      resetForm();
      return;
    }
    writeEvents([...events, { id: newId("planned-event"), name: name.trim().slice(0, 60), date, estimate: amount, kind, repeat, anchor: repeat === "yearly" ? anchor : undefined, note: note.trim().slice(0, 200) || undefined, updatedAt: now }]);
    resetForm();
  };

  const applySuggestion = (suggestion: ReturnType<typeof plannedEventSuggestions>[number]) => {
    setEditingId(null);
    setName(suggestion.name);
    setDate(suggestion.date);
    setKind(suggestion.kind);
    setRepeat(suggestion.repeat);
    setAnchor(suggestion.anchor);
    setEstimate("");
    setNote("");
    setError("");
  };

  const putAside = (status: PlannedEventStatus) => {
    const amount = parseRomanianAmount(putAmount);
    if (amount <= 0) return;
    replaceEvent(status.event.id, (event) => addContribution(event, amount, today, undefined, newId("event-put")));
    setPutAmount("");
    setPutFor(null);
  };

  const remove = async (event: PlannedEvent) => {
    if (!await askConfirm(t("Ștergi evenimentul „{name}”?", { name: event.name }))) return;
    writeEvents(events.filter((item) => item.id !== event.id));
    if (editingId === event.id) resetForm();
  };

  const whenLabel = (status: PlannedEventStatus) => status.passed ? t("A trecut") : status.daysLeft === 0 ? t("Azi") : t("peste {days}", { days: daysLabel(status.daysLeft) });

  return (
    <div className="bf-planned-events">
      <section className="bf-planned-hero">
        <Sparkles size={24} />
        <div>
          <p className="bf-kicker">{t("EVENIMENTE VIITOARE")}</p>
          <h2>{t("Crăciunul nu vine prin surprindere")}</h2>
          <p>{t("Scrii ce urmează în calendar și cât crezi că va costa. Aplicația îți spune cât să pui deoparte pe lună ca suma să fie gata la timp. Banii puși deoparte sunt o notă de planificare — nu pleacă din surse și nu intră în registru.")}</p>
        </div>
      </section>

      <section className="bf-planned-pressure" aria-label={t("Fondul de evenimente")}>
        <article className="accent">
          <span>{t("De pus deoparte")}</span>
          <b>{money(pressure.perMonth)}</b>
          <small>{t("pe lună, pentru tot ce urmează")}</small>
        </article>
        <article>
          <span>{t("Strâns până acum")}</span>
          <b>{money(pressure.saved)}</b>
          <small>{t("din {amount} estimați", { amount: money(pressure.estimate) })}</small>
        </article>
        <article>
          <span>{t("În următoarele 3 luni")}</span>
          <b>{money(soon.remaining)}</b>
          <small>{soon.next ? t("{name} · {date}", { name: soon.next.event.name, date: dateText(soon.next.date, true) }) : t("nimic anunțat")}</small>
        </article>
      </section>

      <section className="bf-planned-card" id="bf-planned-event-form">
        <p className="bf-kicker">{editingId ? t("MODIFICĂ EVENIMENTUL") : t("ADAUGĂ UN EVENIMENT")}</p>
        {!editingId && (
          <div className="bf-planned-suggestions" role="group" aria-label={t("Sărbători gata de adăugat")}>
            {suggestions.map((suggestion) => (
              <button type="button" key={suggestion.id} onClick={() => applySuggestion(suggestion)}>
                {kindIcon(suggestion.kind, 14)} {suggestion.name} <small>{dateText(suggestion.date)}</small>
              </button>
            ))}
          </div>
        )}
        <div className="bf-planned-form">
          <label>{t("Ce se întâmplă")}<input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("ex. Ziua Anei")} /></label>
          <label>{t("Data")}<RoDateInput value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <label>{t("Cost estimat (lei)")}<input inputMode="decimal" value={estimate} onChange={(event) => setEstimate(event.target.value)} placeholder="0" /></label>
          <label>{t("Fel")}<select value={kind} onChange={(event) => setKind(event.target.value as PlannedEventKind)}>{kinds.map((item) => <option key={item} value={item}>{kindName(item)}</option>)}</select></label>
          <label>{t("Se repetă")}<select value={repeat} onChange={(event) => setRepeat(event.target.value as PlannedEventRepeat)}><option value="yearly">{t("În fiecare an")}</option><option value="once">{t("O singură dată")}</option></select></label>
          <label className="wide">{t("Notă (opțional)")}<input value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("ex. cadouri și masă")} /></label>
        </div>
        {repeat === "yearly" && (
          <label className="bf-planned-anchor">
            <input type="checkbox" checked={anchor === "easter"} onChange={(event) => setAnchor(event.target.checked ? "easter" : undefined)} />
            <span>
              <b>{t("Se ține după Paște")}</b>
              <small>{t("Paștele cade altă dată în fiecare an. Bifează și data se mută singură, păstrând distanța față de duminica Paștelui.")}</small>
            </span>
          </label>
        )}
        {error && <p className="bf-form-error" role="alert">{error}</p>}
        <div className="bf-planned-form-actions">
          <button type="button" className="bf-primary" onClick={save}>{editingId ? <><Check size={17} /> {t("Actualizează evenimentul")}</> : <><Plus size={17} /> {t("Salvează evenimentul")}</>}</button>
          {editingId && <button type="button" className="bf-secondary" onClick={resetForm}><X size={16} /> {t("Renunță la modificare")}</button>}
        </div>
      </section>

      <section className="bf-planned-card">
        <div className="bf-section-heading">
          <div>
            <p className="bf-kicker">{t("CE URMEAZĂ ÎN CALENDAR")}</p>
            <h2>{t("Evenimentele și fondul lor")}</h2>
          </div>
          <strong>{money(pressure.remaining)}</strong>
        </div>
        <div className="bf-planned-list">
          {upcoming.map((status) => {
            const event = status.event;
            const percent = status.estimate > 0 ? Math.min(100, Math.round(status.saved / status.estimate * 100)) : 0;
            const journal = event.contributions || [];
            return (
              <article key={event.id} className={`${status.passed ? "is-passed " : ""}${status.covered ? "is-covered " : ""}${editingId === event.id ? "is-editing" : ""}`}>
                <div className="bf-planned-item-head">
                  <span className="bf-planned-item-icon">{kindIcon(event.kind)}</span>
                  <div>
                    <b>{event.name}</b>
                    <small>{dateText(status.date, true)} · {whenLabel(status)} · {kindName(event.kind)}{event.repeat === "yearly" ? ` · ${t("anual")}` : ""}</small>
                  </div>
                  <strong>{money(status.estimate)}</strong>
                </div>
                {event.note && <p className="bf-planned-item-note">{event.note}</p>}
                <div className="bf-planned-progress" aria-label={t("{percent}% strâns", { percent })}><span style={{ width: `${percent}%` }} /></div>
                <p className="bf-planned-item-pace">
                  {status.covered
                    ? <><Check size={14} /> {t("Suma e strânsă: {amount} puși deoparte.", { amount: money(status.saved) })}</>
                    : status.estimate <= 0
                      ? <>{t("Scrie un cost estimat ca să-ți pot spune ritmul.")}</>
                      : status.passed
                        ? <>{t("{saved} puși deoparte din {estimate}.", { saved: money(status.saved), estimate: money(status.estimate) })}</>
                        : <>{t("{saved} din {estimate} · pune deoparte {week} pe săptămână ({month} pe lună).", { saved: money(status.saved), estimate: money(status.estimate), week: money(status.perWeek), month: money(status.perMonth) })}</>}
                </p>
                {putFor === event.id ? (
                  <div className="bf-planned-put">
                    <input autoFocus inputMode="decimal" value={putAmount} onChange={(input) => setPutAmount(input.target.value)} placeholder={status.remaining > 0 ? String(Math.ceil(status.perWeek)) : "0"} aria-label={t("Sumă pusă deoparte")} />
                    <button type="button" className="bf-primary" onClick={() => putAside(status)}><Check size={15} /> {t("Pune deoparte")}</button>
                    <button type="button" onClick={() => { setPutFor(null); setPutAmount(""); }}>{t("Renunță")}</button>
                  </div>
                ) : (
                  <div className="bf-planned-item-actions">
                    <button type="button" className="put" onClick={() => { setPutFor(event.id); setPutAmount(status.remaining > 0 ? String(Math.ceil(status.perWeek)) : ""); }}><Wallet size={15} /> {t("Pun deoparte")}</button>
                    {status.passed && status.following && <button type="button" className="roll" onClick={() => replaceEvent(event.id, rollPlannedEvent)}>{t("Închide ediția · treci la {date}", { date: dateText(status.following, true) })}</button>}
                    {journal.length > 0 && <button type="button" onClick={() => setOpenJournal((current) => current === event.id ? null : event.id)}>{openJournal === event.id ? t("Ascunde jurnalul") : t("Jurnal ({count})", { count: journal.length })}</button>}
                    <button type="button" aria-label={t("Modifică {name}", { name: event.name })} onClick={() => startEdit(event)}><Pencil size={15} /></button>
                    <button type="button" className="delete" aria-label={t("Șterge {name}", { name: event.name })} onClick={() => remove(event)}><Trash2 size={15} /></button>
                  </div>
                )}
                {openJournal === event.id && journal.length > 0 && (
                  <ul className="bf-planned-journal">
                    {journal.map((line) => (
                      <li key={line.id}>
                        <span>{dateText(line.date, true)}</span>
                        <b>{money(line.amount)}</b>
                        <button type="button" aria-label={t("Anulează suma pusă deoparte")} onClick={() => replaceEvent(event.id, (current) => removeContribution(current, line.id))}><X size={14} /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
          {!events.length && (
            <div className="bf-planned-empty">
              <Gift size={22} />
              <div>
                <b>{t("Niciun eveniment notat.")}</b>
                <small>{t("Începe cu Crăciunul sau cu o aniversare din familie — o atingere pe una dintre sugestiile de mai sus.")}</small>
              </div>
            </div>
          )}
          {events.length > 0 && !upcoming.length && <p className="bf-empty-inline">{t("Toate evenimentele sunt mai departe de un an.")}</p>}
        </div>
        <p className="bf-planned-note">{t("Fondul de evenimente este o socoteală, nu un cont. Când vine ziua, cheltuiala se notează normal în registru.")}</p>
      </section>
    </div>
  );
}
