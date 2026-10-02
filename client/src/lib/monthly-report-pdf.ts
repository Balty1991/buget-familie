/**
 * Raportul lunar în PDF, desenat pe telefon. Fiecare pagină A4 se desenează într-un canvas cu
 * fonturile aplicației (cu diacritice, în limba aleasă) și intră în PDF ca imagine: jsPDF nu
 * are fonturi cu „ș” și „ț”, iar vechiul raport le scotea („Bilant”). Nimic nu pleacă de pe telefon.
 */
import { allocationStatus, formatDate, isBalanceAdjustment, isoToday, type AppData, type Transaction } from "@/lib/finance-data";
import { categoryColor } from "@/lib/category-color";
import { fit, roundRect } from "@/lib/month-share-card";
import { getLocale, t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";
import { monthlyBalanceSnapshot } from "@/lib/monthly-balance-pdf";
import { subscriptionSpend } from "@/lib/household-insights";
import { saveExport } from "@/lib/save-export";

type Slice = { name: string; amount: number; prior: number; share: number };
export type MonthlyReportModel = {
  month: string;
  title: string;
  familyName: string;
  perspective: string;
  income: number;
  expense: number;
  cashflow: number;
  priorExpense: number;
  categories: Slice[];
  envelopes: Array<{ label: string; category?: string; spent: number; budget: number }>;
  subscriptions: { monthly: number; yearly: number; count: number };
  moves: Transaction[];
};

const previousMonth = (month: string) => { const [y, m] = month.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; };
const round = (value: number) => Math.round(value * 100) / 100;

/** Cifrele raportului, pentru o lună și (opțional) un singur membru. */
export function monthlyReportModel(data: AppData, month: string, memberId?: string): MonthlyReportModel {
  const snap = monthlyBalanceSnapshot(data, month, memberId);
  const real = snap.transactions.filter((item) => !isBalanceAdjustment(item));
  const prior = monthlyBalanceSnapshot(data, previousMonth(month), memberId).transactions.filter((item) => !isBalanceAdjustment(item) && item.kind === "expense");
  const totals = new Map<string, number>();
  for (const item of real) if (item.kind === "expense") totals.set(item.category, (totals.get(item.category) || 0) + item.amount);
  const priorBy = new Map<string, number>();
  for (const item of prior) priorBy.set(item.category, (priorBy.get(item.category) || 0) + item.amount);
  const expense = snap.balance.expense;
  const categories = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]).map(([name, amount]) => ({ name, amount: round(amount), prior: round(priorBy.get(name) || 0), share: expense > 0 ? amount / expense : 0 }));
  // Plicurile sunt ale ciclului de acum: au sens doar în raportul lunii curente.
  const envelopes = month === isoToday().slice(0, 7) && !memberId
    ? data.settings.salaryPlan.allocations.map((item) => { const status = allocationStatus(data, item); return { label: item.label, category: item.category, spent: round(status.spent), budget: round(status.budget) }; }).filter((item) => item.budget > 0).slice(0, 10)
    : [];
  const title = new Intl.DateTimeFormat(getLocale(), { month: "long", year: "numeric" }).format(new Date(`${month}-01T12:00:00`));
  return {
    month,
    title: title.charAt(0).toLocaleUpperCase() + title.slice(1),
    familyName: data.settings.familyName || t("Familie"),
    perspective: memberId ? data.settings.members.find((member) => member.id === memberId)?.name || "" : "",
    income: round(snap.balance.income),
    expense: round(expense),
    cashflow: round(snap.balance.cashflow),
    priorExpense: round(prior.reduce((sum, item) => sum + item.amount, 0)),
    categories,
    envelopes,
    subscriptions: subscriptionSpend(data),
    moves: real,
  };
}

export const PAGE = { width: 1240, height: 1754 } as const;
const M = 90;
const SANS = '"IBM Plex Sans", system-ui, sans-serif';
const SERIF = "Fraunces, Georgia, serif";
const INK = "#16302a", MUTED = "#5f716a", LINE = "#dfe6e1", GREEN = "#1f6b55", CORAL = "#b5523b";
const ROWS_FIRST = 0, ROWS_PER_PAGE = 34;

const text = (ctx: CanvasRenderingContext2D, value: string, x: number, y: number, font: string, color = INK, align: CanvasTextAlign = "left", max?: number) => {
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align;
  ctx.fillText(max ? fit(ctx, value, max) : value, x, y);
  ctx.textAlign = "left";
};

function footer(ctx: CanvasRenderingContext2D, page: number, pages: number) {
  ctx.fillStyle = LINE; ctx.fillRect(M, PAGE.height - 90, PAGE.width - 2 * M, 2);
  text(ctx, t("Făcut pe telefon cu Buget Familie, {date}", { date: formatDate(isoToday(), { day: "numeric", month: "long", year: "numeric" }) }), M, PAGE.height - 52, `500 20px ${SANS}`, MUTED);
  text(ctx, t("Pagina {page} din {pages}", { page, pages }), PAGE.width - M, PAGE.height - 52, `500 20px ${SANS}`, MUTED, "right");
}

/** Prima pagină: antet, cele trei cifre, unde s-au dus banii, plicurile, abonamentele. */
export function drawSummaryPage(ctx: CanvasRenderingContext2D, model: MonthlyReportModel) {
  const W = PAGE.width;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, PAGE.height);
  const band = ctx.createLinearGradient(0, 0, W, 300);
  band.addColorStop(0, "#0d3f33"); band.addColorStop(1, "#1d7a5f");
  ctx.fillStyle = band; ctx.fillRect(0, 0, W, 300);
  text(ctx, t("BUGET FAMILIE · RAPORT LUNAR"), M, 110, `700 24px ${SANS}`, "#9fdcc0");
  text(ctx, model.title, M, 190, `600 72px ${SERIF}`, "#ffffff", "left", W - 2 * M);
  text(ctx, model.perspective ? `${model.familyName} · ${model.perspective}` : model.familyName, M, 245, `500 30px ${SANS}`, "rgba(255,255,255,0.85)", "left", W - 2 * M);

  // Cele trei cifre.
  const cardW = (W - 2 * M - 2 * 24) / 3;
  const kpis: Array<[string, string, string]> = [
    [t("A intrat"), lei(model.income), GREEN],
    [t("A ieșit"), lei(model.expense), CORAL],
    model.income <= 0 ? [t("Bilanț"), `${model.cashflow < 0 ? "−" : ""}${lei(Math.abs(model.cashflow))}`, model.cashflow < 0 ? CORAL : GREEN] : [model.cashflow >= 0 ? t("A rămas") : t("Peste venit"), lei(Math.abs(model.cashflow)), model.cashflow >= 0 ? GREEN : CORAL],
  ];
  kpis.forEach(([label, value, color], i) => {
    const x = M + i * (cardW + 24), y = 340;
    roundRect(ctx, x, y, cardW, 150, 24); ctx.fillStyle = "#f3f6f4"; ctx.fill();
    text(ctx, label.toLocaleUpperCase(), x + 28, y + 50, `700 20px ${SANS}`, MUTED);
    text(ctx, value, x + 28, y + 112, `600 42px ${SERIF}`, color, "left", cardW - 56);
  });
  let y = 560;
  if (model.priorExpense > 0) {
    const delta = model.expense - model.priorExpense;
    text(ctx, Math.abs(delta) < 1 ? t("Cheltuieli cât luna trecută.") : delta < 0 ? t("Cu {amount} mai puțin decât luna trecută.", { amount: lei(-delta) }) : t("Cu {amount} mai mult decât luna trecută.", { amount: lei(delta) }), M, y, `500 26px ${SANS}`, delta > 0 ? CORAL : GREEN);
    y += 60;
  }

  // Unde s-au dus banii: inel + listă cu suma, procentul și diferența față de luna trecută.
  text(ctx, t("Unde s-au dus banii"), M, y + 10, `600 36px ${SERIF}`);
  y += 50;
  const cx = M + 170, cy = y + 190, r = 140;
  let start = -Math.PI / 2;
  const shown = model.categories.slice(0, 7);
  if (!shown.length) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.strokeStyle = LINE; ctx.lineWidth = 56; ctx.stroke(); }
  for (const slice of model.categories) {
    const end = start + slice.share * Math.PI * 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, start, end); ctx.strokeStyle = categoryColor(slice.name); ctx.lineWidth = 56; ctx.stroke();
    start = end;
  }
  text(ctx, shown[0] ? `${Math.round(shown[0].share * 100)}%` : "—", cx, cy + 14, `600 48px ${SERIF}`, INK, "center");
  const lx = M + 400;
  shown.forEach((slice, i) => {
    const ry = y + 40 + i * 52;
    roundRect(ctx, lx, ry - 20, 22, 22, 6); ctx.fillStyle = categoryColor(slice.name); ctx.fill();
    text(ctx, t(slice.name), lx + 38, ry, `600 26px ${SANS}`, INK, "left", 330);
    text(ctx, lei(slice.amount), W - M - 150, ry, `600 26px ${SANS}`, INK, "right");
    const delta = slice.amount - slice.prior;
    if (model.priorExpense > 0 && Math.abs(delta) >= 1) text(ctx, `${delta > 0 ? "+" : "−"}${lei(Math.abs(delta))}`, W - M, ry, `500 20px ${SANS}`, delta > 0 ? CORAL : GREEN, "right");
  });
  if (!shown.length) text(ctx, t("Nicio cheltuială în luna asta."), lx, y + 60, `500 26px ${SANS}`, MUTED);
  y += 420;

  // Plicurile ciclului (doar în luna curentă).
  if (model.envelopes.length) {
    text(ctx, t("Plicurile, acum"), M, y, `600 36px ${SERIF}`);
    y += 40;
    // Două coloane: încap până la zece plicuri fără a doua pagină.
    const colW = (W - 2 * M - 48) / 2;
    model.envelopes.forEach((env, i) => {
      const x = M + (i % 2) * (colW + 48), ry = y + Math.floor(i / 2) * 76;
      const over = env.spent > env.budget;
      text(ctx, env.label, x, ry + 30, `600 23px ${SANS}`, INK, "left", colW * 0.5);
      text(ctx, t("{spent} din {budget}", { spent: lei(env.spent), budget: lei(env.budget) }), x + colW, ry + 30, `500 19px ${SANS}`, over ? CORAL : MUTED, "right");
      roundRect(ctx, x, ry + 44, colW, 12, 6); ctx.fillStyle = "#e8eeea"; ctx.fill();
      roundRect(ctx, x, ry + 44, Math.max(12, colW * Math.min(1, env.spent / env.budget)), 12, 6); ctx.fillStyle = over ? CORAL : categoryColor(env.category || env.label); ctx.fill();
    });
    y += Math.ceil(model.envelopes.length / 2) * 76;
    y += 20;
  }
  if (model.subscriptions.count && y < PAGE.height - 200) {
    text(ctx, t("Abonamente: {monthly} pe lună · {yearly} pe an.", { monthly: lei(model.subscriptions.monthly), yearly: lei(model.subscriptions.yearly) }), M, y + 20, `500 24px ${SANS}`, MUTED);
  }
}

/** Paginile cu mișcările: dată, denumire, categorie, cine, sumă. */
export function drawMovesPage(ctx: CanvasRenderingContext2D, moves: Transaction[], first: boolean) {
  const W = PAGE.width;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, PAGE.height);
  let y = 120;
  text(ctx, first ? t("Mișcările lunii") : t("Mișcările lunii (continuare)"), M, y, `600 40px ${SERIF}`);
  y += 50;
  ctx.fillStyle = LINE; ctx.fillRect(M, y, W - 2 * M, 2);
  y += 10;
  for (const item of moves) {
    y += 42;
    text(ctx, formatDate(item.date, { day: "2-digit", month: "short" }), M, y, `500 22px ${SANS}`, MUTED);
    text(ctx, item.title, M + 120, y, `600 23px ${SANS}`, INK, "left", 470);
    text(ctx, `${t(item.category)}${item.person ? ` · ${item.person}` : ""}`, M + 610, y, `500 20px ${SANS}`, MUTED, "left", 330);
    text(ctx, `${item.kind === "income" ? "+" : "−"}${lei(item.amount)}`, W - M, y, `600 23px ${SANS}`, item.kind === "income" ? GREEN : INK, "right");
    ctx.fillStyle = "#eef2ef"; ctx.fillRect(M, y + 14, W - 2 * M, 1);
  }
}

/** Toate paginile, ca imagini JPEG; prima e rezumatul. */
export async function renderMonthlyReportPages(model: MonthlyReportModel): Promise<string[]> {
  // Fonturile se cer explicit: un canvas nu declanșează încărcarea lor, iar titlurile ieșeau în Georgia.
  try { await Promise.all([`600 72px ${SERIF}`, `600 26px ${SANS}`, `500 26px ${SANS}`, `700 24px ${SANS}`].map((font) => document.fonts.load(font, "ăîșțâ"))); await document.fonts.ready; } catch { /* fontul de sistem */ }
  const chunks: Transaction[][] = [];
  for (let i = ROWS_FIRST; i < model.moves.length; i += ROWS_PER_PAGE) chunks.push(model.moves.slice(i, i + ROWS_PER_PAGE));
  const pages = 1 + chunks.length;
  const out: string[] = [];
  const canvas = document.createElement("canvas");
  canvas.width = PAGE.width; canvas.height = PAGE.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.textBaseline = "alphabetic";
  drawSummaryPage(ctx, model); footer(ctx, 1, pages); out.push(canvas.toDataURL("image/jpeg", 0.88));
  chunks.forEach((chunk, i) => { drawMovesPage(ctx, chunk, i === 0); footer(ctx, i + 2, pages); out.push(canvas.toDataURL("image/jpeg", 0.88)); });
  return out;
}

export async function downloadMonthlyReportPdf(data: AppData, month: string, memberId?: string) {
  const model = monthlyReportModel(data, month, memberId);
  const [{ jsPDF }, images] = await Promise.all([import("jspdf"), renderMonthlyReportPages(model)]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  images.forEach((image, i) => { if (i) doc.addPage(); doc.addImage(image, "JPEG", 0, 0, 210, 297); });
  const who = model.perspective ? `-${model.perspective.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("ro-RO").replace(/\s+/g, "-")}` : "";
  await saveExport(`${t("raport")}-${month}${who}.pdf`, doc.output("blob"));
}
