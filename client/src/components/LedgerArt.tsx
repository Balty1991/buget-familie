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

export function CashNote({ amount, caption }: { amount: string; caption: string }) {
  return (
    <div className="bf-cash-note">
      <svg viewBox="0 0 200 112" aria-hidden="true">
        <rect x="4" y="6" width="192" height="100" rx="10" className="bf-cash-note-body" />
        <rect x="12" y="14" width="176" height="84" rx="6" className="bf-cash-note-frame" />
        <circle cx="40" cy="56" r="16" className="bf-cash-note-rosette" />
        <circle cx="160" cy="56" r="16" className="bf-cash-note-rosette" />
        <text x="100" y="38" textAnchor="middle" className="bf-cash-note-mark">RON</text>
      </svg>
      <small>{caption}</small>
      <b>{amount}</b>
    </div>
  );
}

export function PaydayStrip({ elapsed, total, remaining }: { elapsed: number; total: number; remaining: number }) {
  const shown = Math.min(total, 12);
  const stride = total > shown ? total / shown : 1;

  return (
    <div className="bf-payday-strip" aria-label={`${remaining} zile până la venit`}>
      <div>
        <small>PÂNĂ LA VENIT</small>
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
