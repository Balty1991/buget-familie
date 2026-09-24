import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";

/**
 * Codul QR al invitației (testarea cu utilizatori, C4): al doilea telefon îl scanează cu
 * camera și deschide linkul. Desenat din module, pe fond alb, ca să se citească pe orice temă.
 */
export function InviteQr({ link }: { link: string }) {
  const [cells, setCells] = useState<{ size: number; path: string } | null>(null);
  useEffect(() => {
    let active = true;
    void import("qrcode-generator").then(({ default: qrcode }) => {
      const qr = qrcode(0, "M");
      qr.addData(link);
      qr.make();
      const size = qr.getModuleCount();
      let path = "";
      for (let row = 0; row < size; row += 1) {
        for (let col = 0; col < size; col += 1) if (qr.isDark(row, col)) path += `M${col} ${row}h1v1h-1z`;
      }
      if (active) setCells({ size, path });
    });
    return () => { active = false; };
  }, [link]);
  if (!cells) return <p className="bf-helper">{t("Pregătim codul QR…")}</p>;
  const margin = 4;
  const box = cells.size + margin * 2;
  return (
    <figure className="bf-invite-qr">
      <svg viewBox={`0 0 ${box} ${box}`} role="img" aria-label={t("Codul QR al invitației")} shapeRendering="crispEdges">
        <rect width={box} height={box} fill="#ffffff" />
        <path d={cells.path} transform={`translate(${margin} ${margin})`} fill="#000000" />
      </svg>
      <figcaption>{t("Scanează-l cu camera celuilalt telefon. Pe Android, apasă apoi „Deschide în aplicație”.")}</figcaption>
    </figure>
  );
}
