/**
 * Rubrica Bonuri: totalurile rămân în ghid / registru; aici se văd produsele
 * și alimente vs nealimentare. Articolele noi se caută în Catalog.
 */
import "../receipts-studio.css";
import { useMemo } from "react";
import { ReceiptText, Search } from "lucide-react";
import { isoToday, type AppData } from "@/lib/finance-data";
import { productSpendBreakdown } from "@/lib/product-catalog";
import { fmtExact, money } from "@/pages/home-kit";
import { t } from "@/lib/i18n";

type Props = {
  data: AppData;
  onAddReceipt: () => void;
};

export function ReceiptsStudio({ data, onAddReceipt }: Props) {
  const month = isoToday().slice(0, 7);
  const split = useMemo(() => productSpendBreakdown(data.receipts, month), [data.receipts, month]);
  const foodShare = split.total > 0 ? Math.round((split.food / split.total) * 100) : 0;
  const openCatalog = () => window.dispatchEvent(new CustomEvent("buget-familie:open-catalog"));

  return (
    <div className="bf-receipts-studio">
      <header className="bf-section-heading">
        <div>
          <p className="bf-kicker">{t("PRODUSE")}</p>
          <h2>{t("Unde se duc banii din bonuri")}</h2>
        </div>
        <ReceiptText size={18} />
      </header>
      <p className="bf-helper">{t("Ghidul trece doar totalul în registru. Articolele le cauți în Catalog — liste locale și online.")}</p>

      <div className="bf-receipts-actions">
        <button type="button" className="bf-primary bf-inline-add" onClick={openCatalog}><Search size={17} /> {t("Catalog de produse")}</button>
        <button type="button" className="bf-ghost" onClick={onAddReceipt}><ReceiptText size={17} /> {t("Adaugă bon")}</button>
      </div>

      <div className="bf-receipts-split">
        <article>
          <span>{t("Alimente")}</span>
          <strong>{fmtExact.format(split.food)}</strong>
          <small>{t("mâncare, băuturi, dulciuri")}</small>
        </article>
        <article>
          <span>{t("Nealimentare")}</span>
          <strong>{fmtExact.format(split.nonFood)}</strong>
          <small>{t("casă, haine, sănătate, altele")}</small>
        </article>
      </div>
      {split.total > 0 ? (
        <div className="bf-receipts-bar" aria-label={t("Repartiție alimente / nealimentare")}>
          <i className="is-food" style={{ width: `${foodShare}%` }} />
          <i className="is-other" style={{ width: `${100 - foodShare}%` }} />
        </div>
      ) : null}

      {split.byCategory.length > 0 ? (
        <ul className="bf-receipts-cats">
          {split.byCategory.slice(0, 8).map((item) => (
            <li key={item.category}>
              <div>
                <b>{t(item.category)}</b>
                <em>{t(item.group)} · {item.count} {item.count === 1 ? t("linie") : t("linii")}</em>
              </div>
              <strong>{money(item.amount)}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className="bf-helper">{t("Adaugă un bon sau un produs din catalog — aici apare pe ce s-au dus banii.")}</p>
      )}

      {split.products.length > 0 ? (
        <section>
          <p className="bf-kicker">{t("CE AI CUMPĂRAT")}</p>
          <ul className="bf-receipts-products">
            {split.products.slice(0, 24).map((item) => (
              <li key={item.key}>
                <div>
                  <b>{item.label}</b>
                  <small>{t(item.category)} · {t(item.group)} · {item.count}×</small>
                </div>
                <strong>{money(item.amount)}</strong>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
