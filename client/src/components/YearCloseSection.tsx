/**
 * „Închide anul” în Setări (produs #8): în loc de „șterge mișcările din anii încheiați”,
 * anul trece într-o arhivă descărcată, iar în aplicație rămân rezumatul și soldurile.
 */
import { useState } from "react";
import { Archive, FolderOpen } from "lucide-react";
import { closableYears, closeYear, yearArchiveBlob, yearBlockedByCycle } from "@/lib/year-close";
import { foldRomanian, formatDate, type AppData, type Transaction } from "@/lib/finance-data";
import { askConfirm, showNotice } from "@/lib/confirm-dialog";
import { saveExport } from "@/lib/save-export";
import { t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";

/** Arhiva unui an închis, citită din fișier: doar pentru citit și căutat, nu intră în registru. */
function ArchiveViewer() {
  const [archive, setArchive] = useState<{ year: string; transactions: Transaction[] } | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const open = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { kind?: string; year?: string; transactions?: Transaction[] };
      if (parsed.kind !== "buget-familie-arhiva-an" || !Array.isArray(parsed.transactions)) throw new Error("kind");
      setArchive({ year: String(parsed.year || ""), transactions: parsed.transactions.filter((item) => item && typeof item.amount === "number") });
      setError("");
    } catch {
      setError(t("Fișierul nu e o arhivă de an Buget Familie."));
    }
  };
  const needle = foldRomanian(query.trim());
  const rows = archive ? archive.transactions.filter((item) => !needle || foldRomanian(`${item.title} ${item.category} ${t(item.category)} ${item.amount.toFixed(2).replace(".", ",")}`).includes(needle)).sort((a, b) => b.date.localeCompare(a.date)) : [];
  const out = rows.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0);
  return (
    <div className="bf-year-archive-viewer">
      <label className="bf-secondary bf-file-button"><FolderOpen size={16} aria-hidden="true" /> {t("Vezi o arhivă")}<input type="file" accept="application/json,.json" hidden onChange={(event) => void open(event.target.files?.[0])} /></label>
      {error && <p className="bf-form-error" role="alert">{error}</p>}
      {archive && <>
        <p className="bf-helper">{t("Arhiva {year}: {count} mișcări, doar pentru citit.", { year: archive.year, count: archive.transactions.length })}</p>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Caută în arhivă")} aria-label={t("Caută în arhivă")} />
        <p className="bf-helper">{t("{count} rezultate · ieșit {amount}", { count: rows.length, amount: lei(out) })}</p>
        <ul className="bf-year-close-list">
          {rows.slice(0, 200).map((item) => <li key={item.id}><b>{item.title}</b><span>{formatDate(item.date)} · {t(item.category)} · {item.kind === "income" ? "+" : "−"}{lei(item.amount)}</span></li>)}
        </ul>
      </>}
    </div>
  );
}

export function YearCloseSection({ data, onChange }: { data: AppData; onChange: (next: AppData) => void }) {
  const years = closableYears(data);
  const summaries = data.settings.yearSummaries || [];
  const blocked = yearBlockedByCycle(data);
  if (!years.length && !summaries.length && !blocked) return null;
  const close = async (year: string) => {
    const count = data.transactions.filter((item) => item.date <= `${year}-12-31`).length;
    if (!await askConfirm(t("Închizi anul {year}? Cele {count} mișcări se descarcă într-un fișier și ies din aplicație și din sincronizare, pe toate telefoanele. Soldurile rămân aceleași, iar în Setări rămâne rezumatul pe luni.", { year, count }))) return;
    const result = closeYear(data, year);
    if (!result.archive.length) return;
    try {
      await saveExport(`buget-familie-arhiva-${year}.json`, yearArchiveBlob(year, result.archive));
    } catch {
      await showNotice(t("Arhiva nu a putut fi salvată, așa că anul a rămas deschis. Încearcă din nou."));
      return;
    }
    onChange(result.data);
    await showNotice(t("Anul {year} e închis. Arhiva e în fișierul buget-familie-arhiva-{year}.json.", { year }));
  };
  return (
    <section className="bf-year-close" aria-labelledby="bf-year-close-title">
      <p className="bf-kicker">{t("ANII ÎNCHEIAȚI")}</p>
      <h2 id="bf-year-close-title">{t("Închide anul")}</h2>
      <p className="bf-helper">{t("Mișcările unui an încheiat trec într-un fișier de arhivă. Aplicația rămâne rapidă, iar sincronizarea nu se umple.")}</p>
      {blocked && !years.includes(blocked) && <p className="bf-helper">{t("Anul {year} se poate închide după ce începe primul ciclu de salariu din {next}: ciclul curent are încă mișcări din decembrie.", { year: blocked, next: String(Number(blocked) + 1) })}</p>}
      {years.map((year) => (
        <button key={year} type="button" className="bf-secondary" onClick={() => void close(year)}><Archive size={16} aria-hidden="true" /> {t("Închide anul {year}", { year })}</button>
      ))}
      {summaries.length > 0 && <ArchiveViewer />}
      {summaries.length > 0 && (
        <ul className="bf-year-close-list">
          {summaries.map((item) => (
            <li key={item.year}><b>{item.year}</b><span>{t("{count} mișcări · intrat {income} · ieșit {expense}", { count: item.count, income: lei(item.income), expense: lei(item.expense) })}</span></li>
          ))}
        </ul>
      )}
    </section>
  );
}
