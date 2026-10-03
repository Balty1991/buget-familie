/**
 * Averea familiei (Mai mult → Planificare): cifra netă, evoluția pe 12 luni, din ce e făcută
 * (surse, bunuri, datorii) și bunurile trecute de mână, cu adăugare, actualizare și ștergere.
 */
import { useMemo, useState, type ReactNode } from "react";
import { Car, Home as HomeIcon, LineChart, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { isoToday, newId, parseRomanianAmount, sourceBalance, type AppData } from "@/lib/finance-data";
import { netWorth } from "@/lib/net-worth";
import type { Asset, AssetKind } from "@/lib/asset-data";
import { getLocale, t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";

/** O singură coloană care se poate strânge: un rând lat nu mai împinge cifrele afară din card. */
const CARD = { gridTemplateColumns: "minmax(0, 1fr)" } as const;

const W = 320, H = 130;
const KIND_LABEL = (kind: AssetKind) => kind === "home" ? t("Locuință") : kind === "car" ? t("Mașină") : kind === "investment" ? t("Investiții") : t("Altele");
const KIND_ICON = { home: HomeIcon, car: Car, investment: LineChart, other: Package } as const;
const monthLabel = (key: string) => new Intl.DateTimeFormat(getLocale(), { month: "short" }).format(new Date(`${key}-15T12:00:00`));

export function NetWorthPanel({ data, onChange }: { data: AppData; onChange: (next: AppData) => void }) {
  const worth = useMemo(() => netWorth(data, isoToday()), [data]);
  const [editing, setEditing] = useState<Partial<Asset> & { valueText?: string } | undefined>(undefined);
  const saveAssets = (assets: Asset[]) => onChange({ ...data, settings: { ...data.settings, assets } });
  const all = data.settings.assets || [];
  const commit = () => {
    if (!editing) return;
    const name = (editing.name || "").trim();
    const value = parseRomanianAmount(editing.valueText || "");
    if (!name || !(value >= 0)) return;
    const now = new Date().toISOString();
    const next: Asset = { id: editing.id || newId("asset"), name: name.slice(0, 60), kind: editing.kind || "other", value: Math.round(value * 100) / 100, updatedAt: now };
    saveAssets(editing.id ? all.map((item) => item.id === editing.id ? next : item) : [...all, next]);
    setEditing(undefined);
  };
  const remove = (asset: Asset) => saveAssets(all.map((item) => item.id === asset.id ? { ...item, deleted: true, updatedAt: new Date().toISOString() } : item));
  const values = worth.history.map((point) => point.net);
  // Scara pe valorile reale (nu de la zero): o casă de 320.000 nu mai turtește variațiile lunare.
  const pad = Math.max(1, (Math.max(...values) - Math.min(...values)) * 0.15) || 1;
  const top = Math.max(...values) + pad, bottom = Math.min(...values) - pad, span = Math.max(1, top - bottom);
  const x = (index: number) => 6 + (index / Math.max(1, worth.history.length - 1)) * (W - 12);
  const y = (value: number) => 8 + ((top - value) / span) * (H - 28);
  const line = worth.history.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point.net).toFixed(1)}`).join(" ");
  const row = (label: ReactNode, amount: number, extra?: ReactNode) => <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, minHeight: 44, borderBottom: "1px solid var(--cf-line)" }}><span style={{ minWidth: 0 }}>{label}</span><span style={{ display: "flex", alignItems: "center", gap: 4 }}><b style={{ fontVariantNumeric: "tabular-nums" }}>{lei(amount)}</b>{extra}</span></div>;
  return <div style={{ display: "grid", gap: 14 }}>
    <section className="bf-scenario-card" style={CARD}>
      <div className="bf-scenario-heading"><div>
        <p className="bf-kicker">{t("AVEREA FAMILIEI")}</p>
        <h2 style={{ fontSize: 34 }}>{lei(worth.net)}</h2>
        <p>{worth.yearChange !== undefined ? t("{sign}{amount} față de acum un an.", { sign: worth.yearChange >= 0 ? "+" : "−", amount: lei(Math.abs(worth.yearChange)) }) : worth.monthChange !== undefined ? t("{sign}{amount} față de luna trecută.", { sign: worth.monthChange >= 0 ? "+" : "−", amount: lei(Math.abs(worth.monthChange)) }) : t("Ce aveți minus ce datorați.")}</p>
      </div></div>
      {worth.history.length > 1 && <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("Averea, lună cu lună")} style={{ width: "100%", height: "auto", display: "block" }}>
        {bottom < 0 && top > 0 && <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="var(--cf-line)" />}
        <path d={`${line} L${x(worth.history.length - 1)},${H - 20} L${x(0)},${H - 20} Z`} fill="var(--cf-primary)" opacity="0.12" />
        <path d={line} fill="none" stroke="var(--cf-primary-strong)" strokeWidth="2.5" strokeLinejoin="round" />
        {worth.history.map((point, index) => index % 3 === 0 || index === worth.history.length - 1 ? <text key={point.key} x={x(index)} y={H - 4} fontSize="9" textAnchor="middle" fill="var(--cf-muted)">{monthLabel(point.key)}</text> : null)}
      </svg>}
      <small className="bf-helper" style={{ margin: 0 }}>{t("Istoricul e refăcut din mișcările notate; bunurile intră cu valoarea de azi.")}</small>
    </section>
    <section className="bf-scenario-card" style={CARD}>
      <p className="bf-kicker">{t("CE AVEȚI")} · {lei(worth.cash + worth.assets)}</p>
      {data.settings.paymentSources.map((source) => <div key={source.id}>{row(source.name, sourceBalance(data, source.id))}</div>)}
      {worth.liveAssets.map((asset) => { const Icon = KIND_ICON[asset.kind]; return <div key={asset.id}>{row(<span title={KIND_LABEL(asset.kind)} style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}><Icon size={16} aria-label={KIND_LABEL(asset.kind)} style={{ flex: "none" }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{asset.name}</span></span>, asset.value, <><button type="button" className="bf-icon-button" aria-label={t("Schimbă valoarea pentru {name}", { name: asset.name })} onClick={() => setEditing({ ...asset, valueText: String(asset.value) })}><Pencil size={15} /></button><button type="button" className="bf-icon-button" aria-label={t("Șterge {name}", { name: asset.name })} onClick={() => remove(asset)}><Trash2 size={15} /></button></>)}</div>; })}
      {!editing && <button type="button" className="bf-secondary" style={{ justifySelf: "start" }} onClick={() => setEditing({ kind: "home", valueText: "" })}><Plus size={16} aria-hidden="true" /> {t("Adaugă un bun")}</button>}
      {editing && <form style={{ display: "grid", gap: 10 }} onSubmit={(event) => { event.preventDefault(); commit(); }}>
        <label className="bf-field"><span>{t("Ce este")}</span><input value={editing.name || ""} onChange={(event) => setEditing({ ...editing, name: event.target.value })} placeholder={t("ex. Apartamentul, Dacia, Fond de investiții")} maxLength={60} /></label>
        <label className="bf-field"><span>{t("Tip")}</span><select value={editing.kind || "other"} onChange={(event) => setEditing({ ...editing, kind: event.target.value as AssetKind })}>{(["home", "car", "investment", "other"] as AssetKind[]).map((kind) => <option key={kind} value={kind}>{KIND_LABEL(kind)}</option>)}</select></label>
        <label className="bf-field"><span>{t("Cât valorează azi (lei)")}</span><input value={editing.valueText || ""} onChange={(event) => setEditing({ ...editing, valueText: event.target.value })} inputMode="decimal" /></label>
        <div style={{ display: "flex", gap: 10 }}><button type="submit" className="bf-primary">{t("Salvează")}</button><button type="button" className="bf-ghost" onClick={() => setEditing(undefined)}>{t("Renunță")}</button></div>
      </form>}
      <small className="bf-helper" style={{ margin: 0 }}>{t("Obiectivele de economii nu se adună separat: banii lor sunt deja într-una din surse.")}</small>
    </section>
    <section className="bf-scenario-card" style={CARD}>
      <p className="bf-kicker">{t("CE DATORAȚI")} · {lei(worth.debts)}</p>
      {data.debts.filter((debt) => debt.remaining > 0).map((debt) => <div key={debt.id}>{row(debt.name, debt.remaining)}</div>)}
      {!data.debts.some((debt) => debt.remaining > 0) && <p className="bf-helper" style={{ margin: 0 }}>{t("Nicio datorie. Felicitări!")}</p>}
    </section>
  </div>;
}
