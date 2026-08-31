import { useId } from "react";

type HealthTone = "good" | "watch" | "risk";

/**
 * Cadran analogic 0–100 pentru scorul de sănătate. Doar desen; scorul vine din calculateHealthScore.
 */
export function HealthGauge({ score, tone, size = 120 }: { score: number; tone: HealthTone; size?: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const angle = -90 + clamped * 1.8;
  const gid = useId().replace(/:/g, "");
  const ticks = [0, 25, 50, 75, 100];

  return (
    <svg
      className={`bf-health-gauge ${tone}`}
      viewBox="0 0 200 128"
      width={size}
      height={size * 128 / 200}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Scor ${clamped} din 100`}
    >
      <defs>
        <linearGradient id={`${gid}-arc`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.45" />
          <stop offset="100%" stopColor="currentColor" />
        </linearGradient>
      </defs>
      <path className="bf-health-gauge-track" d="M22 108 A 78 78 0 0 1 178 108" fill="none" pathLength="100" />
      <path
        className="bf-health-gauge-arc"
        d="M22 108 A 78 78 0 0 1 178 108"
        fill="none"
        pathLength="100"
        stroke={`url(#${gid}-arc)`}
        strokeDasharray={`${clamped} 100`}
      />
      {ticks.map((tick) => {
        const t = (tick / 100) * Math.PI;
        const x1 = 100 + Math.cos(Math.PI - t) * 70;
        const y1 = 108 - Math.sin(t) * 70;
        const x2 = 100 + Math.cos(Math.PI - t) * 78;
        const y2 = 108 - Math.sin(t) * 78;
        return <line key={tick} className="bf-health-gauge-tick" x1={x1} y1={y1} x2={x2} y2={y2} />;
      })}
      <text className="bf-health-gauge-end" x="22" y="124" textAnchor="middle">0</text>
      <text className="bf-health-gauge-end" x="178" y="124" textAnchor="middle">100</text>
      <g transform={`rotate(${angle} 100 108)`}>
        <polygon className="bf-health-needle" points="100,36 104,108 96,108" />
        <circle className="bf-health-needle-hub" cx="100" cy="108" r="6" />
      </g>
      <text className="bf-health-gauge-score" x="100" y="92" textAnchor="middle">{clamped}</text>
    </svg>
  );
}

/** Bancnotă: textul stă în fereastra centrală, rozetele rămân în colțuri. */
export function CashNote({ amount, caption }: { amount: string; caption: string }) {
  const compact = amount.length > 14;
  return (
    <figure className="bf-cash-note">
      <svg viewBox="0 0 320 168" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${caption} ${amount}`}>
        <rect className="bf-cash-note-body" x="8" y="10" width="304" height="148" rx="18" />
        <rect className="bf-cash-note-frame" x="22" y="24" width="276" height="120" rx="12" />
        <circle className="bf-cash-note-rosette" cx="44" cy="46" r="11" />
        <circle className="bf-cash-note-rosette" cx="276" cy="46" r="11" />
        <circle className="bf-cash-note-rosette" cx="44" cy="122" r="11" />
        <circle className="bf-cash-note-rosette" cx="276" cy="122" r="11" />
        <circle className="bf-cash-note-rosette inner" cx="44" cy="46" r="5" />
        <circle className="bf-cash-note-rosette inner" cx="276" cy="46" r="5" />
        <circle className="bf-cash-note-rosette inner" cx="44" cy="122" r="5" />
        <circle className="bf-cash-note-rosette inner" cx="276" cy="122" r="5" />
        <text className="bf-cash-note-mark" x="160" y="54" textAnchor="middle">RON</text>
        <text className="bf-cash-note-caption" x="160" y="86" textAnchor="middle">{caption}</text>
        <text className={`bf-cash-note-amount${compact ? " compact" : ""}`} x="160" y="128" textAnchor="middle">{amount}</text>
      </svg>
    </figure>
  );
}

export function PaydayStrip({ elapsed, total, remaining }: { elapsed: number; total: number; remaining: number }) {
  const shown = Math.min(total, 12);
  const stride = total > shown ? total / shown : 1;

  return (
    <div className="bf-payday-strip" aria-label={`${remaining} zile până la venit`}>
      <div className="bf-payday-copy">
        <small>Până la venit</small>
        <b>{remaining === 0 ? "Astăzi" : `${remaining} ${remaining === 1 ? "zi" : "zile"}`}</b>
      </div>
      <ol>
        {Array.from({ length: shown }, (_, index) => {
          const day = Math.round(index * stride) + 1;
          const past = day <= elapsed;
          const payday = index === shown - 1;
          return (
            <li key={index} className={`${past ? "past" : ""} ${payday ? "payday" : ""}`.trim()}>
              <i />
              <span>{payday ? "Venit" : day}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
