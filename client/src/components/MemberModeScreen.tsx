/**
 * Ecranul unic pentru telefonul unui copil sau bunic: cifra lui de azi, notarea directă
 * (fără sursele și plicurile familiei) și ultimele lui mișcări. Ieșirea cere codul ales de
 * adult; după 5 greșeli, așteptarea crește.
 */
import "../monthly-needs.css";
import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { formatDate, isoToday, newId, parseRomanianAmount, type AppData, type Transaction } from "@/lib/finance-data";
import { genitiveName, memberModeWaitSeconds, memberToday, takePreviousSelf, verifyMemberModePin, writeMemberMode } from "@/lib/member-mode";
import { daysLabel, t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";

const JAR_EMOJI = ["🚲", "🎮", "⚽", "🎨", "📚", "🧸"];

export function MemberModeScreen({ data, memberId, onChange }: { data: AppData; memberId: string; onChange: (next: AppData) => void }) {
  const member = data.settings.members.find((item) => item.id === memberId);
  const name = member?.name || "";
  const figure = memberToday(data, memberId);
  const own = data.settings.salaryPlan.allocations.filter((item) => item.memberId === memberId);
  const recent = data.transactions.filter((item) => item.memberId === memberId).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 5);
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [envelopeId, setEnvelopeId] = useState(own[0]?.id || "");
  const [saved, setSaved] = useState<Transaction | null>(null);
  const [error, setError] = useState("");
  const [exiting, setExiting] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  // Pușculița copilului: un obiectiv de economisire pe numele lui, cu un emoji în față.
  const isChild = member?.kind === "child";
  const jar = data.savings.find((item) => item.memberId === memberId);
  const [jarForm, setJarForm] = useState(false);
  const [jarName, setJarName] = useState("");
  const [jarTarget, setJarTarget] = useState("");
  const [jarEmoji, setJarEmoji] = useState(JAR_EMOJI[0]);
  const createJar = () => {
    const target = parseRomanianAmount(jarTarget);
    if (!jarName.trim() || !(target > 0)) return setError(t("Scrie ce vrei și cât costă."));
    const goal = { id: newId("saving"), name: `${jarEmoji} ${jarName.trim()}`, current: 0, target, due: "", tone: "honey" as const, memberId, updatedAt: new Date().toISOString() };
    onChange({ ...data, savings: [...data.savings, goal] });
    setJarForm(false); setJarName(""); setJarTarget(""); setError("");
  };
  const putAside = (amount: number) => {
    if (!jar) return;
    onChange({ ...data, savings: data.savings.map((item) => item.id === jar.id ? { ...item, current: Math.round((item.current + amount) * 100) / 100, updatedAt: new Date().toISOString() } : item) });
  };

  const save = () => {
    const value = parseRomanianAmount(amount);
    if (!(value > 0)) return setError(t("Scrie suma."));
    const envelope = own.find((item) => item.id === envelopeId) || own[0];
    const source = data.settings.paymentSources.find((item) => item.id === envelope?.sourceId)
      || data.settings.paymentSources.find((item) => item.memberId === memberId && item.kind !== "meal")
      || data.settings.paymentSources.find((item) => item.kind === "cash")
      || data.settings.paymentSources[0];
    const now = new Date().toISOString();
    const entry: Transaction = { id: newId("tx"), title: title.trim() || envelope?.label || t("Cheltuială"), amount: value, kind: "expense", category: envelope?.category || "Altele", source: source?.name || "", sourceId: source?.id, person: name, memberId, date: isoToday(), allocationId: envelope?.id || "outside", shareScope: "shared", createdAt: now, updatedAt: now };
    onChange({ ...data, transactions: [entry, ...data.transactions] });
    setSaved(entry); setAdding(false); setAmount(""); setTitle(""); setError("");
  };
  const undo = () => {
    if (!saved) return;
    onChange({ ...data, transactions: data.transactions.filter((item) => item.id !== saved.id), deleted: [...data.deleted, { entity: "transactions" as const, id: saved.id, deletedAt: new Date().toISOString() }].slice(-2000) });
    setSaved(null);
  };
  const tryExit = async () => {
    const wait = memberModeWaitSeconds();
    if (wait > 0) return setPinError(t("Prea multe încercări. Mai așteaptă {seconds} secunde.", { seconds: wait }));
    if (!await verifyMemberModePin(pin)) { setPin(""); return setPinError(t("Cod greșit.")); }
    const previous = takePreviousSelf();
    window.dispatchEvent(new CustomEvent("buget-familie:local-settings", { detail: { selfMemberId: previous || undefined } }));
    writeMemberMode("");
  };

  return (
    <section className="bf-member-mode" aria-labelledby="bf-member-mode-title">
      <p className="bf-kicker">{t("TELEFONUL {name}", { name: genitiveName(name).toLocaleUpperCase("ro-RO") })}</p>
      {figure.own ? (
        <>
          <h1 id="bf-member-mode-title"><span>{t("Ai azi")}</span><strong>{lei(figure.today)}</strong></h1>
          <p className="bf-member-mode-note">
            {t("Din {labels}: mai sunt {left} în total.", { labels: figure.labels.join(", "), left: lei(figure.left || 0) })}
            {figure.days !== undefined && figure.days > 0 ? ` ${t("Banii noi vin peste {days}.", { days: daysLabel(figure.days) })}` : ""}
          </p>
        </>
      ) : (
        <>
          <h1 id="bf-member-mode-title"><span>{t("Bun venit, {name}!", { name })}</span></h1>
          <p className="bf-member-mode-note">{t("Încă nu ai un plic al tău. Roagă un adult să-ți facă unul în Plicuri (de exemplu „Bani de buzunar”). Până atunci poți nota ce cheltui.")}</p>
        </>
      )}

      {saved && (
        <p className="bf-member-mode-saved" role="status"><Check size={18} aria-hidden="true" /> {t("Notat: {title} · {amount}", { title: saved.title, amount: lei(saved.amount) })} <button type="button" onClick={undo}>{t("Anulează")}</button></p>
      )}

      {adding ? (
        <div className="bf-member-mode-form">
          <label><span>{t("Cât ai dat?")}</span><input autoFocus inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" /></label>
          <label><span>{t("Pe ce? (opțional)")}</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("ex. înghețată")} /></label>
          {own.length > 1 && (
            <div className="bf-member-mode-envelopes" role="group" aria-label={t("Din ce plic")}>
              {own.map((item) => <button type="button" key={item.id} className={envelopeId === item.id ? "active" : ""} aria-pressed={envelopeId === item.id} onClick={() => setEnvelopeId(item.id)}>{item.label}</button>)}
            </div>
          )}
          {error && <p className="bf-form-error" role="alert">{error}</p>}
          <div className="bf-member-mode-actions">
            <button type="button" className="bf-secondary" onClick={() => { setAdding(false); setError(""); }}>{t("Renunță")}</button>
            <button type="button" className="bf-primary" onClick={save}><Check size={20} aria-hidden="true" /> {t("Gata")}</button>
          </div>
        </div>
      ) : (
        <button type="button" className="bf-primary bf-member-mode-add" onClick={() => { setAdding(true); setSaved(null); }}><Plus size={26} aria-hidden="true" /> {t("Notează o cheltuială")}</button>
      )}

      {isChild && (jar ? (() => {
        const share = jar.target > 0 ? Math.min(1, jar.current / jar.target) : 0;
        const [emoji, ...rest] = jar.name.split(" ");
        const hasEmoji = JAR_EMOJI.includes(emoji) || /[\uD800-\uDBFF]/.test(emoji);
        return <section className={`bf-jar${share >= 1 ? " is-full" : ""}`} aria-label={t("Pușculița")}>
          <div className="bf-jar-glass" aria-hidden="true"><i style={{ height: `${Math.round(share * 100)}%` }} /><span>{hasEmoji ? emoji : "🐷"}</span></div>
          <div className="bf-jar-copy">
            <p className="bf-kicker">{t("PUȘCULIȚA")}</p>
            <h2>{hasEmoji ? rest.join(" ") : jar.name}</h2>
            <p>{share >= 1 ? t("Ai strâns tot! Spune-le alor tăi.") : t("Ai strâns {current} din {target}. Mai ai nevoie de {left}.", { current: lei(jar.current), target: lei(jar.target), left: lei(Math.max(0, jar.target - jar.current)) })}</p>
            {share < 1 && <div className="bf-jar-add" role="group" aria-label={t("Pun deoparte")}>{[5, 10, 20].map((value) => <button type="button" key={value} onClick={() => putAside(value)}>+{lei(value)}</button>)}</div>}
          </div>
        </section>;
      })() : jarForm ? (
        <section className="bf-jar-form bf-member-mode-form" aria-label={t("Pușculița nouă")}>
          <p className="bf-kicker">{t("PUȘCULIȚA NOUĂ")}</p>
          <div className="bf-jar-emoji" role="group" aria-label={t("Alege un desen")}>{JAR_EMOJI.map((item) => <button type="button" key={item} aria-pressed={jarEmoji === item} className={jarEmoji === item ? "active" : ""} onClick={() => setJarEmoji(item)}>{item}</button>)}</div>
          <label><span>{t("Ce vrei să-ți iei?")}</span><input value={jarName} onChange={(event) => setJarName(event.target.value)} placeholder={t("ex. o bicicletă")} /></label>
          <label><span>{t("Cât costă?")}</span><input inputMode="decimal" value={jarTarget} onChange={(event) => setJarTarget(event.target.value)} placeholder="300" /></label>
          {error && <p className="bf-form-error" role="alert">{error}</p>}
          <div className="bf-member-mode-actions"><button type="button" className="bf-secondary" onClick={() => { setJarForm(false); setError(""); }}>{t("Renunță")}</button><button type="button" className="bf-primary" onClick={createJar}><Check size={20} aria-hidden="true" /> {t("Gata")}</button></div>
        </section>
      ) : <button type="button" className="bf-jar-start" onClick={() => { setJarForm(true); setAdding(false); setError(""); }}><span aria-hidden="true">🐷</span> {t("Îmi fac o pușculiță")}</button>)}

      {recent.length > 0 && (
        <div className="bf-member-mode-recent">
          <h2>{t("Ultimele")}</h2>
          <ul>{recent.map((item) => <li key={item.id}><span>{item.title}<small>{formatDate(item.date, { day: "numeric", month: "long" })}</small></span><b>{item.kind === "expense" ? "−" : "+"}{lei(item.amount)}</b></li>)}</ul>
        </div>
      )}

      {exiting ? (
        <div className="bf-member-mode-exit-form">
          <label><span>{t("Codul adultului")}</span><input type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={pin} onChange={(event) => { setPin(event.target.value.replace(/\D/g, "").slice(0, 4)); setPinError(""); }} /></label>
          {pinError && <p className="bf-form-error" role="alert">{pinError}</p>}
          <div className="bf-member-mode-actions">
            <button type="button" className="bf-secondary" onClick={() => { setExiting(false); setPin(""); setPinError(""); }}>{t("Renunță")}</button>
            <button type="button" className="bf-primary" disabled={pin.length !== 4} onClick={() => void tryExit()}>{t("Ieși")}</button>
          </div>
        </div>
      ) : (
        <button type="button" className="bf-member-mode-exit" onClick={() => setExiting(true)}>{t("Ieși din modul acesta")}</button>
      )}
    </section>
  );
}
