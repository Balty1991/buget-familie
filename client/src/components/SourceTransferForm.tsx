/**
 * Mutare între sursele familiei: „am scos cash”, „am alimentat Revolut”, „am plătit cardul de
 * credit”. Două mișcări legate: soldurile se mută, cheltuielile și plicurile rămân la fel
 * (produs #2: înainte, retragerea de la ATM și apoi plata cash se numărau de două ori).
 */
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { amountError, isoToday, newId, parseRomanianAmount, sourceBalance, sourceTransferPair, type AppData, type PaymentSource, type Transaction } from "@/lib/finance-data";
import { t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";

/** Destinație „Cash {nume} (nou)”, pentru un membru fără sursă: o facem la salvare. */
const NEW_FOR = "new-for:";

export function SourceTransferForm({ data, onSave, onBack, onAddSource }: { data: AppData; onSave: (pair: Transaction[]) => void; onBack: () => void; onAddSource?: (source: PaymentSource) => void }) {
  const sources = data.settings.paymentSources;
  const members = data.settings.members;
  const ownerName = (source: PaymentSource) => members.find((member) => member.id === source.memberId)?.name;
  const label = (source: PaymentSource) => { const owner = ownerName(source); return owner && !source.name.includes(owner) ? `${source.name} · ${owner}` : source.name; };
  // Cine n-are încă o sursă a lui (de exemplu soția) poate primi bani: îi facem „Cash {nume}”.
  const newFor = onAddSource ? members.filter((member) => member.kind !== "child" && !sources.some((source) => source.memberId === member.id)) : [];
  const fullest = [...sources].sort((a, b) => sourceBalance(data, b.id) - sourceBalance(data, a.id))[0];
  const other = sources.find((item) => item.id !== fullest?.id && item.memberId && item.memberId !== fullest?.memberId);
  const [fromId, setFromId] = useState(fullest?.id || "");
  const [toId, setToId] = useState(other?.id || (newFor[0] ? `${NEW_FOR}${newFor[0].id}` : sources.find((item) => item.id !== fullest?.id)?.id || ""));
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const save = () => {
    const value = parseRomanianAmount(amount);
    if (!(value >= 0.01)) return setError(amountError(amount) || t("Introdu o sumă mai mare decât zero."));
    try {
      let target = data;
      let destination = toId;
      if (toId.startsWith(NEW_FOR)) {
        const member = members.find((item) => item.id === toId.slice(NEW_FOR.length));
        if (!member || !onAddSource) return setError(t("Alege două surse diferite."));
        const source: PaymentSource = { id: newId("source"), name: t("Cash {name}", { name: member.name }), kind: "cash", memberId: member.id, openingBalance: 0, updatedAt: new Date().toISOString() };
        target = { ...data, settings: { ...data.settings, paymentSources: [...sources, source] } };
        destination = source.id;
        const pair = sourceTransferPair(target, { fromId, toId: destination, amount: value, date: isoToday() });
        onAddSource(source);
        onSave(pair);
        return;
      }
      onSave(sourceTransferPair(target, { fromId, toId: destination, amount: value, date: isoToday() }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Nu am putut salva mișcarea."));
    }
  };
  if (sources.length + newFor.length < 2) {
    return <div className="bf-source-transfer"><p>{t("Ai o singură sursă de bani. Adaugă cash sau alt card în Setări ca să poți muta bani între ele.")}</p><button type="button" className="bf-secondary" onClick={onBack}>{t("Înapoi")}</button></div>;
  }
  return (
    <div className="bf-source-transfer">
      <p className="bf-quick-entry-intro">{t("Nu e o cheltuială: banii trec dintr-un loc în altul, sau la alt membru (de exemplu, dai bani soției). Plicurile și analiza rămân la fel.")}</p>
      <div className="bf-source-transfer-row">
        <label className="bf-field"><span>{t("Din")}</span><select value={fromId} onChange={(event) => setFromId(event.target.value)}>{sources.map((item) => <option key={item.id} value={item.id}>{label(item)} · {lei(sourceBalance(data, item.id))}</option>)}</select></label>
        <ArrowRight size={18} aria-hidden="true" />
        <label className="bf-field"><span>{t("În")}</span><select value={toId} onChange={(event) => setToId(event.target.value)}>{sources.map((item) => <option key={item.id} value={item.id}>{label(item)}</option>)}{newFor.map((member) => <option key={member.id} value={`${NEW_FOR}${member.id}`}>{t("Cash {name} (nou)", { name: member.name })}</option>)}</select></label>
      </div>
      <p className="bf-helper">{t("Pe {name} sunt acum {amount}.", { name: sources.find((item) => item.id === fromId)?.name || "", amount: lei(sourceBalance(data, fromId)) })}</p>
      <label className="bf-field bf-amount-field"><span>{t("Sumă ({currency})", { currency: t("lei") })}</span><input autoFocus inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); setError(""); }} placeholder="0" /></label>
      {error && <p className="bf-form-error" role="alert">{error}</p>}
      <div className="bf-source-transfer-actions">
        <button type="button" className="bf-secondary" onClick={onBack}>{t("Înapoi")}</button>
        <button type="button" className="bf-primary" onClick={save}><Check size={17} /> {t("Mută banii")}</button>
      </div>
    </div>
  );
}
