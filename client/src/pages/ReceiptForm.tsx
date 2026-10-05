/** Formularul de bon. Scos din home-secondary. */
import "../receipt-mobile.css";
import "../receipt-form-fix.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { expenseCategories, isoToday, matchingAllocationsForExpense, newId, parseRomanianAmount, receiptAttachCandidates, resolveReceiptLines, closeReceiptGap, type AppData, type Receipt } from "@/lib/finance-data";
import { Field, Modal, fmtExact } from "@/pages/home-kit";
import { t } from "@/lib/i18n";
import { RoDateInput } from "@/components/RoDateInput";
import { selfMemberIdOf } from "@/lib/member-identity";

const RECEIPT_DRAFT_KEY = "buget-familie:receipt-draft";
type ReceiptFormDraft = {
  vendor: string;
  amount: string;
  date: string;
  sourceId: string;
  memberId: string;
  note: string;
  lines: Array<{ id: string; category: string; amount: string; label: string }>;
};
function readReceiptDraft(): ReceiptFormDraft | undefined {
  try {
    const raw = sessionStorage.getItem(RECEIPT_DRAFT_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as ReceiptFormDraft;
    if (!parsed || typeof parsed.vendor !== "string") return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}
function writeReceiptDraft(draft: ReceiptFormDraft) {
  try { sessionStorage.setItem(RECEIPT_DRAFT_KEY, JSON.stringify(draft)); } catch { /* quota */ }
}
function clearReceiptDraft() {
  try { sessionStorage.removeItem(RECEIPT_DRAFT_KEY); } catch { /* ignore */ }
}

export function ReceiptForm({ data, onSave, onClose }: { data: AppData; onSave: (item: Receipt) => void | Promise<void>; onClose: () => void }) {
  const [draft] = useState(() => readReceiptDraft());
  const [vendor, setVendor] = useState(draft?.vendor ?? "");
  const [amount, setAmount] = useState(draft?.amount ?? "");
  const [date, setDate] = useState(draft?.date || isoToday());
  const [sourceId, setSourceId] = useState(draft?.sourceId || data.settings.paymentSources[0]?.id || "");
  const [memberId, setMemberId] = useState(draft?.memberId || selfMemberIdOf(data));
  const [note, setNote] = useState(draft?.note ?? "");
  const [lines, setLines] = useState<Array<{ id: string; category: string; amount: string; label: string }>>(draft?.lines?.length ? draft.lines : [{ id: newId("receipt-line"), category: "Alimente", amount: "", label: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lastSyncedTotal = useRef(draft?.amount ?? "");
  const categories = [...expenseCategories, ...data.settings.customCategories];
  const numericTotal = parseRomanianAmount(amount);
  const resolvedPreview = closeReceiptGap(resolveReceiptLines(lines, numericTotal), numericTotal);
  const lineTotal = resolvedPreview.lines.filter((line) => line.label !== "Rest bon").reduce((sum, line) => sum + line.amount, 0);
  const attachCandidates = useMemo(() => receiptAttachCandidates(data, vendor, numericTotal, date), [data, vendor, numericTotal, date]);
  const [attachId, setAttachId] = useState("new");
  useEffect(() => {
    const name = vendor.trim().toLocaleLowerCase("ro-RO");
    const strong = attachCandidates.find((item) => name && item.title.toLocaleLowerCase("ro-RO").includes(name) && numericTotal > 0 && Math.abs(item.amount - numericTotal) <= 1);
    setAttachId(strong?.id || "new");
  }, [attachCandidates, vendor, numericTotal]);

  useEffect(() => {
    setLines((current) => {
      if (current.length !== 1) return current;
      const lineAmount = current[0].amount.trim();
      if (lineAmount && lineAmount !== lastSyncedTotal.current) return current;
      lastSyncedTotal.current = amount;
      if (current[0].amount === amount) return current;
      return [{ ...current[0], amount }];
    });
  }, [amount]);

  useEffect(() => {
    const persist = () => writeReceiptDraft({ vendor, amount, date, sourceId, memberId, note, lines });
    persist();
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", persist);
    return () => {
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", persist);
    };
  }, [vendor, amount, date, sourceId, memberId, note, lines]);

  const updateLine = (id: string, patch: Partial<(typeof lines)[number]>) => setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
  const save = async () => {
    const numeric = parseRomanianAmount(amount);
    const normalizedLines = resolveReceiptLines(lines, numeric);
    const closed = closeReceiptGap(normalizedLines, numeric);
    if (!vendor.trim() || numeric <= 0 || !sourceId || !memberId) return setError(t("Completează magazinul, totalul, membrul și sursa. Fotografiile nu sunt obligatorii."));
    if (!closed.lines.length || closed.over) return setError(t("Repartizarea este {split}, dar totalul bonului este {total}. Corectează liniile înainte de salvare.", { split: fmtExact.format(normalizedLines.reduce((sum, line) => sum + line.amount, 0)), total: fmtExact.format(numeric) }));
    try {
      setBusy(true);
      setError("");
      const id = newId("receipt");
      await onSave({ id, vendor: vendor.trim(), amount: numeric, date, category: closed.lines[0].category, lines: closed.lines, sourceId, memberId, note: note.trim() || undefined, linkedTransactionId: attachId === "new" ? undefined : attachId });
      clearReceiptDraft();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Bonul nu a putut fi salvat pe telefon."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={t("Adaugă bon")} onClose={onClose}>
      <div className="bf-receipt-body">
        <div className="bf-receipt-intro">
          <p className="bf-kicker">{t("CUMPĂRĂTURI")}</p>
          <p>{t("Scrie magazinul și totalul, apoi apasă Salvează.")}</p>
        </div>
        <div className="bf-form-grid">
          <Field label={t("Magazin")}><input autoFocus value={vendor} onChange={(event) => setVendor(event.target.value)} placeholder="ex. Lidl" /></Field>
          <Field label={t("Total (lei)")}><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0,00" /></Field>
          <Field label={t("Data")}><RoDateInput value={date} onChange={(event) => setDate(event.target.value)} /></Field>
          <Field label={t("Membru")}><select value={memberId} onChange={(event) => setMemberId(event.target.value)}>{data.settings.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field>
          <Field label={t("Plătit din")}><select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>{data.settings.paymentSources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></Field>
        </div>
        {attachCandidates.length > 0 && (
          <section className="bf-receipt-split" aria-label={t("Unde intră bonul")}>
            <p className="bf-kicker">{t("UNDE INTRĂ BONUL")}</p>
            {attachCandidates.map((item) => (
              <label key={item.id} className="bf-split-line">
                <input type="radio" name="receipt-attach" checked={attachId === item.id} onChange={() => setAttachId(item.id)} />
                <span>{t("Detaliu pe {title} · {amount}. Nu se mai scrie o cheltuială.", { title: item.title, amount: fmtExact.format(item.amount) })}</span>
              </label>
            ))}
            <label className="bf-split-line">
              <input type="radio" name="receipt-attach" checked={attachId === "new"} onChange={() => setAttachId("new")} />
              <span>{t("Cheltuială nouă, un singur total. Produsele rămân detaliu.")}</span>
            </label>
          </section>
        )}
        <section className="bf-receipt-split">
          <div className="bf-split-heading">
            <div>
              <p className="bf-kicker">{t("PRODUSE ȘI CATEGORII")}</p>
              <h3>{fmtExact.format(lineTotal)} din {amount ? fmtExact.format(numericTotal) : "0,00 RON"}</h3>
            </div>
            <button type="button" className="bf-secondary" onClick={() => setLines((current) => {
              const next = [...current];
              if (next.length === 1 && !next[0].label.trim() && next[0].amount.trim() === amount.trim()) next[0] = { ...next[0], amount: "" };
              return [...next, { id: newId("receipt-line"), category: "Alimente", amount: "", label: "" }];
            })}><Plus size={16} /> {t("Produs")}</button>
          </div>
          {lines.map((line) => (
            <div className="bf-split-line" key={line.id}>
              <select aria-label={t("Categorie bon")} value={line.category} onChange={(event) => updateLine(line.id, { category: event.target.value })}>{categories.map((item) => <option key={item} value={item}>{t(item)}</option>)}</select>
              <input aria-label={t("Preț produs")} value={line.amount} onChange={(event) => updateLine(line.id, { amount: event.target.value })} inputMode="decimal" placeholder="lei" />
              <input aria-label={t("Produs")} value={line.label} onChange={(event) => updateLine(line.id, { label: event.target.value })} placeholder="ex. fructe" />
              {lines.length > 1 && <button type="button" aria-label={t("Elimină produsul")} onClick={() => setLines((current) => current.filter((entry) => entry.id !== line.id))}><Trash2 size={16} /></button>}
            </div>
          ))}
          <small>{t("Poți lăsa o diferență: ecotaxa sau un produs nenumit intră singur ca „Rest bon”. Nu salva doar dacă liniile trec peste total.")}</small>
          {resolvedPreview.remainder > 0.009 && <small>{t("Restul de {amount} intră pe bon ca diferență. Nu trebuie să-l împărți pe produse.", { amount: fmtExact.format(resolvedPreview.remainder) })}</small>}
          {resolvedPreview.lines.length > 0 && (
            <div className="bf-receipt-envelope-preview" aria-label={t("Plicuri propuse")}>
              <p className="bf-kicker">{t("PLICURI PROPUSE")}</p>
              <ul>
                {resolvedPreview.lines.map((line) => {
                  const matched = matchingAllocationsForExpense(data, { category: line.category, memberId, sourceId })[0];
                  return (
                    <li key={line.id}>
                      <b>{line.label === "Rest bon" ? t("Rest bon") : (line.label || t(line.category))}</b>
                      <span>{t(line.category)} → {matched ? matched.label : t("în afara plicurilor")}</span>
                    </li>
                  );
                })}
              </ul>
              <small>{t("La salvare, liniile intră la De verificat. Confirmă înainte să atingă registrul.")}</small>
            </div>
          )}
        </section>
        <Field label={t("Produse / notiță")}><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("ex. apă, fructe, detergent")} /></Field>
      </div>
      <div className="bf-receipt-save">
        {error && <p className="bf-form-error" role="alert">{error}</p>}
        <button type="button" className="bf-primary full" disabled={busy} onClick={() => void save()}><Check size={17} /> {t("Salvează bonul")}</button>
      </div>
    </Modal>
  );
}
