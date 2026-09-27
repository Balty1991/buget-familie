/**
 * „Închide anul” în Setări (produs #8): în loc de „șterge mișcările din anii încheiați”,
 * anul trece într-o arhivă descărcată, iar în aplicație rămân rezumatul și soldurile.
 */
import { Archive } from "lucide-react";
import { closableYears, closeYear, yearArchiveBlob } from "@/lib/year-close";
import type { AppData } from "@/lib/finance-data";
import { askConfirm, showNotice } from "@/lib/confirm-dialog";
import { saveExport } from "@/lib/save-export";
import { t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";

export function YearCloseSection({ data, onChange }: { data: AppData; onChange: (next: AppData) => void }) {
  const years = closableYears(data);
  const summaries = data.settings.yearSummaries || [];
  if (!years.length && !summaries.length) return null;
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
      {years.map((year) => (
        <button key={year} type="button" className="bf-secondary" onClick={() => void close(year)}><Archive size={16} aria-hidden="true" /> {t("Închide anul {year}", { year })}</button>
      ))}
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
