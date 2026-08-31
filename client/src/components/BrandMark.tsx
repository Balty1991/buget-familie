/**
 * Semnul 3D casă-plic din antet — același fișier ca iconița de pe telefon.
 */
export function BrandMark({ size = 36 }: { size?: number }) {
  const src = `${import.meta.env.BASE_URL}icons/icon-192.png`;
  return <img className="bf-brand-mark-img" src={src} width={size} height={size} alt="" decoding="async" />;
}
