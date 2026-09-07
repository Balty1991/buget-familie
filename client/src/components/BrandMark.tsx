/**
 * Semnul Household OS — cub-plic, ca în preview.
 */
export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <span className="os-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" width={size} height={size}>
        <path
          d="M5.5 11.5 16 5.5l10.5 6v11.2c0 .9-.5 1.7-1.3 2.1L16 28.5 6.8 24.8c-.8-.4-1.3-1.2-1.3-2.1V11.5Z"
          fill="currentColor"
          fillOpacity="0.14"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path d="M5.5 11.5 16 17.2l10.5-5.7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M16 17.2V28.4" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.7" />
      </svg>
    </span>
  );
}
