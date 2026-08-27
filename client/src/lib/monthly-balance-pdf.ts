/* Buget Familie — export PDF local: rezumat lunar explicabil, generat exclusiv din datele din browser. */
import { financialBalance, type AppData } from "@/lib/finance-data";

const plain = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const money = (value: number) => `${new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} RON`;
const monthLabel = (month: string) => new Intl.DateTimeFormat("ro-RO", { month: "long", year: "numeric" }).format(new Date(`${month}-01T12:00:00`));
const monthRange = (month: string) => { const [year, index] = month.split("-").map(Number); return { start: `${month}-01`, end: `${month}-${String(new Date(year, index, 0).getDate()).padStart(2, "0")}` }; };

export type MonthlyBalanceSnapshot = ReturnType<typeof monthlyBalanceSnapshot>;

export const monthlyBalanceSnapshot = (data: AppData, month: string, memberId?: string) => {
  const { start, end } = monthRange(month); const balance = financialBalance(data, start, end, memberId); const selectedMember = data.settings.members.find((member) => member.id === memberId); const perspective = selectedMember?.name || (data.settings.members.length > 1 ? "Familie" : "Personal");
  const transactions = data.transactions.filter((item) => item.date >= start && item.date <= end && (!memberId || item.memberId === memberId)).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || ""));
  const debts = data.debts.filter((item) => !memberId || !item.memberId || item.memberId === memberId); const savings = data.savings.filter((item) => !memberId || !item.memberId || item.memberId === memberId);
  return { month, start, end, perspective, balance, transactions, debts, savings };
};

export const downloadMonthlyBalancePdf = async (data: AppData, month: string, memberId?: string) => {
  const { jsPDF } = await import("jspdf"); const report = monthlyBalanceSnapshot(data, month, memberId); const doc = new jsPDF({ unit: "mm", format: "a4" }); const pageWidth = 210; const margin = 16; let y = 16;
  const write = (text: string, x: number, nextY = 5, options?: { size?: number; color?: [number, number, number]; style?: "normal" | "bold" }) => { const color: [number, number, number] = options?.color || [37, 63, 53]; doc.setFont("helvetica", options?.style || "normal"); doc.setFontSize(options?.size || 9); doc.setTextColor(color[0], color[1], color[2]); doc.text(plain(text), x, y); y += nextY; };
  const line = () => { doc.setDrawColor(209, 222, 213); doc.line(margin, y, pageWidth - margin, y); y += 5; };
  const page = () => { if (y < 270) return; doc.addPage(); y = 16; };
  const keyValue = (label: string, value: number, x: number, top: number, tone: [number, number, number]) => { doc.setFillColor(246, 249, 245); doc.roundedRect(x, top, 54, 25, 3, 3, "F"); doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(101, 122, 109); doc.text(plain(label).toUpperCase(), x + 5, top + 7); doc.setFontSize(12); doc.setTextColor(tone[0], tone[1], tone[2]); doc.text(money(value), x + 5, top + 16); };
  doc.setFillColor(20, 60, 54); doc.roundedRect(margin, y, pageWidth - margin * 2, 34, 4, 4, "F"); y += 10; write("BUGET FAMILIE", margin + 8, 6, { size: 8, color: [228, 212, 134], style: "bold" }); write(`Bilant lunar - ${monthLabel(report.month)}`, margin + 8, 8, { size: 20, color: [255, 255, 255], style: "bold" }); write(`Perspectiva: ${report.perspective}`, margin + 8, 5, { size: 9, color: [224, 238, 229] }); y += 9;
  keyValue("Venituri", report.balance.income, margin, y, [36, 108, 91]); keyValue("Cheltuieli", report.balance.expense, margin + 58, y, [184, 81, 65]); keyValue("Fluxul lunii", report.balance.cashflow, margin + 116, y, report.balance.cashflow < 0 ? [184, 81, 65] : [36, 108, 91]); y += 32;
  write("BILANT SI OBLIGATII", margin, 6, { size: 8, color: [104, 124, 111], style: "bold" }); line(); write(`Pozitie lichida neta: ${money(report.balance.netLiquidPosition)}`, margin, 6, { size: 12, color: report.balance.netLiquidPosition < 0 ? [184, 81, 65] : [36, 108, 91], style: "bold" }); write(`Solduri utilizabile ${money(report.balance.liquidFunds)} - datorii ramase ${money(report.balance.debtRemaining)}`, margin, 5, { size: 9 }); write(`Rate declarate pe luna: ${money(report.balance.monthlyRates)} | Economii urmarite: ${money(report.balance.savingsCurrent)}`, margin, 7, { size: 9 });
  write("PLATI SI MIScARI DIN LUNA", margin, 6, { size: 8, color: [104, 124, 111], style: "bold" }); line();
  if (!report.transactions.length) write("Nu sunt miscari inregistrate pentru aceasta luna si perspectiva.", margin, 7, { size: 9, color: [104, 124, 111] });
  report.transactions.forEach((item) => { const tone: [number, number, number] = item.kind === "income" ? [36, 108, 91] : [184, 81, 65]; page(); const amount = `${item.kind === "income" ? "+" : "-"}${money(item.amount)}`; write(`${item.date}  ${item.title}`, margin, 4, { size: 9, style: "bold" }); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(tone[0], tone[1], tone[2]); doc.text(amount, pageWidth - margin, y - 4, { align: "right" }); write(`${item.category} | ${item.person} | ${item.source}${item.debtId ? " | plata rata" : ""}`, margin, 5, { size: 7, color: [104, 124, 111] }); line(); });
  page(); write("DATORII SI ECONOMII URMARITE", margin, 6, { size: 8, color: [104, 124, 111], style: "bold" }); line();
  if (!report.debts.length && !report.savings.length) write("Nu sunt datorii sau obiective pentru aceasta perspectiva.", margin, 7, { size: 9, color: [104, 124, 111] });
  report.debts.forEach((debt) => { page(); write(`${debt.name} - datorie ramasa ${money(debt.remaining)}`, margin, 5, { size: 9, color: [142, 62, 51], style: "bold" }); write(`Rata declarata: ${money(debt.monthly)} / luna | Scadenta: ${debt.due}`, margin, 6, { size: 8, color: [104, 124, 111] }); });
  report.savings.forEach((saving) => { page(); write(`${saving.name} - ${money(saving.current)} din ${money(saving.target)}`, margin, 5, { size: 9, color: [36, 108, 91], style: "bold" }); write(`Termen: ${saving.due}`, margin, 6, { size: 8, color: [104, 124, 111] }); });
  const pages = doc.getNumberOfPages(); for (let index = 1; index <= pages; index += 1) { doc.setPage(index); doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(104, 124, 111); doc.text(`Generat local la ${new Date().toLocaleString("ro-RO")} | Buget Familie | Pagina ${index}/${pages}`, margin, 287); }
  doc.save(`bilant-${report.month}-${plain(report.perspective).toLocaleLowerCase("ro-RO").replace(/\s+/g, "-")}.pdf`);
};
