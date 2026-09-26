/**
 * Mutare între sursele familiei: „am scos cash”, „am alimentat Revolut”, „am plătit cardul de
 * credit”. Două mișcări legate: soldurile se mută, cheltuielile și plicurile rămân la fel
 * (produs #2: înainte, retragerea de la ATM și apoi plata cash se numărau de două ori).
 */
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { amountError, isoToday, parseRomanianAmount, sourceBalance, sourceTransferPair, type AppData, type Transaction } from "@/lib/finance-data";
import { t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";

export function SourceTransferForm({ data, onSave, onBack }: { data: AppData; onSave: (pair: Transaction[]) => void; onBack: () => void }) {
  const sources = data.settings.paymentSources;
  const card = sources.find((item) => item.kind === "card") || sources[0];
  const cash = sources.find((item) => item.kind === "cash" && item.id !== card?.id) || sources.find((item) => item.id !== card?.id);
  const [fromId, setFromId] = useState(card?.id || "");
  const [toId, setToId] = useState(cash?.id || "");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const save = () => {
    const value = parseRomanianAmount(amount);
    if (!(value >= 0.01)) return setError(amountError(amount) || t("Introdu o sumă mai mare decât zero."));
    try {
      onSave(sourceTransferPair(data, { fromId, toId, amount: value, date: isoToday() }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Nu am putut salva mișcarea."));
    }
  };
  if (sources.length < 2) {
    return <div className="bf-source-transfer"><p>{t("Ai o singură sursă de bani. Adaugă cash sau alt card în Setări ca să poți muta bani între ele.")}</p><button type="button" className="bf-secondary" onClick={onBack}>{t("Înapoi")}</button></div>;
  }
  return (
    <div className="bf-source-transfer">
      <p className="bf-quick-entry-intro">{t("Nu e o cheltuială: banii trec dintr-un loc în altul. Plicurile și analiza rămân la fel.")}</p>
      <div className="bf-source-transfer-row">
        <label className="bf-field"><span>{t("Din")}</span><select value={fromId} onChange={(event) => setFromId(event.target.value)}>{sources.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <ArrowRight size={18} aria-hidden="true" />
        <label className="bf-field"><span>{t("În")}</span><select value={toId} onChange={(event) => setToId(event.target.value)}>{sources.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
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
