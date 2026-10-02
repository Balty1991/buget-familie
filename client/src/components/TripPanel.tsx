/**
 * Modul vacanță (Mai mult → Vacanță): plănuiești călătoria cu bugetul ei, iar cât ține, Notează
 * pune cheltuielile acolo, nu în plicuri. Aici vezi cât mai e, pe zi și pe ce s-a dus; la final,
 * rezumatul vacanței.
 */
import "../trip.css";
import { useMemo, useState } from "react";
import { Plane, Plus } from "lucide-react";
import { exchangeRateFor, isoToday, newId, parseRomanianAmount, type AppData } from "@/lib/finance-data";
import { draftTrip, tripStats, type Trip } from "@/lib/trip";
import { RoDateInput } from "@/components/RoDateInput";
import { daysLabel, getLocale, t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";
import { dateText } from "@/pages/home-kit";

const CURRENCIES = ["EUR", "BGN", "HUF", "GBP", "USD", "TRY"];

export function TripPanel({ data, onChange }: { data: AppData; onChange: (next: AppData) => void }) {
  const today = isoToday();
  const trip = data.settings.trip;
  const [planning, setPlanning] = useState(!trip);
  const draft = draftTrip(today);
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [start, setStart] = useState(draft.start);
  const [end, setEnd] = useState(draft.end);
  const [currency, setCurrency] = useState("EUR");
  const [error, setError] = useState("");
  const stats = useMemo(() => (trip ? tripStats(data, trip, today) : undefined), [data, trip, today]);
  const save = (next: Trip) => onChange({ ...data, settings: { ...data.settings, trip: next } });
  const foreign = (amount: number, code?: string) => {
    const rate = code ? exchangeRateFor(data, code) : undefined;
    return rate ? new Intl.NumberFormat(getLocale(), { style: "currency", currency: code, maximumFractionDigits: 0 }).format(amount / rate) : "";
  };

  const create = () => {
    const amount = parseRomanianAmount(budget);
    if (!name.trim()) return setError(t("Dă-i un nume vacanței."));
    if (!(amount > 0)) return setError(t("Scrie bugetul vacanței, în lei."));
    if (!start || !end || end < start) return setError(t("Ultima zi trebuie să fie după prima."));
    save({ id: newId("trip"), name: name.trim().slice(0, 60), budget: Math.round(amount * 100) / 100, start, end, ...(currency !== "RON" ? { currency } : {}), updatedAt: new Date().toISOString() });
    setPlanning(false); setError("");
  };

  if (planning || !trip || !stats) return <section className="bf-trip" aria-labelledby="bf-trip-title">
    <header><p className="bf-kicker">{t("MOD VACANȚĂ")}</p><h2 id="bf-trip-title">{t("Plănuiește o vacanță")}</h2><p>{t("Are bugetul ei. Cât ține, ce notezi merge acolo, nu în plicurile lunii.")}</p></header>
    <form className="bf-trip-form" onSubmit={(event) => { event.preventDefault(); create(); }}>
      <label className="bf-field"><span>{t("Unde mergeți")}</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("ex. Mare, Grecia")} maxLength={60} /></label>
      <label className="bf-field"><span>{t("Buget (lei)")}</span><input value={budget} onChange={(event) => setBudget(event.target.value)} inputMode="decimal" placeholder="3000" /></label>
      <label className="bf-field"><span>{t("Prima zi")}</span><RoDateInput value={start} onChange={(event) => setStart(event.target.value)} /></label>
      <label className="bf-field"><span>{t("Ultima zi")}</span><RoDateInput value={end} min={start} onChange={(event) => setEnd(event.target.value)} /></label>
      <label className="bf-field"><span>{t("Arată și în")}</span><select value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="RON">{t("doar lei")}</option>{CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}</select></label>
      {error && <p className="bf-form-error" role="alert">{error}</p>}
      <button type="submit" className="bf-primary"><Plane size={17} aria-hidden="true" /> {t("Pornește modul vacanță")}</button>
      {trip && <button type="button" className="bf-ghost" onClick={() => setPlanning(false)}>{t("Renunță")}</button>}
    </form>
  </section>;

  const over = stats.left < 0;
  const used = trip.budget > 0 ? Math.min(100, Math.round((stats.spent / trip.budget) * 100)) : 100;
  const leftForeign = foreign(Math.max(0, stats.left), trip.currency);
  return <section className="bf-trip" aria-labelledby="bf-trip-title">
    <header>
      <p className="bf-kicker">{stats.done ? t("VACANȚA S-A ÎNCHEIAT") : stats.dayIndex ? t("ZIUA {day} DIN {days}", { day: stats.dayIndex, days: stats.days }) : t("ÎNCEPE PE {date}", { date: dateText(trip.start) })}</p>
      <h2 id="bf-trip-title">{trip.name}</h2>
      <p>{dateText(trip.start)} – {dateText(trip.end)} · {daysLabel(stats.days)}</p>
    </header>
    <div className={`bf-trip-hero${over ? " is-over" : ""}`}>
      <small>{over ? t("PESTE BUGET CU") : stats.done ? t("V-AU RĂMAS") : t("MAI AVEȚI")}</small>
      <b>{lei(Math.abs(stats.left))}</b>
      {leftForeign && !over && <span>≈ {leftForeign}</span>}
      <i role="img" aria-label={t("{spent} din {budget}", { spent: lei(stats.spent), budget: lei(trip.budget) })}><em style={{ width: `${used}%` }} /></i>
      <p>{t("{spent} din {budget}", { spent: lei(stats.spent), budget: lei(trip.budget) })}{stats.done ? ` · ${t("~{amount} pe zi", { amount: lei(stats.perDaySpent) })}` : stats.daysLeft && !over ? ` · ${t("~{amount} pe zi de acum", { amount: lei(stats.perDayLeft) })}` : ""}</p>
    </div>
    {stats.done && <p className="bf-trip-summary">{over ? t("Ați cheltuit cu {amount} peste ce ați pus deoparte. Data viitoare, un buget puțin mai mare.", { amount: lei(-stats.left) }) : t("Ați rămas în buget. {amount} se pot întoarce la economii.", { amount: lei(stats.left) })}</p>}
    {stats.byCategory.length > 0 && <ul className="bf-trip-cats">{stats.byCategory.slice(0, 6).map((row) => <li key={row.category}><span>{t(row.category)}</span><b>{lei(row.amount)}</b><i><em style={{ width: `${Math.round((row.amount / stats.spent) * 100)}%` }} /></i></li>)}</ul>}
    {!stats.moves.length && <p className="bf-helper">{stats.dayIndex ? t("Nimic notat încă. Ce notezi acum intră în bugetul vacanței.") : t("Din prima zi, ce notezi intră în bugetul vacanței.")}</p>}
    <div className="bf-trip-actions">
      {!stats.done && stats.dayIndex > 0 && <button type="button" className="bf-primary" onClick={() => window.dispatchEvent(new Event("buget-familie:open-expense"))}><Plus size={17} aria-hidden="true" /> {t("Notează o cheltuială")}</button>}
      {!stats.done && <button type="button" className="bf-ghost" onClick={() => save({ ...trip, closedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })}>{t("Încheie vacanța")}</button>}
      {stats.done && <button type="button" className="bf-primary" onClick={() => setPlanning(true)}><Plane size={17} aria-hidden="true" /> {t("Plănuiește altă vacanță")}</button>}
    </div>
  </section>;
}
