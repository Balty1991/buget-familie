/** Formularul de bon. Scos din home-secondary. */
import "../receipt-mobile.css";
import "../receipt-form-fix.css";
import { useEffect, useRef, useState } from "react";
import { Bot, Camera, Check, Images, Plus, Trash2, X } from "lucide-react";
import { expenseCategories, isoToday, matchingAllocationsForExpense, newId, parseRomanianAmount, guessCategoryFromText, resolveReceiptLines, type AppData, type Receipt } from "@/lib/finance-data";
import { storeReceiptImages } from "@/lib/receipt-storage";
import { Field, Modal, fmtExact } from "@/pages/home-kit";
import { t } from "@/lib/i18n";

const RECEIPT_DRAFT_KEY = "buget-familie:receipt-draft";
type ReceiptFormDraft = {
  vendor: string;
  amount: string;
  date: string;
  sourceId: string;
  memberId: string;
  note: string;
  images: string[];
  lines: Array<{ id: string; category: string; amount: string; label: string }>;
  ocrText: string;
  ocrSummary: string;
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
  try {
    sessionStorage.setItem(RECEIPT_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    try { sessionStorage.setItem(RECEIPT_DRAFT_KEY, JSON.stringify({ ...draft, images: [] })); } catch { /* quota */ }
  }
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
  const [memberId, setMemberId] = useState(draft?.memberId || data.settings.members[0]?.id || "");
  const [note, setNote] = useState(draft?.note ?? "");
  const [images, setImages] = useState<string[]>(draft?.images ?? []);
  const [lines, setLines] = useState<Array<{ id: string; category: string; amount: string; label: string }>>(draft?.lines?.length ? draft.lines : [{ id: newId("receipt-line"), category: "Alimente", amount: "", label: "" }]);
  const [ocrText, setOcrText] = useState(draft?.ocrText ?? "");
  const [ocrSummary, setOcrSummary] = useState(draft?.ocrSummary ?? "");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const lastSyncedTotal = useRef(draft?.amount ?? "");
  const categories = [...expenseCategories, ...data.settings.customCategories];
  const numericTotal = parseRomanianAmount(amount);
  const resolvedPreview = resolveReceiptLines(lines, numericTotal);
  const lineTotal = resolvedPreview.reduce((sum, line) => sum + line.amount, 0);
  const photosFull = images.length >= 2;

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
    const persist = () => writeReceiptDraft({ vendor, amount, date, sourceId, memberId, note, images, lines, ocrText, ocrSummary });
    persist();
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", persist);
    return () => {
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", persist);
    };
  }, [vendor, amount, date, sourceId, memberId, note, images, lines, ocrText, ocrSummary]);

  const pick = async (files?: FileList | null) => {
    const selected = files ? Array.from(files) : [];
    if (!selected.length) return;
    const room = 2 - images.length;
    if (room <= 0) return setError(t("Un bon poate avea maximum două fotografii. Elimină una înainte de a adăuga alta."));
    const take = selected.slice(0, room);
    try {
      setBusy(true);
      setError("");
      const { compressReceiptImage } = await import("@/lib/receipt-utils");
      const compressed: string[] = [];
      for (const file of take) {
        compressed.push(await Promise.race([
          compressReceiptImage(file),
          new Promise<string>((_, reject) => window.setTimeout(() => reject(new Error(t("Poza a durat prea mult. Încearcă din galerie sau salvează bonul fără fotografie."))), 20000)),
        ]));
      }
      const next = [...images, ...compressed].slice(0, 2);
      setImages(next);
      await scanImages(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Poza bonului nu a putut fi procesată. Poți salva cumpărăturile fără fotografie."));
    } finally {
      setBusy(false);
    }
  };
  const scan = async () => { await scanImages(images); };
  const scanImages = async (photos: string[]) => {
    if (!photos.length) return;
    try {
      setBusy(true);
      setError("");
      setOcrSummary("");
      setProgress(0);
      const { readReceiptLocally, ocrTextLooksUseful, receiptReadIsReconciled } = await import("@/lib/receipt-utils");
      const result = await readReceiptLocally(photos, setProgress);
      setOcrText(result.text);
      if (result.vendor && !vendor.trim()) setVendor(result.vendor);
      if (result.amount) setAmount(String(result.amount).replace(".", ","));
      if (result.date) setDate(result.date);
      if (result.text && !note.trim() && ocrTextLooksUseful(result.text)) setNote(result.text.slice(0, 1400));
      if (result.items.length) {
        const suggestedLines = result.items.map((item) => {
          const ruled = guessCategoryFromText(item.label || item.raw || "", categories, data.settings.merchantRules || []);
          const category = ruled && categories.includes(ruled) ? ruled : categories.includes(item.category) ? item.category : "Alimente";
          return { id: newId("receipt-line"), category, amount: String(item.amount).replace(".", ","), label: item.label };
        });
        setLines(suggestedLines);
        const detectedTotal = result.items.reduce((sum, item) => sum + item.amount, 0);
        const who = result.vendor ? `${result.vendor}, ` : "";
        if (result.amount && !receiptReadIsReconciled(result)) {
          setOcrSummary(t("Am citit totalul {total} la {who}dar produsele însumează {sum}. Verifică liniile înainte de salvare.", { total: fmtExact.format(result.amount), who, sum: fmtExact.format(detectedTotal) }));
        } else {
          setOcrSummary(t("Am citit {who}{count} produs(e) după reduceri ({total}). Verifică categoriile înainte de salvare.", { who, count: result.items.length, total: fmtExact.format(detectedTotal) }));
        }
      } else if (result.amount) {
        setOcrSummary(t("Am citit totalul {total}{vendor}, dar produsele nu sunt sigure. Completează magazinul dacă lipsește — fotografia rămâne atașată.", { total: fmtExact.format(result.amount), vendor: result.vendor ? ` la ${result.vendor}` : "" }));
      } else {
        setOcrSummary(t("Nu am citit clar textul de pe bon. Scrie magazinul și totalul; fotografia rămâne atașată și poți salva fără produse separate."));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Textul de pe bon nu a putut fi citit."));
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };
  const updateLine = (id: string, patch: Partial<(typeof lines)[number]>) => setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
  const save = async () => {
    const numeric = parseRomanianAmount(amount);
    const normalizedLines = resolveReceiptLines(lines, numeric);
    const splitTotal = normalizedLines.reduce((sum, line) => sum + line.amount, 0);
    if (!vendor.trim() || numeric <= 0 || !sourceId || !memberId) return setError(t("Completează magazinul, totalul, membrul și sursa. Fotografiile nu sunt obligatorii."));
    if (!normalizedLines.length || Math.abs(numeric - splitTotal) > 0.01) return setError(t("Repartizarea este {split}, dar totalul bonului este {total}. Corectează liniile înainte de salvare.", { split: fmtExact.format(splitTotal), total: fmtExact.format(numeric) }));
    try {
      setBusy(true);
      setError("");
      const id = newId("receipt");
      const imageKeys = images.length ? await storeReceiptImages(id, images) : [];
      await onSave({ id, vendor: vendor.trim(), amount: numeric, date, category: normalizedLines[0].category, lines: normalizedLines, sourceId, memberId, note: note.trim() || undefined, imageKeys: imageKeys.length ? imageKeys : undefined, ocrText: ocrText || undefined });
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
          <p>{t("Scrie magazinul și totalul, apoi apasă Salvează. Pozele sunt opționale: din galerie sau cu aparatul foto.")}</p>
        </div>
        <div className="bf-form-grid">
          <Field label={t("Magazin")}><input autoFocus value={vendor} onChange={(event) => setVendor(event.target.value)} placeholder="ex. Lidl" /></Field>
          <Field label={t("Total (lei)")}><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0,00" /></Field>
          <Field label={t("Data")}><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
          <Field label={t("Membru")}><select value={memberId} onChange={(event) => setMemberId(event.target.value)}>{data.settings.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field>
          <Field label={t("Plătit din")}><select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>{data.settings.paymentSources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></Field>
        </div>
        <section className="bf-receipt-split">
          <div className="bf-split-heading">
            <div>
              <p className="bf-kicker">{t("PRODUSE ȘI CATEGORII")}</p>
              <h3>{fmtExact.format(lineTotal)} din {amount ? fmtExact.format(numericTotal) : "0,00 RON"}</h3>
            </div>
            <button type="button" className="bf-secondary" onClick={() => setLines((current) => [...current, { id: newId("receipt-line"), category: "Alimente", amount: "", label: "" }])}><Plus size={16} /> {t("Produs")}</button>
          </div>
          {lines.map((line) => (
            <div className="bf-split-line" key={line.id}>
              <select aria-label={t("Categorie bon")} value={line.category} onChange={(event) => updateLine(line.id, { category: event.target.value })}>{categories.map((item) => <option key={item} value={item}>{t(item)}</option>)}</select>
              <input aria-label={t("Preț produs")} value={line.amount} onChange={(event) => updateLine(line.id, { amount: event.target.value })} inputMode="decimal" placeholder="lei" />
              <input aria-label={t("Produs")} value={line.label} onChange={(event) => updateLine(line.id, { label: event.target.value })} placeholder="ex. fructe" />
              {lines.length > 1 && <button type="button" aria-label={t("Elimină produsul")} onClick={() => setLines((current) => current.filter((entry) => entry.id !== line.id))}><Trash2 size={16} /></button>}
            </div>
          ))}
          <small>{t("Dacă lași un singur produs gol, totalul se pune automat pe el. Mai multe linii trebuie să însumeze exact totalul bonului.")}</small>
          {resolvedPreview.length > 0 && (
            <div className="bf-receipt-envelope-preview" aria-label={t("Plicuri propuse")}>
              <p className="bf-kicker">{t("PLICURI PROPUSE")}</p>
              <ul>
                {resolvedPreview.map((line) => {
                  const matched = matchingAllocationsForExpense(data, { category: line.category, memberId, sourceId })[0];
                  return (
                    <li key={line.id}>
                      <b>{line.label || t(line.category)}</b>
                      <span>{t(line.category)} → {matched ? matched.label : t("în afara plicurilor")}</span>
                    </li>
                  );
                })}
              </ul>
              <small>{t("La salvare, liniile intră la De verificat. Confirmă înainte să atingă registrul.")}</small>
            </div>
          )}
        </section>
        <section className="bf-receipt-images">
          <div>
            <p className="bf-kicker">{t("FOTOGRAFII OPȚIONALE")}</p>
            <strong>{images.length}/2 imagini</strong>
          </div>
          <p className="bf-receipt-photo-hint">{t("Pozele rămân pe telefon. După ce adaugi o fotografie, citesc magazinul, produsele și totalul. Poți corecta înainte să salvezi.")}</p>
          <div className="bf-receipt-photo-actions">
            <label className="bf-upload-control gallery">
              <Images size={18} /> {busy && !progress ? t("Comprimăm…") : t("Din galerie")}
              <input type="file" accept="image/*" multiple disabled={busy || photosFull} onChange={(event) => { void pick(event.target.files); event.currentTarget.value = ""; }} />
            </label>
            <label className="bf-upload-control camera">
              <Camera size={18} /> {t("Fotografiază")}
              <input type="file" accept="image/*" capture="environment" disabled={busy || photosFull} onChange={(event) => { void pick(event.target.files); event.currentTarget.value = ""; }} />
            </label>
          </div>
          {images.length > 0 && <button type="button" className="bf-ocr-button" disabled={busy} onClick={() => void scan()}><Bot size={17} /> {busy && progress ? `Citim ${progress}%` : t("Citește produsele și prețurile local")}</button>}
          <div className="bf-receipt-preview-grid">{images.map((image, index) => <figure key={`${index}-${image.slice(-24)}`}><img src={image} alt={`Previzualizare bon partea ${index + 1}`} width={280} height={140} loading="lazy" decoding="async" /><button type="button" aria-label={`Elimină fotografia ${index + 1}`} onClick={() => setImages((current) => current.filter((_, imageIndex) => imageIndex !== index))}><X size={15} /></button></figure>)}</div>
          {ocrSummary && <p className="bf-ocr-info" role="status"><Bot size={16} /> {ocrSummary}</p>}
        </section>
        {ocrText ? <Field label={t("Text citit local (verifică înainte de salvare)")}><textarea value={note} onChange={(event) => setNote(event.target.value)} /></Field> : <Field label={t("Produse / notiță")}><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("ex. apă, fructe, detergent")} /></Field>}
      </div>
      <div className="bf-receipt-save">
        {error && <p className="bf-form-error" role="alert">{error}</p>}
        <button type="button" className="bf-primary full" disabled={busy} onClick={() => void save()}><Check size={17} /> {t("Salvează bonul")}</button>
      </div>
    </Modal>
  );
}
