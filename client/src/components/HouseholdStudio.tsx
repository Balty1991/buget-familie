/**
 * Gospodărie: recapitulare lunară, vârstă a banilor, el și ea, vânător de abonamente.
 * Confirmarea unei detecții creează o scadență în registrul deja sincronizat.
 */
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarCheck, Download, PiggyBank, Repeat, Shield, Users } from "lucide-react";
import { autoPostDueRecurring, formatDate, type AppData } from "@/lib/finance-data";
import { CashNote } from "@/components/LedgerArt";
import { downloadMonthlyBalancePdf } from "@/lib/monthly-balance-pdf";
import { ageOfMoney, closeMonthLocally, currentMonthKey, detectSubscriptions, householdActivity, liquidSafeToSpend, monthlyRecap, readClosedMonths, recurringFromDetection } from "@/lib/household-insights";

const money = (value: number) => new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);

export function HouseholdStudio({ data, onChange }: { data: AppData; onChange: (next: AppData) => void }) {
  const month = currentMonthKey();
  const recap = useMemo(() => monthlyRecap(data, month), [data, month]);
  const age = useMemo(() => ageOfMoney(data), [data]);
  const activity = useMemo(() => householdActivity(data, month), [data, month]);
  const hunts = useMemo(() => detectSubscriptions(data), [data]);
  const safe = useMemo(() => liquidSafeToSpend(data), [data]);
  const [closed, setClosed] = useState(() => readClosedMonths());
  const [exporting, setExporting] = useState(false);
  const closedThis = closed[month];
  const collaborative = data.settings.members.length > 1;
  const addRecurring = (key: string) => {
    const hit = hunts.find((item) => item.key === key);
    if (!hit) return;
    const draft = recurringFromDetection(data, hit);
    if (!draft) return;
    onChange(autoPostDueRecurring({ ...data, recurring: [...data.recurring, draft] }));
  };
  const close = async () => {
    setExporting(true);
    try {
      await downloadMonthlyBalancePdf(data, month);
      setClosed((current) => ({ ...current, [month]: closeMonthLocally(recap) }));
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="bf-household">
      <section className={`bf-household-recap bf-statement ${recap.tone}`}>
        <div>
          <p className="bf-kicker">RITUALUL LUNII</p>
          <h2>{recap.title}</h2>
          <p>{recap.nextStep}</p>
        </div>
        {closedThis && <span className="bf-statement-stamp">Închis</span>}
        <div className="bf-household-flow">
          <article><small>Venituri</small><b>{money(recap.income)}</b><em>{recap.priorIncome ? `${recap.income - recap.priorIncome >= 0 ? "+" : ""}${money(recap.income - recap.priorIncome)} vs luna trecută` : "prima lună cu date"}</em></article>
          <article><small>Cheltuieli</small><b>{money(recap.expense)}</b><em>{recap.topCategory ? `${recap.topCategory.name} ${money(recap.topCategory.amount)}` : "fără categorie dominantă"}</em></article>
          <article><small>Bilanț</small><b className={recap.cashflow < 0 ? "negative" : ""}>{money(recap.cashflow)}</b><em>{recap.envelopesOver ? `${recap.envelopesOver} plicuri depășite` : recap.envelopesWatch ? `${recap.envelopesWatch} plicuri de urmărit` : "plicuri în ritm"}</em></article>
        </div>
        <div className="bf-household-actions">
          <button className="bf-primary" disabled={exporting} onClick={() => void close()}>
            <CalendarCheck size={16} /> {closedThis ? "Reînchide și descarcă PDF" : exporting ? "Generăm PDF-ul…" : "Închide luna · PDF local"}
          </button>
          {closedThis && <small>Închisă local pe {formatDate(closedThis.closedAt.slice(0, 10), { day: "2-digit", month: "long" })}. Marcajul rămâne pe acest telefon.</small>}
        </div>
      </section>

      <section className="bf-household-card">
        <div className="bf-household-heading">
          <div><p className="bf-kicker">VÂRSTA BANILOR</p><h2>Cât stă un leu înainte să plece</h2></div>
          <PiggyBank size={18} />
        </div>
        {age ? (
          <div className="bf-household-age">
            <CashNote amount={age.days < 1 ? "sub o zi" : `${age.days} zile`} caption="Vârsta medie a leului" />
            <p>Media ponderată pe {money(age.sampleAmount)} cheltuiți. {age.unfundedAmount > 0 ? `${money(age.unfundedAmount)} nu au avut încă un venit pereche — completează soldul inițial.` : "Fiecare leu cheltuit a avut o încasare în spate."}</p>
          </div>
        ) : <p className="bf-helper">După primul venit și prima cheltuială, aici vei vedea cât de „proaspeți” sunt banii.</p>}
        <div className="bf-household-safe">
          <span><small>Lichid acum</small><b>{money(safe.liquidFunds)}</b></span>
          <span><small>Rezervat scadențe</small><b>{money(safe.reservedRecurring)}</b></span>
          <span><small>Disponibil prudent</small><b>{money(safe.available)}</b></span>
        </div>
      </section>

      {collaborative && (
        <section className="bf-household-card">
          <div className="bf-household-heading">
            <div><p className="bf-kicker">EL ȘI EA · GOSPODĂRIA</p><h2>Cine a mișcat banii luna aceasta</h2></div>
            <Users size={18} />
          </div>
          <div className="bf-household-members">
            {activity.members.map((member) => (
              <article key={member.memberId}>
                <header><b>{member.name}</b><small>{member.count} mișcări</small></header>
                <div><span>Cheltuit</span><strong>{money(member.expense)}</strong></div>
                <div><span>Încasat</span><strong>{money(member.income)}</strong></div>
                <i><em style={{ width: `${Math.round(member.share * 100)}%` }} /></i>
                <small>{Math.round(member.share * 100)}% din cheltuielile casei</small>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="bf-household-card">
        <div className="bf-household-heading">
          <div><p className="bf-kicker">VÂNĂTOR DE ABONAMENTE</p><h2>Ce se repetă, fără să fie încă o scadență</h2></div>
          <Repeat size={18} />
        </div>
        {hunts.length ? hunts.map((item) => (
          <article className="bf-household-hunt" key={item.key}>
            <div>
              <b>{item.name}</b>
              <small>{item.reason} · ultima dată {formatDate(item.lastDate)}</small>
            </div>
            <strong>{money(item.amount)}</strong>
            <button type="button" onClick={() => addRecurring(item.key)}>Adaugă la scadențe</button>
          </article>
        )) : <p className="bf-helper">Nu am găsit comercianți cu sumă stabilă. După 2–3 luni de registru, Netflix, chiria sau factura de telefon apar aici.</p>}
      </section>

      <section className="bf-household-card">
        <div className="bf-household-heading">
          <div><p className="bf-kicker">ACTIVITATE RECENTĂ</p><h2>Ultimele mișcări ale casei</h2></div>
          <Shield size={18} />
        </div>
        {activity.recent.length ? (
          <div className="bf-household-feed">
            {activity.recent.map((item) => (
              <article key={item.id}>
                <span className={item.kind}>{item.kind === "income" ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />}</span>
                <div><b>{item.title}</b><small>{formatDate(item.date)} · {item.person} · {item.category}</small></div>
                <strong className={item.kind}>{item.kind === "income" ? "+" : "−"}{money(item.amount)}</strong>
              </article>
            ))}
          </div>
        ) : <p className="bf-helper">Activitatea casei apare aici după prima înregistrare.</p>}
        <p className="bf-helper">Feed-ul se calculează din registrul deja sincronizat. Nu creăm un jurnal separat pe server.</p>
      </section>

      <button className="bf-household-pdf" type="button" disabled={exporting} onClick={() => void downloadMonthlyBalancePdf(data, month)}>
        <Download size={16} /> Descarcă bilanțul lunii, fără a o închide
      </button>
    </div>
  );
}
