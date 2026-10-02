/**
 * Imaginea „Anul vostru”, în format de poveste (1080×1920). Implicit doar procente și
 * numărări: zilele notate, seria, zilele fără cheltuieli spun povestea fără salariu.
 */
import { categoryColor } from "@/lib/category-color";
import { fit, roundRect } from "@/lib/month-share-card";
import { t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";
import type { YearRecap } from "@/lib/year-recap";

export const YEAR_CARD_SIZE = { width: 1080, height: 1920 } as const;
const FONT_SANS = '"IBM Plex Sans", system-ui, sans-serif';
const FONT_DISPLAY = "Fraunces, Georgia, serif";

/** Cifra mare: cât a rămas din venit, altfel zilele notate. */
export function yearCardHeadline(recap: YearRecap, showAmounts: boolean): { kicker: string; value: string; note: string } {
  if (recap.keptShare !== undefined && recap.keptShare > 0) {
    return showAmounts
      ? { kicker: t("AU RĂMAS ÎN CASĂ"), value: lei(recap.income - recap.spent), note: t("{share}% din ce a intrat în {year}", { share: Math.round(recap.keptShare * 100), year: recap.year }) }
      : { kicker: t("AU RĂMAS ÎN CASĂ"), value: `${Math.round(recap.keptShare * 100)}%`, note: t("din ce a intrat în {year}", { year: recap.year }) };
  }
  return { kicker: t("AM ȚINUT BUGETUL LA ZI"), value: String(recap.loggedDays), note: t("zile cu mișcările notate") };
}

export function drawYearCard(ctx: CanvasRenderingContext2D, recap: YearRecap, familyName: string, showAmounts: boolean) {
  const { width: W, height: H } = YEAR_CARD_SIZE;
  const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0, "#0b3a30");
  bg.addColorStop(0.55, "#145c49");
  bg.addColorStop(1, "#1d7a5f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = (x: number, y: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  glow(W, 0, 760, "rgba(125, 207, 171, 0.32)");
  glow(0, H * 0.62, 640, "rgba(212, 176, 106, 0.20)");

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 44px ${FONT_DISPLAY}`;
  ctx.fillText("Buget", 80, 140);
  const brand = ctx.measureText("Buget ").width;
  ctx.fillStyle = "#7dcfab";
  ctx.font = `600 26px ${FONT_SANS}`;
  ctx.fillText("FAMILIE", 80 + brand, 140);
  ctx.textAlign = "right";
  ctx.fillStyle = "#f3d9a4";
  ctx.font = `600 64px ${FONT_DISPLAY}`;
  ctx.fillText(String(recap.year), W - 80, 146);
  ctx.textAlign = "left";

  ctx.fillStyle = "#ffffff";
  ctx.font = `600 84px ${FONT_DISPLAY}`;
  ctx.fillText(fit(ctx, familyName, W - 160), 80, 300);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = `500 36px ${FONT_SANS}`;
  ctx.fillText(t("anul nostru în buget"), 80, 360);

  const head = yearCardHeadline(recap, showAmounts);
  roundRect(ctx, 64, 420, W - 128, 340, 44);
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#7dcfab";
  ctx.font = `600 30px ${FONT_SANS}`;
  ctx.fillText(head.kicker, 112, 500);
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 150px ${FONT_DISPLAY}`;
  ctx.fillText(fit(ctx, head.value, W - 224), 106, 652);
  ctx.fillStyle = "rgba(255,255,255,0.84)";
  ctx.font = `500 34px ${FONT_SANS}`;
  ctx.fillText(fit(ctx, head.note, W - 224), 112, 716);

  const tiles: Array<[string, string]> = [
    [String(recap.loggedDays), t("zile notate")],
    [String(recap.longestStreak), t("zile la rând, cea mai lungă serie")],
    [String(recap.noSpendDays), t("zile fără cheltuieli")],
    [String(recap.moves), t("mișcări la locul lor")],
  ];
  const tileW = (W - 160 - 24) / 2;
  tiles.forEach(([value, label], index) => {
    const x = 80 + (index % 2) * (tileW + 24);
    const y = 820 + Math.floor(index / 2) * 184;
    roundRect(ctx, x, y, tileW, 160, 32);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 72px ${FONT_DISPLAY}`;
    ctx.fillText(value, x + 32, y + 86);
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = `500 26px ${FONT_SANS}`;
    ctx.fillText(fit(ctx, label, tileW - 64), x + 32, y + 132);
  });

  ctx.fillStyle = "#ffffff";
  ctx.font = `600 40px ${FONT_SANS}`;
  ctx.fillText(t("Unde s-au dus banii"), 80, 1260);
  recap.categories.slice(0, 4).forEach((item, index) => {
    const y = 1310 + index * 84;
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 32px ${FONT_SANS}`;
    ctx.fillText(fit(ctx, t(item.name), 560), 80, y + 30);
    ctx.textAlign = "right";
    ctx.fillText(showAmounts ? lei(item.amount) : `${Math.round(item.share * 100)}%`, W - 80, y + 30);
    ctx.textAlign = "left";
    roundRect(ctx, 80, y + 46, W - 160, 14, 7);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fill();
    roundRect(ctx, 80, y + 46, Math.max(14, (W - 160) * item.share), 14, 7);
    ctx.fillStyle = categoryColor(item.name);
    ctx.fill();
  });

  if (recap.topPlace) {
    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.font = `500 32px ${FONT_SANS}`;
    ctx.fillText(fit(ctx, t("Locul nostru: {place} · {visits} vizite", { place: recap.topPlace.name, visits: recap.topPlace.visits }), W - 160), 80, 1690);
  }

  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(80, 1752, W - 160, 2);
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 32px ${FONT_SANS}`;
  ctx.fillText(t("Ne facem bugetul cu Buget Familie"), 80, 1812);
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = `500 26px ${FONT_SANS}`;
  ctx.fillText(t("Gratuit pe Google Play · fără parola băncii"), 80, 1854);
}

export async function renderYearCard(recap: YearRecap, familyName: string, showAmounts: boolean): Promise<Blob> {
  try { await document.fonts?.ready; } catch { /* fără Font Loading API */ }
  const canvas = document.createElement("canvas");
  canvas.width = YEAR_CARD_SIZE.width;
  canvas.height = YEAR_CARD_SIZE.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  drawYearCard(ctx, recap, familyName, showAmounts);
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("png"))), "image/png"));
}
