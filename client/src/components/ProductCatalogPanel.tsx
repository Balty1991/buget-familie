/**
 * Rubrica Catalog: cauți un articol (local + Open Food Facts) și îl treci
 * în repartizarea de produse. Ghidul nu e locul pentru asta.
 */
import "../receipts-studio.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { foldRomanian, isoToday, newId, parseRomanianAmount, type AppData, type Receipt } from "@/lib/finance-data";
import {
  CATALOG_STARTERS,
  classifyProductLabel,
  searchOnlineProducts,
  searchProductCatalog,
  type ProductHit,
} from "@/lib/product-catalog";
import { isOfflineOnly } from "@/lib/ui-prefs";
import { t } from "@/lib/i18n";

type Props = {
  data: AppData;
  onChange: (next: AppData) => void;
};

const QUERY_KEY = "buget-familie:catalog-query";

function readPrefill(): string {
  try {
    const value = sessionStorage.getItem(QUERY_KEY) || "";
    if (value) sessionStorage.removeItem(QUERY_KEY);
    return value;
  } catch {
    return "";
  }
}

export function ProductCatalogPanel({ data, onChange }: Props) {
  const [query, setQuery] = useState(readPrefill);
  const [picked, setPicked] = useState<ProductHit | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(isoToday());
  const [vendor, setVendor] = useState("");
  const [onlineHits, setOnlineHits] = useState<ProductHit[]>([]);
  const [onlineBusy, setOnlineBusy] = useState(false);
  const [onlineError, setOnlineError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const offline = isOfflineOnly();
  const hits = useMemo(() => searchProductCatalog(query, data.receipts, 10), [query, data.receipts]);

  useEffect(() => {
    inputRef.current?.focus();
    const onOpen = (event: Event) => {
      const next = (event as CustomEvent<{ query?: string }>).detail?.query;
      if (typeof next === "string" && next.trim()) {
        setQuery(next.trim());
        setPicked(null);
        inputRef.current?.focus();
      }
    };
    window.addEventListener("buget-familie:open-catalog", onOpen);
    return () => window.removeEventListener("buget-familie:open-catalog", onOpen);
  }, []);

  useEffect(() => {
    if (offline || query.trim().length < 3) {
      setOnlineHits([]);
      setOnlineBusy(false);
      setOnlineError(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setOnlineBusy(true);
      setOnlineError(false);
      void searchOnlineProducts(query, { signal: controller.signal })
        .then((next) => {
          if (controller.signal.aborted) return;
          setOnlineHits(next);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setOnlineHits([]);
          setOnlineError(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setOnlineBusy(false);
        });
    }, 380);
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
    return merged.slice(0, 18);
  }, [hits, onlineHits]);

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
      note: t("Produs introdus din catalog, fără fotografie de bon."),
      lines: [{ id: newId("line"), category, amount: value, label: hit.name }],
      updatedAt: new Date().toISOString(),
    };
    onChange({ ...data, receipts: [receipt, ...data.receipts] });
    setPicked(null);
    setAmount("");
    setQuery("");
    setOnlineHits([]);
  };

  const sourceLabel = (hit: ProductHit) =>
    hit.source === "bon" ? t("din bonurile tale") : hit.source === "online" ? t("din catalogul online") : t("din catalog");

  return (
    <div className="bf-receipts-studio bf-catalog-panel">
      <header className="bf-section-heading">
        <div>
          <p className="bf-kicker">{t("CATALOG")}</p>
          <h2>{t("Adaugă un articol din listă")}</h2>
        </div>
        <Search size={18} />
      </header>
      <p className="bf-helper">{t("Scrie denumirea. Căutăm pe telefon și în listele deschise Open Food Facts — milioane de produse. Pleacă doar ce tastezi, niciodată poza sau registrul.")}</p>

      <section className="bf-receipts-search" aria-label={t("Caută un produs")}>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setPicked(null); }}
          placeholder={t("ex. Napolact, lapte, Ariel, ciorapi")}
          autoComplete="off"
          aria-label={t("Caută un produs")}
        />
        {!query.trim() ? (
          <div className="bf-catalog-starters">
            {CATALOG_STARTERS.map((name) => (
              <button type="button" key={name} onClick={() => { setQuery(name); setPicked(null); }}>{name}</button>
            ))}
          </div>
        ) : null}

        {query.trim().length >= 2 ? (
          <div className="bf-receipts-hits">
            {shownHits.map((hit) => (
              <button type="button" key={`${hit.source}-${hit.name}`} onClick={() => setPicked(hit)}>
                <span>{hit.name}<small> · {sourceLabel(hit)} · {t(hit.category)}</small></span>
                <Plus size={14} />
              </button>
            ))}
            {onlineBusy ? <p className="bf-helper">{t("Căutăm în catalogul online…")}</p> : null}
            {onlineError ? <p className="bf-helper">{t("Catalogul online n-a răspuns. Rămân rezultatele de pe telefon — poți adăuga denumirea tu.")}</p> : null}
            {!onlineBusy && !shownHits.length && query.trim().length >= 3 ? (
              <p className="bf-helper">{t("Nicio potrivire încă. Poți adăuga denumirea exact cum o scrii.")}</p>
            ) : null}
            {!shownHits.some((hit) => foldRomanian(hit.name) === foldRomanian(query)) ? (
              <button type="button" onClick={() => setPicked({ name: query.trim(), category: classifyProductLabel(query), source: "catalog" })}>
                <span>{t("Adaugă „{name}”", { name: query.trim() })}<small> · {t(classifyProductLabel(query))} · {t("categorie propusă")}</small></span>
                <Plus size={14} />
              </button>
            ) : null}
          </div>
        ) : (
          <p className="bf-helper">{offline ? t("Modul fără internet e pornit — căutăm doar pe telefon.") : t("Alege o sugestie sau scrie cel puțin 3 litere. Listele online apar imediat.")}</p>
        )}
      </section>

      {picked ? (
        <form className="bf-receipts-manual" onSubmit={(event) => { event.preventDefault(); addProduct(picked, amount); }}>
          <p><b>{picked.name}</b> · {t(picked.category)} · {sourceLabel(picked)}</p>
          <div className="bf-form-grid">
            <label>{t("Sumă")}<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0,00" autoFocus /></label>
            <label>{t("Data")}<input type="date" value={date} onChange={(event) => event.target.value && setDate(event.target.value)} /></label>
            <label>{t("Magazin (opțional)")}<input value={vendor} onChange={(event) => setVendor(event.target.value)} placeholder={t("ex. Lidl")} /></label>
          </div>
          <div className="bf-receipts-actions">
            <button type="submit" className="bf-primary" disabled={!(parseRomanianAmount(amount) > 0)}>{t("Adaugă produsul")}</button>
            <button type="button" className="bf-ghost" onClick={() => setPicked(null)}>{t("Renunță")}</button>
          </div>
          <p className="bf-helper">{t("Intră în repartizarea de la Bonuri. În registru trece doar dacă îl salvezi și ca mișcare, din ghid sau din Adaugă.")}</p>
        </form>
      ) : null}
    </div>
  );
}
