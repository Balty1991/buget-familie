/**
 * Graficele aplicației, desenate de mână în SVG (fără bibliotecă de 100 KB):
 * - ScrubChart: bare sau linie; degetul (sau mouse-ul, sau săgețile) alunecă peste el și arată valoarea exactă;
 * - MoneyFlowChart: de unde vin banii și unde se duc, cu benzi proporționale;
 * - YearHeatmap: fiecare zi din ultimul an, colorată după cât s-a cheltuit;
 * - Treemap: categoriile ca dreptunghiuri cu aria pe măsura sumei.
 * Intră cu o animație scurtă; cu „Reduce mișcarea” din telefon apar direct.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { categoryColor } from "@/lib/category-color";
import { formatDate } from "@/lib/finance-data";
import { squarify, type MoneyFlow, type YearHeat } from "@/lib/chart-data";
import { getLocale, t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";

const reducedMotion = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return true; } };

/** `true` după prima pictare: ce crește din 0 are de unde porni. */
function useEntered() {
  const [entered, setEntered] = useState(reducedMotion);
  useEffect(() => { if (entered) return; const frame = window.requestAnimationFrame(() => setEntered(true)); return () => window.cancelAnimationFrame(frame); }, [entered]);
  return entered;
}

export type ChartPoint = { label: string; value: number; /** Textul lung din bula de sus („septembrie 2026”). */ long?: string; /** O a doua serie, ca linie subțire (de ex. venitul peste cheltuieli). */ ref?: number };

export function ScrubChart({ points, kind = "bars", height = 160, color = "var(--cf-primary)", refColor = "var(--cf-muted)", highlight, format = (value: number) => lei(Math.round(value)), label, refLabel }: {
  points: ChartPoint[]; kind?: "bars" | "line"; height?: number; color?: string; refColor?: string; highlight?: number; format?: (value: number) => string; label: string; refLabel?: string;
}) {
  const [active, setActive] = useState<number | undefined>(undefined);
  const box = useRef<HTMLDivElement>(null);
  const entered = useEntered();
  const W = 320, H = height, padTop = 34, padBottom = 20;
  const top = Math.max(1, ...points.map((p) => Math.max(p.value, p.ref || 0)));
  const step = W / Math.max(1, points.length);
  const y = (value: number) => padTop + (1 - value / top) * (H - padTop - padBottom);
  const cx = (index: number) => kind === "bars" ? step * index + step / 2 : 8 + (index / Math.max(1, points.length - 1)) * (W - 16);
  const pick = (event: PointerEvent<HTMLDivElement>) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || !points.length) return;
    const ratio = Math.min(0.9999, Math.max(0, (event.clientX - rect.left) / rect.width));
    setActive(kind === "bars" ? Math.floor(ratio * points.length) : Math.round(ratio * (points.length - 1)));
  };
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    setActive((current) => Math.min(points.length - 1, Math.max(0, (current ?? (event.key === "ArrowRight" ? -1 : points.length)) + (event.key === "ArrowRight" ? 1 : -1))));
  };
  const shown = active ?? highlight ?? points.length - 1;
  const point = points[shown];
  const line = points.map((p, i) => `${i ? "L" : "M"}${cx(i).toFixed(1)},${y(entered ? p.value : 0).toFixed(1)}`).join(" ");
  const refLine = points.some((p) => p.ref !== undefined) ? points.map((p, i) => `${i ? "L" : "M"}${cx(i).toFixed(1)},${y(p.ref || 0).toFixed(1)}`).join(" ") : "";
  const bubbleText = point ? `${format(point.value)}${point.ref !== undefined ? ` / ${format(point.ref)}` : ""}` : "";
  // Bula își ia lățimea după text (≈ 7 px pe literă la 12 px, cifrele sunt înguste) și nu iese din grafic.
  const bubbleW = Math.min(W, Math.max(64, bubbleText.length * 6.6 + 22));
  const bubbleX = Math.min(W - bubbleW / 2, Math.max(bubbleW / 2, cx(shown)));
  const every = Math.ceil(points.length / 7);
  return <div ref={box} tabIndex={0} role="group" aria-label={`${label}. ${t("Glisați sau folosiți săgețile pentru valori.")}`} onPointerDown={pick} onPointerMove={(event) => { if (event.buttons || event.pointerType === "mouse") pick(event); }} onPointerLeave={() => setActive(undefined)} onKeyDown={keys}
    style={{ position: "relative", touchAction: "pan-y", outline: "none", userSelect: "none" }}>
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }} aria-hidden="true">
      {[0.5, 1].map((share) => <line key={share} x1={0} x2={W} y1={y(top * share)} y2={y(top * share)} stroke="var(--cf-line)" strokeDasharray="2 4" />)}
      {kind === "bars" && points.map((p, i) => {
        const barH = Math.max(2, (entered ? p.value / top : 0) * (H - padTop - padBottom));
        return <rect key={i} x={step * i + step * 0.16} width={step * 0.68} y={H - padBottom - barH} height={barH} rx={Math.min(6, step * 0.2)} fill={color} opacity={i === shown ? 1 : 0.45}
          style={{ transition: reducedMotion() ? undefined : `y .6s cubic-bezier(.2,.8,.2,1) ${i * 25}ms, height .6s cubic-bezier(.2,.8,.2,1) ${i * 25}ms, opacity .15s` }} />;
      })}
      {kind === "line" && <>
        <path d={`${line} L${cx(points.length - 1)},${H - padBottom} L${cx(0)},${H - padBottom} Z`} fill={color} opacity={0.12} style={{ transition: "d .6s cubic-bezier(.2,.8,.2,1)" }} />
        <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" style={{ transition: "d .6s cubic-bezier(.2,.8,.2,1)" }} />
      </>}
      {refLine && <path d={refLine} fill="none" stroke={refColor} strokeWidth={1.5} strokeDasharray="4 3" />}
      {point && <>
        <line x1={cx(shown)} x2={cx(shown)} y1={padTop - 4} y2={H - padBottom} stroke="var(--cf-ink)" strokeOpacity={0.25} />
        {kind === "line" && <circle cx={cx(shown)} cy={y(point.value)} r={5} fill={color} stroke="var(--cf-surface)" strokeWidth={2} />}
        <g transform={`translate(${bubbleX}, 2)`}>
          <rect x={-bubbleW / 2} width={bubbleW} height={26} rx={13} fill="var(--cf-ink)" />
          <text x={0} y={17} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--cf-surface)">{bubbleText}</text>
        </g>
      </>}
      {points.map((p, i) => (i % every === 0 || i === points.length - 1) && <text key={i} x={cx(i)} y={H - 4} textAnchor="middle" fontSize={10} fill={i === shown ? "var(--cf-ink)" : "var(--cf-muted)"} fontWeight={i === shown ? 700 : 400}>{p.label}</text>)}
    </svg>
    <span aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{point ? `${point.long || point.label}: ${format(point.value)}${point.ref !== undefined && refLabel ? `, ${refLabel} ${format(point.ref)}` : ""}` : ""}</span>
  </div>;
}

/** Benzile fluxului: fiecare venit se împarte proporțional pe fiecare destinație. */
export function MoneyFlowChart({ flow, colorOf = categoryColor, keptName, savingsName }: { flow: MoneyFlow; colorOf?: (name: string) => string; keptName: string; savingsName?: string }) {
  const entered = useEntered();
  const [focus, setFocus] = useState<string | undefined>(undefined);
  const W = 320, gap = 6, nodeW = 10;
  const H = Math.max(220, Math.max(flow.income.length, flow.spend.length) * 34);
  const usable = (count: number) => H - gap * Math.max(0, count - 1);
  const layoutSide = (nodes: MoneyFlow["income"]) => { let y = 0; const space = usable(nodes.length); return nodes.map((node) => { const h = Math.max(3, (node.amount / Math.max(1, flow.total)) * space); const out = { ...node, y, h }; y += h + gap; return out; }); };
  const left = layoutSide(flow.income), right = layoutSide(flow.spend);
  const leftX = 0, rightX = W - nodeW;
  const sourceColor = (index: number) => (left[index]?.name === savingsName ? "var(--cf-warning, #b17814)" : ["var(--cf-info)", "color-mix(in srgb, var(--cf-info) 60%, var(--cf-primary))", "color-mix(in srgb, var(--cf-info) 55%, var(--cf-surface))", "var(--cf-muted)"][index % 4]);
  const target = (name: string) => (name === keptName ? "var(--cf-primary)" : colorOf(name));
  // Fiecare venit trimite din banda lui, în ordine, câte o felie spre fiecare destinație.
  const leftCursor = left.map((node) => node.y), rightCursor = right.map((node) => node.y);
  const links: Array<{ d: string; color: string; from: string; to: string; amount: number }> = [];
  left.forEach((src, i) => right.forEach((dst, j) => {
    const amount = (src.amount * dst.amount) / Math.max(1, flow.total);
    const hs = (amount / Math.max(1, src.amount)) * src.h, hd = (amount / Math.max(1, dst.amount)) * dst.h;
    const y0 = leftCursor[i], y1 = rightCursor[j];
    leftCursor[i] += hs; rightCursor[j] += hd;
    const x0 = leftX + nodeW, x1 = rightX, mx = (x0 + x1) / 2;
    links.push({ d: `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1} L${x1},${y1 + hd} C${mx},${y1 + hd} ${mx},${y0 + hs} ${x0},${y0 + hs} Z`, color: target(dst.name), from: src.name, to: dst.name, amount });
  }));
  return <div>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("De unde vin banii și unde se duc")} style={{ width: "100%", height: "auto", display: "block" }}>
      {links.map((link, i) => <path key={i} d={link.d} fill={link.color} opacity={focus ? (focus === link.to || focus === link.from ? 0.55 : 0.07) : entered ? 0.28 : 0} style={{ transition: reducedMotion() ? undefined : `opacity .5s ease ${i * 12}ms` }} />)}
      {left.map((node, i) => <rect key={node.name} x={leftX} y={node.y} width={nodeW} height={node.h} rx={3} fill={sourceColor(i)} onPointerEnter={() => setFocus(node.name)} onPointerLeave={() => setFocus(undefined)} onClick={() => setFocus(focus === node.name ? undefined : node.name)} />)}
      {right.map((node) => <rect key={node.name} x={rightX} y={node.y} width={nodeW} height={node.h} rx={3} fill={target(node.name)} onPointerEnter={() => setFocus(node.name)} onPointerLeave={() => setFocus(undefined)} onClick={() => setFocus(focus === node.name ? undefined : node.name)} />)}
    </svg>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 12, marginTop: 8 }}>
      {[{ nodes: left, colors: (i: number, _n: string) => sourceColor(i) }, { nodes: right, colors: (_i: number, n: string) => target(n) }].map((side, s) => <ul key={s} style={{ display: "grid", gap: 6, margin: 0, padding: 0, listStyle: "none", minWidth: 0 }}>
        {side.nodes.map((node, i) => <li key={node.name}><button type="button" onClick={() => setFocus(focus === node.name ? undefined : node.name)} aria-pressed={focus === node.name} style={{ display: "grid", gridTemplateColumns: "10px minmax(0, 1fr)", gap: 8, alignItems: "start", width: "100%", minHeight: 40, padding: "4px 6px", border: 0, borderRadius: 10, textAlign: "left", background: focus === node.name ? "var(--cf-surface-alt)" : "transparent", color: "var(--cf-ink)" }}>
          <i aria-hidden="true" style={{ width: 10, height: 10, marginTop: 4, borderRadius: 3, background: side.colors(i, node.name) }} />
          <span style={{ display: "grid", minWidth: 0 }}><span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t(node.name)}</span><small style={{ color: "var(--cf-muted)", fontVariantNumeric: "tabular-nums" }}>{lei(Math.round(node.amount))} · {Math.round((node.amount / Math.max(1, flow.total)) * 100)}%</small></span>
        </button></li>)}
      </ul>)}
    </div>
  </div>;
}

const HEAT = ["var(--cf-surface-alt)", "color-mix(in srgb, var(--cf-primary) 22%, var(--cf-surface))", "color-mix(in srgb, var(--cf-primary) 48%, var(--cf-surface))", "color-mix(in srgb, var(--cf-warning, #b17814) 55%, var(--cf-surface))", "color-mix(in srgb, var(--cf-danger) 72%, var(--cf-surface))"];

export function YearHeatmap({ heat }: { heat: YearHeat }) {
  const [picked, setPicked] = useState<{ date: string; spent: number } | undefined>(undefined);
  const id = useId();
  const cell = 11, gap = 2, left = 14, topPad = 14;
  const W = left + heat.weeks.length * (cell + gap), H = topPad + 7 * (cell + gap);
  const monthName = (key: string) => new Intl.DateTimeFormat(getLocale(), { month: "short" }).format(new Date(`${key}-15T12:00:00Z`)).replace(".", "");
  const choose = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const sx = ((event.clientX - rect.left) / rect.width) * W, sy = ((event.clientY - rect.top) / rect.height) * H;
    const w = Math.floor((sx - left) / (cell + gap)), d = Math.floor((sy - topPad) / (cell + gap));
    const day = heat.weeks[w]?.[d];
    if (day) setPicked({ date: day.date, spent: day.spent });
  };
  const scroller = useRef<HTMLDivElement>(null);
  // Cel mai recent capăt e în dreapta: pe ecrane înguste, harta pornește de acolo.
  useEffect(() => { const node = scroller.current; if (node) node.scrollLeft = node.scrollWidth; }, [heat]);
  return <div>
    <div ref={scroller} style={{ overflowX: "auto", paddingBottom: 4 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W * 1.25} height={H * 1.25} role="img" aria-labelledby={id} onPointerDown={choose} style={{ display: "block", minWidth: W * 1.25 }}>
        <title id={id}>{t("Harta anului: fiecare pătrățel e o zi, culoarea arată cât s-a cheltuit")}</title>
        {heat.months.map((m) => <text key={m.month} x={left + m.week * (cell + gap)} y={10} fontSize={9} fill="var(--cf-muted)">{monthName(m.month)}</text>)}
        {["L", "", "Mi", "", "V", "", ""].map((label, d) => label && <text key={d} x={0} y={topPad + d * (cell + gap) + 9} fontSize={8} fill="var(--cf-muted)">{label}</text>)}
        {heat.weeks.map((week, w) => week.map((day, d) => day && <rect key={day.date} x={left + w * (cell + gap)} y={topPad + d * (cell + gap)} width={cell} height={cell} rx={2.5} fill={HEAT[day.heat]} stroke={picked?.date === day.date ? "var(--cf-ink)" : "none"} strokeWidth={1.5} />))}
      </svg>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 6, fontSize: 12, color: "var(--cf-muted)", flexWrap: "wrap" }}>
      <span aria-live="polite" style={{ color: "var(--cf-ink)", fontWeight: 600 }}>{picked ? `${formatDate(picked.date, { weekday: "short", day: "numeric", month: "long" })}: ${picked.spent > 0 ? lei(Math.round(picked.spent)) : t("fără cheltuieli")}` : t("Atingeți o zi")}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 3 }}>{t("puțin")}{HEAT.map((color) => <i key={color} style={{ width: 11, height: 11, borderRadius: 3, background: color }} />)}{t("mult")}</span>
    </div>
  </div>;
}

export function Treemap({ items, height = 240 }: { items: Array<{ name: string; amount: number }>; height?: number }) {
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const W = 320;
  const rects = useMemo(() => squarify(items, W, height), [items, height]);
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const entered = useEntered();
  return <div>
    <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={t("Categoriile ca dreptunghiuri, pe măsura sumei")} style={{ width: "100%", height: "auto", display: "block", borderRadius: 14, overflow: "hidden" }}>
      {rects.map((r, i) => {
        const big = r.w > 70 && r.h > 36;
        return <g key={r.name} onClick={() => setPicked(picked === r.name ? undefined : r.name)} style={{ cursor: "pointer", opacity: entered ? 1 : 0, transition: reducedMotion() ? undefined : `opacity .4s ease ${i * 40}ms` }}>
          <rect x={r.x + 1} y={r.y + 1} width={Math.max(0, r.w - 2)} height={Math.max(0, r.h - 2)} rx={8} fill={categoryColor(r.name)} opacity={picked && picked !== r.name ? 0.35 : 0.92} />
          {big && <text x={r.x + 9} y={r.y + 19} fontSize={12} fontWeight={700} fill="#fff">{t(r.name).slice(0, Math.floor(r.w / 7.5))}</text>}
          {big && <text x={r.x + 9} y={r.y + 34} fontSize={11} fill="#fff" opacity={0.9}>{Math.round((r.amount / Math.max(1, total)) * 100)}%</text>}
        </g>;
      })}
    </svg>
    <p aria-live="polite" style={{ margin: "8px 0 0", fontWeight: 600, minHeight: 22 }}>{picked ? `${t(picked)}: ${lei(Math.round(items.find((item) => item.name === picked)?.amount || 0))}` : t("Atingeți un dreptunghi")}</p>
  </div>;
}
