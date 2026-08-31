import { useId } from "react";

export type EnvelopeState = "healthy" | "watch" | "over";

const sealLetter: Record<EnvelopeState, string> = {
  healthy: "OK",
  watch: "!",
  over: "X",
};

/**
 * Plic de hârtie: umplerea arată cât a rămas, sigiliul arată starea.
 * Păstrează raportul de aspect — nu se întinde în carduri înalte.
 */
export function EnvelopeMark({
  remaining = 1,
  state = "healthy",
  size = 64,
}: {
  remaining?: number;
  state?: EnvelopeState;
  size?: number;
}) {
  const raw = useId().replace(/:/g, "");
  const clip = `env${raw}`;
  const fill = Math.max(0, Math.min(1, remaining));
  const bodyTop = 18;
  const bodyHeight = 34;
  const height = bodyHeight * fill;
  const y = bodyTop + bodyHeight - height;

  return (
    <svg
      className={`bf-envelope-mark ${state}`}
      viewBox="0 0 80 62"
      width={size}
      height={size * 62 / 80}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clip}>
          <rect x="6" y={bodyTop} width="68" height={bodyHeight} rx="3.5" />
        </clipPath>
      </defs>
      <ellipse cx="40" cy="56" rx="26" ry="3" className="bf-envelope-shadow" />
      <rect className="bf-envelope-body" x="6" y={bodyTop} width="68" height={bodyHeight} rx="3.5" />
      <rect className="bf-envelope-fill" x="6" y={y} width="68" height={height} clipPath={`url(#${clip})`} />
      <path className="bf-envelope-flap" d="M6 18 L40 38 L74 18" />
      <path className="bf-envelope-lip" d="M6 18 H74 L40 36 Z" />
      <circle className="bf-envelope-seal" cx="63" cy="22" r="7" />
      <text className="bf-envelope-seal-text" x="63" y="25" textAnchor="middle">{sealLetter[state]}</text>
    </svg>
  );
}

export function EnvelopeStack({ fill = 0.6, size = 128 }: { fill?: number; size?: number }) {
  const layers = [
    { remaining: Math.max(0.18, fill - 0.28), state: "watch" as EnvelopeState, size: size * 0.78 },
    { remaining: Math.max(0.28, fill - 0.12), state: "healthy" as EnvelopeState, size: size * 0.9 },
    { remaining: fill, state: (fill < 0.28 ? "over" : fill < 0.55 ? "watch" : "healthy") as EnvelopeState, size },
  ];
  return (
    <div className="bf-envelope-stack" style={{ width: size, height: size * 0.72 }} aria-hidden="true">
      {layers.map((layer, index) => (
        <span key={index} className={`layer-${index}`}>
          <EnvelopeMark remaining={layer.remaining} state={layer.state} size={layer.size} />
        </span>
      ))}
    </div>
  );
}

export function EnvelopeEmptyArt({ size = 88 }: { size?: number }) {
  return (
    <svg className="bf-envelope-empty-art" viewBox="0 0 120 86" width={size} height={size * 86 / 120} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <ellipse cx="60" cy="78" rx="36" ry="4" className="bf-envelope-shadow" />
      <g transform="rotate(-12 38 48)">
        <rect x="8" y="28" width="52" height="30" rx="3" className="bf-envelope-body" />
        <path d="M8 28 L34 46 L60 28" className="bf-envelope-flap" />
      </g>
      <g transform="rotate(10 86 46)">
        <rect x="58" y="24" width="52" height="30" rx="3" className="bf-envelope-body" />
        <path d="M58 24 L84 42 L110 24" className="bf-envelope-flap" />
      </g>
      <rect x="26" y="36" width="68" height="36" rx="4" className="bf-envelope-body" />
      <path d="M26 36 L60 58 L94 36" className="bf-envelope-flap" />
      <path d="M26 36 H94 L60 54 Z" className="bf-envelope-lip" />
      <circle cx="88" cy="40" r="8" className="bf-envelope-seal" />
    </svg>
  );
}

export function EnvelopeDeskScene({ size = 220 }: { size?: number }) {
  return (
    <svg className="bf-desk-scene" viewBox="0 0 240 140" width={size} height={size * 140 / 240} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect x="8" y="18" width="224" height="108" rx="10" className="bf-desk-blotter-art" />
      <line x1="24" y1="44" x2="216" y2="44" className="bf-desk-rule" />
      <line x1="24" y1="62" x2="168" y2="62" className="bf-desk-rule" />
      <line x1="24" y1="80" x2="184" y2="80" className="bf-desk-rule" />
      <g transform="translate(28 54) rotate(-8)">
        <rect width="54" height="32" rx="3" className="bf-envelope-body" />
        <path d="M0 0 L27 18 L54 0" className="bf-envelope-flap" />
      </g>
      <g transform="translate(86 48)">
        <rect width="62" height="36" rx="3" className="bf-envelope-body" />
        <path d="M0 0 L31 20 L62 0" className="bf-envelope-flap" />
        <circle cx="48" cy="6" r="6" className="bf-envelope-seal" />
      </g>
      <g transform="translate(154 58) rotate(9)">
        <rect width="50" height="30" rx="3" className="bf-envelope-body" />
        <path d="M0 0 L25 16 L50 0" className="bf-envelope-flap" />
      </g>
      <g className="bf-desk-pencil" transform="translate(188 28) rotate(22)">
        <rect width="36" height="6" rx="1.5" />
        <polygon points="36,0 44,3 36,6" />
      </g>
    </svg>
  );
}
