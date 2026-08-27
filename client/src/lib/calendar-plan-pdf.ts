/** Ledger Flow — PDF local pentru tranșele calendaristice; datele nu părăsesc browserul. */
import type { CalendarBudget } from "@/lib/calendar-budget";
import { formatDate } from "@/lib/finance-data";

const plain = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const money = (value: number) => `${new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} RON`;

export const calendarPlanPdfSnapshot = (plan: CalendarBudget, familyName: string) => ({ familyName: familyName.trim() || "Buget Familie", createdAt: new Date().toISOString(), ...plan });

export const downloadCalendarPlanPdf = async (plan: CalendarBudget, familyName: string) => {
  const { jsPDF } = await import("jspdf"); const report = calendarPlanPdfSnapshot(plan, familyName); const doc = new jsPDF({ unit: "mm", format: "a4" }); const width = 210; const margin = 16; let y = 16;
  const write = (value: string, x: number, next = 5, options?: { size?: number; color?: [number, number, number]; style?: "normal" | "bold" }) => { const color = options?.color || [38, 54, 68]; doc.setFont("helvetica", options?.style || "normal"); doc.setFontSize(options?.size || 9); doc.setTextColor(color[0], color[1], color[2]); doc.text(plain(value), x, y); y += next; };
  const divider = () => { doc.setDrawColor(213, 225, 222); doc.line(margin, y, width - margin, y); y += 5; };
  const ensurePage = () => { if (y < 274) return; doc.addPage(); y = 16; };
  doc.setFillColor(18, 70, 61); doc.roundedRect(margin, y, width - margin * 2, 35, 4, 4, "F"); y += 10; write("BUGET FAMILIE", margin + 8, 6, { size: 8, color: [223, 244, 232], style: "bold" }); write("Plan calendaristic de venit", margin + 8, 8, { size: 20, color: [255, 255, 255], style: "bold" }); write(`${report.familyName} · ${formatDate(report.start, { day: "2-digit", month: "long", year: "numeric" })} – ${formatDate(report.end, { day: "2-digit", month: "long", year: "numeric" })}`, margin + 8, 5, { size: 9, color: [223, 244, 232] }); y += 10;
  const metric = (label: string, value: string, x: number) => { doc.setFillColor(245, 249, 247); doc.roundedRect(x, y, 54, 23, 3, 3, "F"); doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(91, 111, 103); doc.text(plain(label), x + 5, y + 7); doc.setFontSize(11); doc.setTextColor(24, 77, 66); doc.text(plain(value), x + 5, y + 16); };
  metric("SUMA DE PERIOADA", money(report.total), margin); metric("DURATA", `${report.days} zile · ${new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 }).format(report.exactWeeks)} sapt.`, margin + 58); metric("RITM SAPTAMANAL", money(report.weeklyAmount), margin + 116); y += 32;
  write("TRANSE CALENDARISTICE", margin, 6, { size: 8, color: [88, 109, 101], style: "bold" }); divider();
  report.weeks.forEach((week) => { ensurePage(); write(`S${week.index} · ${formatDate(week.start, { day: "2-digit", month: "short" })} – ${formatDate(week.end, { day: "2-digit", month: "short" })}`, margin, 5, { size: 10, style: "bold" }); doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(24, 77, 66); doc.text(money(week.amount), width - margin, y - 5, { align: "right" }); write(`${week.days} ${week.days === 1 ? "zi" : "zile"}${week.days < 7 ? " · transa partiala" : ""}`, margin, 5, { size: 8, color: [101, 122, 112] }); divider(); });
  const pages = doc.getNumberOfPages(); for (let index = 1; index <= pages; index += 1) { doc.setPage(index); doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(101, 122, 112); doc.text(`Generat local la ${new Date(report.createdAt).toLocaleString("ro-RO")} · Buget Familie · Pagina ${index}/${pages}`, margin, 287); }
  doc.save(`plan-calendaristic-${report.start}-${report.end}.pdf`);
};
