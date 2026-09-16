/**
 * Rubrica Bonuri: articole, grupe de marfă, alimente vs nealimentare,
 * top produse și cheltuieli pe săptămână / lună. Manual sau din poză — aceleași linii.
 */
import "../receipts-studio.css";
import { useMemo, useState } from "react";
import { ReceiptText, Search } from "lucide-react";
import { type AppData } from "@/lib/finance-data";
import { getLocale, t } from "@/lib/i18n";
import {
  productSpendBreakdown,
  productSpendSeries,
  spendWindow,
  type SpendGroup,
  type SpendPeriodId,
} from "@/lib/product-catalog";
import { fmtExact, money } from "@/pages/home-kit";

type Props = {
  data: AppData;
  onAddReceipt: () => void;
};

const PERIODS: Array<{ id: SpendPeriodId; label: string }> = [
  { id: "week", label: "Săptămâna asta" },
  { id: "month", label: "Luna asta" },
  { id: "quarter", label: "3 luni" },
  { id: "all", label: "Tot" },
];

function bucketLabel(from: string, to: string, grain: "week" | "month") {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  if (grain === "month") return start.toLocaleDateString(getLocale(), { month: "short" });
  const sameMonth = start.getMonth() === end.getMonth();
  const day = (date: Date) => date.toLocaleDateString(getLocale(), { day: "numeric" });
  const month = (date: Date) => date.toLocaleDateString(getLocale(), { month: "short" });
  return sameMonth ? `${day(start)}–${day(end)} ${month(start)}` : `${day(start)} ${month(start)}–${day(end)} ${month(end)}`;
}

export function ReceiptsStudio({ data, onAddReceipt }: Props) {
  const [period, setPeriod] = useState<SpendPeriodId>("month");
  const [group, setGroup] = useState<SpendGroup | "all">("all");
  const [productKey, setProductKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const span = useMemo(() => spendWindow(period, undefined, data.receipts), [period, data.receipts]);
  const split = useMemo(() => productSpendBreakdown(data.receipts, { from: span.from, to: span.to }), [data.receipts, span.from, span.to]);
  const series = useMemo(
    () => productSpendSeries(data.receipts, { from: span.from, to: span.to, grain: span.grain, productKey: productKey || undefined, group: group === "all" ? undefined : group }),
    [data.receipts, span, productKey, group],
  );
  const foodShare = split.total > 0 ? Math.round((split.food / split.total) * 100) : 0;
  const openCatalog = () => globalThis.dispatchEvent(new CustomEvent("buget-familie:open-catalog"));
  const maxBar = Math.max(1, ...series.map((item) => item.total));
  const selected = split.products.find((item) => item.key === productKey);
  const filteredProducts = split.products.filter((item) => {
    if (group !== "all" && item.group !== group) return false;
    if (!query.trim()) return true;
    return item.label.toLocaleLowerCase("ro-RO").includes(query.trim().toLocaleLowerCase("ro-RO"));
  });
  const periodLabel = PERIODS.find((item) => item.id === period)?.label || t("Luna asta");
  const visibleCats = group === "all" ? split.byCategory : split.byCategory.filter((item) => item.group === group);

  return (
    <div className="bf-receipts-studio">
      <header className="bf-section-heading">
        <div>
          <p className="bf-kicker">{t("MONITORIZARE BONURI")}</p>
          <h2>{t("Unde se duc banii din bonuri")}</h2>
        </div>
        <ReceiptText size={18} />
      </header>
      <p className="bf-helper">{t("Bonurile din poză și cele puse de mână intră la fel: articole, grupe de marfă, alimente și nealimentare.")}</p>

      <div className="bf-period-chips" role="tablist" aria-label={t("Perioadă")}>
        {PERIODS.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={period === item.id} className={period === item.id ? "is-on" : ""} onClick={() => setPeriod(item.id)}>
            {t(item.label)}
          </button>
        ))}
      </div>

      <p className="bf-receipts-verdict">
        {split.total > 0
          ? t("Pe {period} ai cheltuit {total} pe bonuri: {food} alimente, {nonFood} nealimentare.", { period: t(periodLabel), total: money(split.total), food: money(split.food), nonFood: money(split.nonFood) })
          : t("Nu sunt articole pe perioada asta. Adaugă un bon — din poză sau de mână.")}
      </p>

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

      {series.some((item) => item.total > 0) ? (
        <section className="bf-spend-chart-wrap">
          <p className="bf-kicker">{span.grain === "week" ? t("SĂPTĂMÂNAL") : t("LUNAR")}</p>
          <p className="bf-helper">{selected ? t("Doar {name}, pe perioada aleasă.", { name: selected.label }) : t("Cât ai cheltuit pe bonuri, pe săptămână sau lună.")}</p>
          <div className="bf-spend-chart" role="img" aria-label={t("Grafic cheltuieli pe perioadă")}>
            {series.map((bucket) => {
              const height = Math.max(4, Math.round((bucket.total / maxBar) * 100));
              const foodPct = bucket.total > 0 ? Math.round((bucket.food / bucket.total) * 100) : 0;
              return (
                <div key={bucket.key} className="bf-spend-col">
                  <small>{money(bucket.total)}</small>
                  <div className="bf-spend-stack" style={{ height: `${height}%` }}>
                    <i className="is-food" style={{ height: `${foodPct}%` }} />
                    <i className="is-other" style={{ height: `${100 - foodPct}%` }} />
                  </div>
                  <em>{bucketLabel(bucket.from, bucket.to, span.grain)}</em>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="bf-period-chips bf-group-chips" role="tablist" aria-label={t("Grupe de marfă")}>
        <button type="button" className={group === "all" ? "is-on" : ""} onClick={() => setGroup("all")}>{t("Toate")}</button>
        <button type="button" className={group === "Alimente" ? "is-on" : ""} onClick={() => setGroup("Alimente")}>{t("Alimente")}</button>
        <button type="button" className={group === "Nealimentare" ? "is-on" : ""} onClick={() => setGroup("Nealimentare")}>{t("Nealimentare")}</button>
      </div>

      {visibleCats.length > 0 ? (
        <section>
          <p className="bf-kicker">{t("GRUPE DE MARFĂ")}</p>
          <ul className="bf-receipts-cats">
            {visibleCats.slice(0, 10).map((item) => {
              const share = split.total > 0 ? Math.round((item.amount / split.total) * 100) : 0;
              return (
                <li key={item.category}>
                  <div>
                    <b>{t(item.category)}</b>
                    <em>{t(item.group)} · {item.count} {item.count === 1 ? t("linie") : t("linii")} · {share}%</em>
                    <span className="bf-cat-meter" aria-hidden="true"><i style={{ width: `${share}%` }} /></span>
                  </div>
                  <strong>{money(item.amount)}</strong>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p className="bf-helper">{t("Adaugă un bon sau un produs din catalog — aici apare pe ce s-au dus banii.")}</p>
      )}

      {split.products.length > 0 ? (
        <section>
          <p className="bf-kicker">{t("TOP PRODUSE")}</p>
          <label className="bf-receipts-search">
            <span className="sr-only">{t("Caută un articol")}</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Caută un articol")} />
          </label>
          <ul className="bf-receipts-products">
            {filteredProducts.slice(0, 24).map((item) => (
              <li key={item.key}>
                <button type="button" className={productKey === item.key ? "is-on" : ""} onClick={() => setProductKey((current) => current === item.key ? null : item.key)}>
                  <span>
                    <b>{item.label}</b>
                    <small>{t(item.category)} · {t(item.group)} · {item.count}×</small>
                  </span>
                  <strong>{money(item.amount)}</strong>
                </button>
              </li>
            ))}
          </ul>
          {productKey ? <button type="button" className="bf-ghost bf-clear-product" onClick={() => setProductKey(null)}>{t("Arată tot graficul")}</button> : null}
        </section>
      ) : null}
    </div>
  );
}
