/**
 * Semnul casei-plic — același desen ca iconița de instalare.
 */
export function BrandMark({ size = 44 }: { size?: number }) {
  return (
    <span className="os-mark" aria-hidden="true">
      <svg viewBox="0 0 108 108" width={size} height={size} role="img">
        <rect width="108" height="108" rx="24" fill="#E8F3EC" />
        <path fill="#FFFAF3" stroke="#1B4F42" strokeWidth="2.6" d="M32 48h44c3.3 0 6 2.4 6 5.6v22.8c0 3.2-2.7 5.6-6 5.6H32c-3.3 0-6-2.4-6-5.6V53.6c0-3.2 2.7-5.6 6-5.6z" />
        <path fill="#C4E4D4" d="M30.5 47.9 54 71.4 77.5 47.9Z" />
        <path fill="none" stroke="#1B4F42" strokeWidth="2.2" strokeLinejoin="round" d="M30.5 47.9 54 71.4 77.5 47.9" />
        <path fill="#1B4F42" d="M25 49.3 54 24.4 83 49.3Z" />
        <path fill="#FFFAF3" d="M34.7 47.9 54 31.3 73.4 47.9Z" />
      </svg>
    </span>
  );
}
