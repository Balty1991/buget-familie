/**
 * Sigla plicului, vectorul din bf-favicon.svg. Fără filtre care o întunecă.
 */
export function BrandMark({ size = 44 }: { size?: number }) {
  return (
    <span className="os-mark" style={{ width: size, height: size }} aria-hidden="true">
      <img
        src={`${import.meta.env.BASE_URL}bf-favicon.svg`}
        alt=""
        width={size}
        height={size}
        decoding="sync"
        fetchPriority="high"
      />
    </span>
  );
}
