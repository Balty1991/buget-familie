/**
 * Rubrica Bonuri: totalurile rămân în ghid / registru; aici se văd produsele,
 * categoria (alimente vs nealimentare) și căutarea în catalogul local.
 */
import "../receipts-studio.css";
import { useEffect, useMemo, useState } from "react";
import { Plus, ReceiptText, Search } from "lucide-react";
import { foldRomanian, isoToday, newId, parseRomanianAmount, type AppData, type Receipt } from "@/lib/finance-data";
import { classifyProductLabel, productSpendBreakdown, searchOnlineProducts, searchProductCatalog, type ProductHit } from "@/lib/product-catalog";
import { isOfflineOnly } from "@/lib/ui-prefs";
import { fmtExact, money } from "@/pages/home-kit";
import { t } from "@/lib/i18n";

type Props = {
  data: AppData;
  onChange: (next: AppData) => void;
  onAddReceipt: () => void;
};

export function ReceiptsStudio({ data, onChange, onAddReceipt }: Props) {
  const month = isoToday().slice(0, 7);
  const split = useMemo(() => productSpendBreakdown(data.receipts, month), [data.receipts, month]);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<ProductHit | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(isoToday());
  const [vendor, setVendor] = useState("");
  const hits = useMemo(() => searchProductCatalog(query, data.receipts), [query, data.receipts]);
  const [onlineHits, setOnlineHits] = useState<ProductHit[]>([]);
  const [onlineBusy, setOnlineBusy] = useState(false);
  const offline = isOfflineOnly();
  useEffect(() => {
    if (offline || query.trim().length < 3) {
      setOnlineHits([]);
      setOnlineBusy(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setOnlineBusy(true);
      void searchOnlineProducts(query, { signal: controller.signal })
        .then((next) => { if (!controller.signal.aborted) setOnlineHits(next); })
        .catch(() => { if (!controller.signal.aborted) setOnlineHits([]); })
        .finally(() => { if (!controller.signal.aborted) setOnlineBusy(false); });
    }, 420);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, offline]);
  const shownHits = useMemo(() => {
    const merged = [...hits];
    const seen = new Set(hits.map((item) => foldRomanian(item.name)));
    for (const hit of onlineHits) {
      const key = foldRomanian(hit.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(hit);
    }
    return merged.slice(0, 16);
  }, [hits, onlineHits]);
  const foodShare = split.total > 0 ? Math.round((split.food / split.total) * 100) : 0;

  const addProduct = (hit: ProductHit, rawAmount: string) => {
    const value = parseRomanianAmount(rawAmount);
    if (!(value > 0)) return;
    const category = hit.category || classifyProductLabel(hit.name);
    const receipt: Receipt = {
      id: newId("manual-product"),
      vendor: vendor.trim() || t("Adăugat din catalog"),
      amount: value,
      category,
      date,
      note: t("Produs introdus manual, fără fotografie de bon."),
      lines: [{ id: newId("line"), category, amount: value, label: hit.name }],
      updatedAt: new Date().toISOString(),
    };
    onChange({ ...data, receipts: [receipt, ...data.receipts] });
    setPicked(null);
    setAmount("");
    setQuery("");
  };

  return (
    <div className="bf-receipts-studio">
      <header className="bf-section-heading">
        <div>
          <p className="bf-kicker">{t("PRODUSE")}</p>
          <h2>{t("Unde se duc banii din bonuri")}</h2>
        </div>
        <ReceiptText size={18} />
      </header>
      <p className="bf-helper">{t("Ghidul trece doar totalul în registru. Aici vezi produsele: alimente vs nealimentare. Căutarea e locală, plus catalogul deschis Open Food Facts — pleacă doar denumirea, niciodată poza sau registrul.")}</p>

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
        <p className="bf-helper">{t("Adaugă un bon sau un produs — aici apare pe ce s-au dus banii.")}</p>
      )}

      <section className="bf-receipts-search" aria-label={t("Caută un produs")}>
        <p className="bf-kicker">{t("CATALOG")}</p>
        <input
          value={query}
          onChange={(event) => { setQuery(event.target.value); setPicked(null); }}
          placeholder={t("ex. lapte, ciorapi, detergent")}
          autoComplete="off"
          aria-label={t("Caută un produs")}
        />
        {query.trim().length >= 2 ? (
          <div className="bf-receipts-hits">
            {shownHits.map((hit) => (
              <button type="button" key={`${hit.source}-${hit.name}`} onClick={() => setPicked(hit)}>
                <span>{hit.name}<small> · {hit.source === "bon" ? t("din bonurile tale") : hit.source === "online" ? t("din catalogul online") : t("din catalog")} · {t(hit.category)}</small></span>
                <Search size={14} />
              </button>
            ))}
            {onlineBusy ? <p className="bf-helper">{t("Căutăm în catalogul online…")}</p> : null}
            {!shownHits.some((hit) => hit.name.toLocaleLowerCase("ro-RO") === query.trim().toLocaleLowerCase("ro-RO")) ? (
              <button type="button" onClick={() => setPicked({ name: query.trim(), category: classifyProductLabel(query), source: "catalog" })}>
                <span>{t("Adaugă „{name}”", { name: query.trim() })}<small> · {t(classifyProductLabel(query))} · {t("categorie propusă")}</small></span>
                <Plus size={14} />
              </button>
            ) : null}
          </div>
        ) : <p className="bf-helper">{offline ? t("Scrie denumirea — catalogul de pe telefon + ce ai mai cumpărat.") : t("Scrie denumirea — catalogul local, bonurile tale și milioane de produse din Open Food Facts.")}</p>}
      </section>

      {picked ? (
        <form className="bf-receipts-manual" onSubmit={(event) => { event.preventDefault(); addProduct(picked, amount); }}>
          <p><b>{picked.name}</b> · {t(picked.category)}</p>
          <div className="bf-form-grid">
            <label>{t("Sumă")}<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0,00" autoFocus /></label>
            <label>{t("Data")}<input type="date" value={date} onChange={(event) => event.target.value && setDate(event.target.value)} /></label>
            <label>{t("Magazin (opțional)")}<input value={vendor} onChange={(event) => setVendor(event.target.value)} placeholder={t("ex. Lidl")} /></label>
          </div>
          <div className="bf-receipts-actions">
            <button type="submit" className="bf-primary" disabled={!(parseRomanianAmount(amount) > 0)}>{t("Adaugă produsul")}</button>
            <button type="button" className="bf-ghost" onClick={() => setPicked(null)}>{t("Renunță")}</button>
          </div>
          <p className="bf-helper">{t("Intră în repartizarea de aici. În registru trece doar dacă îl salvezi și ca mișcare, din ghid sau din Adaugă.")}</p>
        </form>
      ) : null}

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

      <div className="bf-receipts-actions">
        <button type="button" className="bf-primary bf-inline-add" onClick={onAddReceipt}><ReceiptText size={17} /> {t("Adaugă bon")}</button>
      </div>
    </div>
  );
}
