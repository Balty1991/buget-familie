/**
 * Imaginea lunii, de trimis pe WhatsApp sau Instagram: ce a rămas și unde s-au dus banii.
 * Implicit fără sume (doar procente), ca un părinte să o poată pune pe o poveste fără
 * să-și arate salariul. Se desenează pe telefon, într-un canvas; nimic nu pleacă singur.
 */
import { categoryColor } from "@/lib/category-color";
import type { MonthlyFamilyReport } from "@/lib/household-insights";
import { t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";
import { isNativeApp } from "@/lib/app-storage";

export const MONTH_CARD_SIZE = { width: 1080, height: 1350 } as const;

export type MonthCardSlice = { name: string; share: number; amount: number; color: string };

/** Felii pentru diagramă: primele 4 categorii, restul strânse în „Altele”. Procentele dau 100. */
export function monthCardSlices(report: MonthlyFamilyReport): MonthCardSlice[] {
  const total = report.categories.reduce((sum, item) => sum + item.amount, 0);
  if (total <= 0) return [];
  const top = report.categories.slice(0, 4);
  const rest = report.expense > 0 ? Math.max(0, report.expense - top.reduce((sum, item) => sum + item.amount, 0)) : 0;
  const base = report.expense > 0 ? Math.max(report.expense, total) : total;
  const slices = top.map((item) => ({ name: item.name, amount: item.amount, share: item.amount / base, color: categoryColor(item.name) }));
  if (rest >= 1) slices.push({ name: "Altele", amount: rest, share: rest / base, color: "#9AA6A0" });
  return slices;
}

/** Fraza mare a imaginii: cu sume sau doar cu procente. */
export function monthCardHeadline(report: MonthlyFamilyReport, showAmounts: boolean): { kicker: string; value: string; note: string } {
  if (report.cashflow >= 0 && report.income > 0) {
    const share = Math.round((report.keptShare ?? 0) * 100);
    return showAmounts
      ? { kicker: t("AU RĂMAS ÎN CASĂ"), value: lei(report.cashflow), note: t("{share}% din ce a intrat luna asta", { share }) }
      : { kicker: t("AU RĂMAS ÎN CASĂ"), value: `${share}%`, note: t("din ce a intrat luna asta") };
  }
  if (report.cashflow < 0) {
    return showAmounts
      ? { kicker: t("LUNĂ STRÂNSĂ"), value: lei(-report.cashflow), note: t("peste venit — luna viitoare refacem planul") }
      : { kicker: t("LUNĂ STRÂNSĂ"), value: t("Plan nou"), note: t("am cheltuit peste venit, ne reorganizăm") };
  }
  return showAmounts
    ? { kicker: t("AM CHELTUIT"), value: lei(report.expense), note: t("fiecare leu notat, la locul lui") }
    : { kicker: t("LUNA NOTATĂ"), value: `${report.categories.length}`, note: t("categorii urmărite, fiecare leu la locul lui") };
}

const FONT_SANS = '"IBM Plex Sans", system-ui, sans-serif';
const FONT_DISPLAY = 'Fraunces, Georgia, serif';

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

/** Taie textul cu „…” ca să încapă în lățimea dată. */
const fit = (ctx: CanvasRenderingContext2D, text: string, width: number) => {
  if (ctx.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
};

/** Desenează imaginea pe un canvas dat (folosit și în teste cu un context fals). */
export function drawMonthCard(ctx: CanvasRenderingContext2D, report: MonthlyFamilyReport, showAmounts: boolean) {
  const { width: W, height: H } = MONTH_CARD_SIZE;
  // Fundal: verdele aplicației, cu două lumini moi.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0d3f33");
  bg.addColorStop(1, "#176b54");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = (x: number, y: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  glow(W * 0.95, H * 0.05, 620, "rgba(125, 207, 171, 0.35)");
  glow(W * 0.05, H * 0.95, 520, "rgba(212, 176, 106, 0.22)");

  // Antet: sigla scrisă și luna.
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 44px ${FONT_DISPLAY}`;
  ctx.fillText("Buget", 80, 128);
  const brandWidth = ctx.measureText("Buget ").width;
  ctx.fillStyle = "#7dcfab";
  ctx.font = `600 26px ${FONT_SANS}`;
  ctx.fillText("FAMILIE", 80 + brandWidth, 128);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = `600 28px ${FONT_SANS}`;
  ctx.fillText(report.title.toLocaleUpperCase(), W - 80, 126);
  ctx.textAlign = "left";

  // Titlul: familia.
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 76px ${FONT_DISPLAY}`;
  ctx.fillText(fit(ctx, report.familyName, W - 160), 80, 262);
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = `500 34px ${FONT_SANS}`;
  ctx.fillText(t("luna noastră, pe scurt"), 80, 318);

  // Cifra mare.
  const head = monthCardHeadline(report, showAmounts);
  roundRect(ctx, 64, 372, W - 128, 300, 40);
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#7dcfab";
  ctx.font = `600 28px ${FONT_SANS}`;
  ctx.fillText(head.kicker, 112, 444);
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 132px ${FONT_DISPLAY}`;
  ctx.fillText(fit(ctx, head.value, W - 224), 108, 578);
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = `500 32px ${FONT_SANS}`;
  ctx.fillText(fit(ctx, head.note, W - 224), 112, 632);

  // Diagrama: unde s-au dus banii.
  const slices = monthCardSlices(report);
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 40px ${FONT_SANS}`;
  ctx.fillText(t("Unde s-au dus banii"), 80, 768);
  const cx = 250, cy = 972, r = 150, ring = 56;
  if (slices.length) {
    let start = -Math.PI / 2;
    for (const slice of slices) {
      const end = start + slice.share * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, start, end);
      ctx.strokeStyle = slice.color;
      ctx.lineWidth = ring;
      ctx.stroke();
      start = end;
    }
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = ring;
    ctx.stroke();
  }
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 54px ${FONT_DISPLAY}`;
  ctx.fillText(`${slices.length ? Math.round(slices[0].share * 100) : 0}%`, cx, cy + 6);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = `500 24px ${FONT_SANS}`;
  ctx.fillText(slices.length ? fit(ctx, t(slices[0].name), r * 1.4) : t("fără cheltuieli"), cx, cy + 46);
  ctx.textAlign = "left";

  // Legenda.
  const lx = 480;
  slices.forEach((slice, index) => {
    const y = 838 + index * 74;
    roundRect(ctx, lx, y - 26, 30, 30, 9);
    ctx.fillStyle = slice.color;
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 34px ${FONT_SANS}`;
    ctx.fillText(fit(ctx, t(slice.name), 330), lx + 50, y);
    ctx.textAlign = "right";
    ctx.font = `600 34px ${FONT_SANS}`;
    ctx.fillText(`${Math.round(slice.share * 100)}%`, W - 80, y);
    if (showAmounts) {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = `500 24px ${FONT_SANS}`;
      ctx.fillText(lei(slice.amount), W - 80, y + 30);
    }
    ctx.textAlign = "left";
  });

  // Subsol: de unde e aplicația.
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(80, 1206, W - 160, 2);
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 32px ${FONT_SANS}`;
  ctx.fillText(t("Ne facem bugetul cu Buget Familie"), 80, 1262);
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = `500 26px ${FONT_SANS}`;
  ctx.fillText(t("Gratuit pe Google Play · fără parola băncii"), 80, 1302);
}

/** Imaginea ca PNG. Așteaptă fonturile aplicației, ca textul să nu iasă în fontul de rezervă. */
export async function renderMonthCard(report: MonthlyFamilyReport, showAmounts: boolean): Promise<Blob> {
  try { await document.fonts?.ready; } catch { /* fără Font Loading API: fontul de sistem */ }
  const canvas = document.createElement("canvas");
  canvas.width = MONTH_CARD_SIZE.width;
  canvas.height = MONTH_CARD_SIZE.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  drawMonthCard(ctx, report, showAmounts);
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("png"))), "image/png"));
}

const toBase64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(index, index + 0x8000)));
  return btoa(binary);
};

/**
 * Trimite imaginea: pe Android prin lista de aplicații (WhatsApp, Instagram), pe web prin
 * Web Share cu fișier, altfel o descarcă. Întoarce ce s-a întâmplat.
 */
export async function shareMonthCard(blob: Blob, name: string, text: string): Promise<"shared" | "saved" | "cancelled"> {
  if (isNativeApp()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
    const written = await Filesystem.writeFile({ path: name, data: await toBase64(blob), directory: Directory.Cache, recursive: true });
    try {
      await Share.share({ title: name, text, files: [written.uri], dialogTitle: t("Trimite imaginea lunii") });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  const file = typeof File === "function" ? new File([blob], name, { type: "image/png" }) : undefined;
  if (file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "saved";
}
