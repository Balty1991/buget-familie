/**
 * Centrul de revizuire: singurul loc prin care intră în registru mișcările propuse
 * de import, bon sau asistent. Nimic de aici nu atinge soldurile, plicurile sau
 * prognozele până când utilizatorul apasă „Confirmă”.
 */
import { useMemo, useRef, useState } from "react";
import { Check, FileUp, Inbox, Pencil, ShieldCheck, Trash2, X } from "lucide-react";
import {
  addReviewDrafts,
  confirmAllReviewDrafts,
  confirmReviewDraft,
  dismissReviewDraft,
  expenseCategories,
  matchingAllocationsForExpense,
  updateReviewDraft,
  type AppData,
  type ReviewDraft,
  type ReviewOrigin,
  type ShareScope,
  transactionShareScope,
} from "@/lib/finance-data";
import { parseStatementCsv, statementDrafts, STATEMENT_BANK_LABELS, type StatementBank, type StatementSkip } from "@/lib/statement-import";
import { Field, dateText, fmtExact } from "@/pages/home-kit";
import { t } from "@/lib/i18n";

const originLabel: Record<ReviewOrigin, string> = {
  import: "Extras de cont",
  bon: "Bon fotografiat",
  asistent: "Ghid AI",
  notificare: t("Notificare bancară"),
};

type ImportSummary = { added: number; duplicates: number; skipped: StatementSkip[]; fileName: string; bank: StatementBank; rowCount: number };

export function ReviewCenterPanel({ data, onChange }: { data: AppData; onChange: (value: AppData) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [sourceId, setSourceId] = useState(data.settings.paymentSources[0]?.id || "");
  const [memberId, setMemberId] = useState(data.settings.members[0]?.id || "");
  const [summary, setSummary] = useState<ImportSummary>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState("");

  const categories = useMemo(() => [...expenseCategories, ...data.settings.customCategories], [data.settings.customCategories]);
  const drafts = data.pendingReview;
  const total = drafts.reduce((sum, item) => sum + (item.transaction.kind === "expense" ? item.transaction.amount : 0), 0);

  const readFile = async (file: File) => {
    setBusy(true);
    setError("");
    setSummary(undefined);
    try {
      const text = await file.text();
      const parsed = parseStatementCsv(text);
      const { drafts: fresh, duplicates } = statementDrafts(data, parsed.rows, { sourceId, memberId, fileName: file.name });
      if (fresh.length) onChange(addReviewDrafts(data, fresh));
      setSummary({ added: fresh.length, duplicates, skipped: parsed.skipped, fileName: file.name, bank: parsed.bank, rowCount: parsed.rows.length });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Fișierul nu a putut fi citit."));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const patch = (draft: ReviewDraft, change: Partial<ReviewDraft["transaction"]>) => onChange(updateReviewDraft(data, draft.id, change));

  return (
    <div className="bf-review-workspace">
      <section className="bf-review-import" aria-labelledby="review-import-title">
        <div className="bf-section-heading">
          <div>
            <p className="bf-kicker">{t("IMPORT DE EXTRAS")}</p>
            <h2 id="review-import-title">{t("Adu mișcările din bancă")}</h2>
          </div>
          <FileUp size={19} />
        </div>
        <p className="bf-review-intro">{t("Alege fișierul CSV exportat din aplicația băncii. Este citit pe telefon, nu se trimite nicăieri, iar fiecare rând ajunge aici ca propunere de confirmat. Mișcările deja existente sunt recunoscute și nu se dublează.")}</p>
        <p className="bf-review-banks">{t("Formate verificate:")} <b>BCR · Banca Transilvania · ING · Revolut</b>. {t("Alte CSV-uri cu dată, descriere și sumă (sau debit/credit) sunt citite automat.")}</p>
        <div className="bf-form-grid">
          <Field label={t("În ce sursă intră")}>
            <select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
              {data.settings.paymentSources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
            </select>
          </Field>
          <Field label={t("Al cui este contul")}>
            <select value={memberId} onChange={(event) => setMemberId(event.target.value)}>
              {data.settings.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
          </Field>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="bf-visually-hidden"
          onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); }}
        />
        <button className="bf-primary full" disabled={busy || !sourceId || !memberId} onClick={() => fileRef.current?.click()}>
          <FileUp size={17} /> {busy ? t("Citim fișierul…") : t("Alege fișierul CSV")}
        </button>
        {error && <p className="bf-form-error" role="alert">{error}</p>}
        {summary && (
          <div className="bf-review-summary" role="status">
            <b>{summary.fileName}</b>
            <p>
              {STATEMENT_BANK_LABELS[summary.bank]} · {summary.rowCount} {t("rânduri citite")}
              {" · "}
              {summary.added ? t("{count} mișcări propuse", { count: summary.added }) : t("Nicio mișcare nouă")}
              {summary.duplicates ? ` · ${summary.duplicates} ${t("existau deja")}` : ""}
              {summary.skipped.length ? ` · ${summary.skipped.length} ${t("rânduri necitibile")}` : ""}
            </p>
            {summary.skipped.length > 0 && (
              <details>
                <summary>{t("Vezi rândurile sărite")}</summary>
                <ul>{summary.skipped.slice(0, 20).map((item) => <li key={item.line}>Rândul {item.line}: {item.reason}</li>)}</ul>
              </details>
            )}
          </div>
        )}
      </section>

      <section className="bf-review-queue" aria-labelledby="review-queue-title">
        <div className="bf-section-heading">
          <div>
            <p className="bf-kicker">{t("DE VERIFICAT")}</p>
            <h2 id="review-queue-title">{drafts.length ? `${drafts.length} propuneri` : "Nimic de verificat"}</h2>
          </div>
          <Inbox size={19} />
        </div>
        {drafts.length > 0 && (
          <div className="bf-review-actions">
            <p>{t("Total propus la cheltuieli:")} <strong>{fmtExact.format(total)}</strong></p>
            <button className="bf-primary" onClick={() => onChange(confirmAllReviewDrafts(data))}><Check size={15} /> {t("Confirmă toate")}</button>
          </div>
        )}
        {drafts.length ? (
          <div className="bf-review-list">
            {drafts.map((draft) => {
              const transaction = draft.transaction;
              const open = editing === draft.id;
              const envelopes = transaction.kind === "expense"
                ? matchingAllocationsForExpense(data, { category: transaction.category, memberId: transaction.memberId, sourceId: transaction.sourceId })
                : [];
              return (
                <article key={draft.id} className={transaction.kind === "income" ? "income" : ""}>
                  <header>
                    <div>
                      <b>{transaction.title}</b>
                      <small>{dateText(transaction.date)} · {originLabel[draft.origin]}</small>
                    </div>
                    <strong>{transaction.kind === "income" ? "+" : "−"}{fmtExact.format(transaction.amount)}</strong>
                  </header>
                  <p className="bf-review-reason">{draft.reason}</p>
                  {open && (
                    <div className="bf-form-grid">
                      <Field label="Denumire">
                        <input value={transaction.title} onChange={(event) => patch(draft, { title: event.target.value })} />
                      </Field>
                      <Field label="Data">
                        <input type="date" value={transaction.date} onChange={(event) => patch(draft, { date: event.target.value })} />
                      </Field>
                      {transaction.kind === "expense" && (
                        <Field label="Categorie">
                          <select value={transaction.category} onChange={(event) => patch(draft, { category: event.target.value, allocationId: undefined })}>
                            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                          </select>
                        </Field>
                      )}
                      <Field label={t("Perspectivă")}>
                        <select value={transactionShareScope(transaction)} onChange={(event) => patch(draft, { shareScope: event.target.value as ShareScope })}>
                          <option value="shared">{t("Comun (familie)")}</option>
                          <option value="personal">{t("Personal")}</option>
                        </select>
                      </Field>
                      {transaction.kind === "expense" && (
                        <Field label="Plic" hint={t("„În afara plicurilor” lasă cheltuiala fără să consume o limită.")}>
                          <select value={transaction.allocationId || "outside"} onChange={(event) => patch(draft, { allocationId: event.target.value })}>
                            <option value="outside">{t("În afara plicurilor")}</option>
                            {envelopes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                          </select>
                        </Field>
                      )}
                    </div>
                  )}
                  <footer>
                    <button onClick={() => setEditing(open ? "" : draft.id)} aria-expanded={open}>
                      <Pencil size={14} /> {open ? "Gata" : t("Editează")}
                    </button>
                    <button onClick={() => onChange(dismissReviewDraft(data, draft.id))}>
                      <Trash2 size={14} /> Ignoră
                    </button>
                    <button className="bf-primary" onClick={() => onChange(confirmReviewDraft(data, draft.id) || data)}>
                      <Check size={14} /> Confirmă
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="bf-empty-state slim">
            <X size={23} />
            <h2>{t("Coada este goală")}</h2>
            <p>{t("Aici ajung mișcările propuse din extrase de cont, bonuri sau ghid. Nimic nu intră în registru fără confirmarea ta.")}</p>
          </div>
        )}
        <p className="bf-review-privacy"><ShieldCheck size={14} /> {t("Fișierul importat este citit local. Propunerile rămân pe acest telefon până le confirmi.")}</p>
      </section>
    </div>
  );
}
