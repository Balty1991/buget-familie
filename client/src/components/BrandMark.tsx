/**
 * Semnul 3D casă-plic — același PNG ca la instalarea pe telefon.
 */
export function BrandMark({ size = 40 }: { size?: number }) {
  const src = `${import.meta.env.BASE_URL}icons/icon-192.png?v=21`;
  return <img className="bf-brand-mark-img" src={src} width={size} height={size} alt="" decoding="async" />;
}
