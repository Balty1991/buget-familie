/**
 * Semnul Household OS — cub-plic 3D, același cu iconița de instalare.
 */
export function BrandMark({ size = 44 }: { size?: number }) {
  return (
    <span className="os-mark" aria-hidden="true">
      <img
        src={`${import.meta.env.BASE_URL}icons/icon-192.png`}
        alt=""
        width={size}
        height={size}
        decoding="async"
      />
    </span>
  );
}
