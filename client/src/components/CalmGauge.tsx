import { t } from "@/lib/i18n";
function polar(cx: number, cy: number, r: number, angle: number) {
  const a = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  const large = end - start <= 180 ? 0 : 1;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
}

/**
 * Arc OLED din preview — scorul e în mijloc, fără ac analog.
 * `value` poate fi `null`: atunci registrul nu are încă din ce da o notă, iar cadranul
 * arată o liniuță în loc de un număr inventat.
 */
export function CalmGauge({ value }: { value: number | null }) {
  const unknown = value === null;
  const clamped = unknown ? 0 : Math.max(0, Math.min(100, Math.round(value)));
  const start = -120;
  const sweep = 240;
  const end = start + (clamped / 100) * sweep;
  const label = unknown ? t("ÎNCĂ NU") : clamped >= 72 ? "CALM" : clamped >= 45 ? t("ATENȚIE") : "TENS.";
  const ticks = Array.from({ length: 25 }, (_, i) => {
    const angle = start + (i / 24) * sweep;
    return {
      outer: polar(50, 54, 38, angle),
      inner: polar(50, 54, i % 4 === 0 ? 32 : 34.5, angle),
      major: i % 4 === 0,
    };
  });

  return (
    <svg viewBox="0 0 100 92" className="bf-calm-gauge" role="img" aria-label={unknown ? t("Scor indisponibil: încă nu sunt destule date.") : `Scor ${clamped} din 100, ${label}`}>
      <path d={arcPath(50, 54, 36, start, start + sweep)} fill="none" className="bf-calm-track" />
      {!unknown && <path d={arcPath(50, 54, 36, start, end)} fill="none" className="bf-calm-arc" />}
      {ticks.map((tick, index) => (
        <line
          key={index}
          x1={tick.inner.x}
          y1={tick.inner.y}
          x2={tick.outer.x}
          y2={tick.outer.y}
          className={tick.major ? "bf-calm-tick major" : "bf-calm-tick"}
        />
      ))}
      <text x="50" y="52" textAnchor="middle" className="bf-calm-score" style={{ fill: "var(--os-fg, var(--cf-ink, #f2f7ff))" }}>{unknown ? "—" : clamped}</text>
      <text x="50" y="66" textAnchor="middle" className="bf-calm-label" style={{ fill: "var(--os-muted, var(--cf-muted, #9aa8a1))" }}>{label}</text>
    </svg>
  );
}
