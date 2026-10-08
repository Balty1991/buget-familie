import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, History, RotateCcw } from "lucide-react";
import { formatDate, newId, type AppData, type Transaction } from "@/lib/finance-data";
import { brokenSplits, isSplitPartner } from "@/lib/split-payment";
import { forgetRemoved, readRemovedBin, repairSplit, restoreRemoved } from "@/lib/removed-bin";
import { askConfirm } from "@/lib/confirm-dialog";
import { t } from "@/lib/i18n";
import { fmtExact, Modal } from "@/pages/home-kit";

const money = (value: number) => fmtExact.format(value);

/**
 * Siguranța registrului, în Mișcări:
 * - bonul plătit din două surse din care a rămas o singură parte apare cu roșu, cu „Repară”;
 * - „Șterse recent” arată tot ce a dispărut în ultimele 60 de zile, cu „Pune înapoi”.
 */
export function LedgerSafety({ data, onChange, onEdit }: { data: AppData; onChange: (next: AppData) => void; onEdit: (item: Transaction) => void }) {
  const [binVersion, setBinVersion] = useState(0);
  const [binOpen, setBinOpen] = useState(false);
  useEffect(() => {
    const refresh = () => setBinVersion((value) => value + 1);
    window.addEventListener("buget-familie:removed-bin", refresh);
    return () => window.removeEventListener("buget-familie:removed-bin", refresh);
  }, []);
  const broken = useMemo(() => brokenSplits(data.transactions), [data.transactions]);
  // binVersion reîncarcă lista când se schimbă coșul.
  const bin = useMemo(() => readRemovedBin().filter((entry) => entry.entity === "receipts" ? !data.receipts.some((item) => item.id === entry.row.id) : !data.transactions.some((item) => item.id === entry.row.id)).reverse(), [binVersion, data.transactions, data.receipts]);

  const repair = (item: (typeof broken)[number]) => {
    const fixed = repairSplit(data, item, isSplitPartner, () => newId("tx"));
    if (fixed) onChange(fixed);
    else onEdit(item.kept);
  };
  const restore = async (key: string, label: string) => {
    if (!await askConfirm(t("Pui înapoi „{label}” în registru?", { label }), { confirmLabel: t("Pune înapoi") })) return;
    onChange(restoreRemoved(data, [key]));
  };

  return <>
    {broken.length > 0 && <section className="bf-envelope-conflicts bf-movement-conflicts" aria-live="polite">
      <div className="bf-envelope-conflicts-heading">
        <AlertTriangle size={18} aria-hidden="true" />
        <div>
          <p className="bf-kicker">{t("BON INCOMPLET")}</p>
          <h2>{t("Un bon plătit din două surse are doar o parte în registru")}</h2>
          <p>{t("Suma rămasă nu dă totalul bonului, iar soldurile surselor nu mai sunt corecte.")}</p>
        </div>
      </div>
      <ul className="bf-envelope-conflicts-list">
        {broken.map((item) => <li key={item.kept.id}>
          <div>
            <b>{item.kept.title} · {formatDate(item.kept.date, { day: "numeric", month: "long" })}</b>
            <small>{t("Bon de {total}, în registru {kept}. Lipsesc {missing}{source}.", { total: money(item.total), kept: money(item.total - item.missing), missing: money(item.missing), source: item.missingSource ? ` ${t("din {source}", { source: item.missingSource })}` : "" })}</small>
          </div>
          <div className="bf-envelope-conflicts-actions">
            <button type="button" className="bf-primary" onClick={() => repair(item)}>{t("Repară")}</button>
            <button type="button" className="bf-secondary" onClick={() => onEdit(item.kept)}>{t("Deschide")}</button>
          </div>
        </li>)}
      </ul>
    </section>}
    {bin.length > 0 && <button type="button" className="bf-link-button" onClick={() => setBinOpen(true)}><History size={15} aria-hidden="true" /> {t("Șterse recent ({count})", { count: bin.length })}</button>}
    {binOpen && <Modal title={t("Șterse recent")} onClose={() => setBinOpen(false)}>
      <p className="bf-helper">{t("Tot ce a ieșit din registru în ultimele 60 de zile, pe telefonul acesta: șters de tine, la o corectură sau la sincronizare. Pune înapoi ce nu trebuia să plece.")}</p>
      <ul className="bf-envelope-conflicts-list">
        {bin.map((entry) => {
          const label = entry.entity === "transactions" ? entry.row.title : t("Bon {vendor}", { vendor: entry.row.vendor });
          const amount = entry.row.amount;
          const detail = entry.entity === "transactions"
            ? `${money(amount)} · ${entry.row.source} · ${formatDate(entry.row.date, { day: "numeric", month: "short" })}`
            : `${money(amount)} · ${t("{count} articole", { count: entry.row.lines?.length || 0 })}`;
          return <li key={entry.key}>
            <div><b>{label}</b><small>{detail} · {t("scos {when}", { when: new Date(entry.removedAt).toLocaleString("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) })}</small></div>
            <div className="bf-envelope-conflicts-actions">
              <button type="button" className="bf-secondary" onClick={() => void restore(entry.key, label)}><RotateCcw size={15} aria-hidden="true" /> {t("Pune înapoi")}</button>
            </div>
          </li>;
        })}
      </ul>
      <button type="button" className="bf-link-button" onClick={() => { forgetRemoved(bin.map((entry) => entry.key)); setBinOpen(false); }}>{t("Golește lista")}</button>
    </Modal>}
  </>;
}
