/**
 * Piesele comune ale ecranelor de planificare: cardul cu o singură coloană, cursorul fără
 * stilurile vechi de câmp, capul colorat cu cifra mare, butoanele de ales și linia mică de tendință.
 * Stilurile stau aici, nu în CSS: foaia globală e la limita ei.
 */
import type { CSSProperties, ReactNode } from "react";
import { useCountUp } from "@/hooks/useCountUp";
import { lei } from "@/lib/money-format";

/** O singură coloană care se poate strânge: un rând lat nu mai împinge cifrele afară din card. */
export const CARD = { gridTemplateColumns: "minmax(0, 1fr)" } as const;
/** `.bf-scenario-card input` dă oricărui câmp chenar și înălțime; cursorul nu are nevoie de ele. */
export const RANGE = { width: "100%", minHeight: 32, padding: 0, border: 0, background: "transparent", boxShadow: "none", accentColor: "var(--cf-primary)" } as const;
export const MUTED = { color: "var(--cf-muted)" } as const;
export const NUM = { fontVariantNumeric: "tabular-nums" } as const;
export const ROW = { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, minWidth: 0 } as const;

const HERO: CSSProperties = {
  position: "relative", overflow: "hidden", display: "grid", gap: 6, padding: "20px 18px", borderRadius: 22,
  background: "radial-gradient(120% 90% at 100% 0%, color-mix(in srgb, var(--cf-primary) 70%, transparent), transparent 60%), linear-gradient(150deg, var(--cf-primary-strong), color-mix(in srgb, var(--cf-primary-strong) 70%, #000))",
  color: "var(--cf-on-primary, #fff)", boxShadow: "0 18px 40px color-mix(in srgb, var(--cf-primary-strong) 28%, transparent)",
};

/** Cifra mare care „numără” la deschidere. */
export function CountLei({ value, signed = false }: { value: number; signed?: boolean }) {
  const shown = useCountUp(value, 700, 0);
  return <>{signed && value > 0 ? "+" : ""}{lei(Math.round(shown))}</>;
}

export function Hero({ kicker, value, sub, children }: { kicker: string; value: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return <section style={HERO}>
    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", opacity: 0.85 }}>{kicker}</span>
    <span role="heading" aria-level={2} style={{ fontSize: "clamp(28px, 9vw, 38px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.02em", ...NUM }}>{value}</span>
    {sub && <span style={{ fontSize: 14, lineHeight: 1.4, opacity: 0.92 }}>{sub}</span>}
    {children}
  </section>;
}

/** Butoane de ales (unul activ), ca filă. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<[T, string]>; onChange: (next: T) => void; label: string }) {
  return <div role="group" aria-label={label} style={{ display: "grid", gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, gap: 4, padding: 4, borderRadius: 14, background: "var(--cf-surface-alt)", border: "1px solid var(--cf-line)" }}>
    {options.map(([id, text]) => <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)} style={{ minHeight: 40, padding: "0 6px", border: 0, borderRadius: 10, fontWeight: 600, fontSize: 14, background: value === id ? "var(--cf-surface)" : "transparent", color: value === id ? "var(--cf-ink)" : "var(--cf-muted)", boxShadow: value === id ? "0 2px 8px rgba(0,0,0,.12)" : "none" }}>{text}</button>)}
  </div>;
}

/** Linia mică de tendință; ultimul punct e marcat. */
export function Spark({ values, color = "currentColor", width = 96, height = 28, label }: { values: number[]; color?: string; width?: number; height?: number; label?: string }) {
  if (values.length < 2) return null;
  const top = Math.max(...values), low = Math.min(...values), span = top - low || 1;
  const x = (n: number) => 2 + (n / (values.length - 1)) * (width - 4);
  const y = (v: number) => height - 3 - ((v - low) / span) * (height - 6);
  const line = values.map((v, n) => `${n ? "L" : "M"}${x(n).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ flex: "none", display: "block" }}>
    <path d={`${line} L${x(values.length - 1)},${height} L${x(0)},${height} Z`} fill={color} opacity={0.12} />
    <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={2.8} fill={color} />
  </svg>;
}

/** Un câmp numeric cu eticheta deasupra, fără să depindă de stilurile globale de formular. */
export function NumberField({ label, value, onChange, min = 0, max, step = 1, suffix }: { label: string; value: number; onChange: (next: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return <label style={{ display: "grid", gap: 4, minWidth: 0, fontSize: 13, fontWeight: 600, color: "var(--cf-muted)" }}>
    <span>{label}{suffix ? ` (${suffix})` : ""}</span>
    <input type="number" inputMode="decimal" value={Number.isFinite(value) ? value : ""} min={min} max={max} step={step} onChange={(event) => { const next = Number(event.target.value); if (Number.isFinite(next)) onChange(Math.max(min, max === undefined ? next : Math.min(max, next))); }} style={{ minHeight: 44, width: "100%", minWidth: 0, padding: "0 12px", border: "1px solid var(--cf-line)", borderRadius: 12, background: "var(--cf-surface)", color: "var(--cf-ink)", fontSize: 16, fontWeight: 600 }} />
  </label>;
}
