import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, ChevronDown, ChevronUp, CircleCheck, FileText, Lightbulb, Paperclip, Send, Trash2, WalletCards, X } from "lucide-react";
import { newId, expenseCategories, isoToday, parseNaturalSpendScenario, type AppData, type Transaction } from "@/lib/finance-data";
import { todayBrief } from "@/lib/household-insights";
import type { MainView } from "@/pages/home-kit";
import "../ai-companion.css";
import { t } from "@/lib/i18n";
import { appCheckHeader, authHeader } from "@/lib/realtime-sync";
import { parseModelIntents, type AssistantIntent } from "@/lib/assistant-intents";
import { dateCopy, noDoubleStop, retimeText, shiftDay, today } from "@/lib/proposal-date";
import { analyze, answerToText } from "@/lib/analyst";
import { dominantReceiptCategory, looksLikeProductSearch } from "@/lib/product-catalog";
import { buildSuggestions } from "@/lib/suggestions";
import { RoDateInput } from "@/components/RoDateInput";
import {
  claimsSaved,
  decide,
  expenseProposal,
  foldRo,
  isConfirm,
  isCorrection,
  isQuestion,
  householdIsSetUp,
  planWarningFor,
  resolveIntents,
  compactGuideContext,
  readingLabel,
  shouldAskWhichReading,
  sourceTextSafe,
  spendDate,
  understand,
  buildExpenseOffer,
  canCommitGuideSpend,
  isDatedSpendChoice,
  type ChatChoice,
  type ExtractedGuide,
  type FinancialUpdate,
  type GuideMemory,
  type Reading,
} from "@/lib/understand";
import { shownChatMessages, hiddenChatCount } from "@/lib/shown-chat";
import { consumeQuota, emptyQuota, formatReset, GuideQuotaBar, GuideText, guideMemory, learn, loadMemory, loadQuota, markLocalSave, MEMORY_KEY, money, naturalTitle, QUOTA_KEY, seedMemory, type QuotaInfo } from "@/components/ai-companion-parts";
import { intentToUpdate, pickFundsSource, proposalText, SCREEN_NAMES, spendAlternatives, updatesFromGuide } from "@/components/ai-companion-logic";

export { pickFundsSource } from "@/components/ai-companion-logic";

export type NaturalDraft = Pick<Transaction, "amount" | "category" | "title" | "kind"> & { date?: string; note?: string };
export type GuidedRevert = { kind: "income" | "expense"; title: string; amount: number; date: string };
export type { FinancialUpdate } from "@/lib/understand";
type Props = { data: AppData; view: MainView; onAdd: () => void; onGo: (view: MainView) => void; onNaturalEntry: (draft: NaturalDraft) => void; onFinancialUpdate: (update: FinancialUpdate) => void; onRevert?: (item: GuidedRevert) => void; initiallyOpen?: boolean };
export type ChatMessage = { id: string; role: "assistant" | "user"; text: string; action?: { label: string; type: "add" | "apply" | "catalog" | MainView; query?: string }; updates?: FinancialUpdate[]; intents?: AssistantIntent[]; choices?: ChatChoice[]; picks?: Array<{ label: string; reading: Reading }>; undo?: GuidedRevert; /** Întrebări firești de după un răspuns de analiză; se trimit cu o atingere. */ followUps?: string[] };
type ChatAttachment = { name: string; mimeType: string; data: string };
type PendingReceiptDraft = { vendor: string; amount: number; date?: string; items: Array<{ label: string; amount: number; category: string }> };
type GuideStage = "income" | "debts" | "rate" | "allocation" | "ready";
const CHAT_KEY = "buget-familie:ai-chat-v1";
export function AICompanion({ data, view, onAdd, onGo, onNaturalEntry: _onNaturalEntry, onFinancialUpdate, onRevert, initiallyOpen = false }: Props) {
  const [open, setOpen] = useState(initiallyOpen);
  const historyRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [pendingDebtName, setPendingDebtName] = useState("");
  const [guideStage, setGuideStage] = useState<GuideStage>(() => {
    const saved = window.localStorage.getItem("buget-familie:ai-guide-stage-v1") as GuideStage | null;
    /**
     * Ghidul pornea mereu de la „ce bani intră într-o lună obișnuită?” și rămânea acolo
     * până primea un venit — inclusiv pentru o familie care avea deja salariu, plicuri și
     * plan. De acolo venea senzația că nu te ascultă: orice sumă scrisă era citită ca venit,
     * fiindcă pasul de configurare avea prioritate.
     *
     * Configurarea se citește din registru, nu din memoria unui pas bifat cândva: cine are
     * deja plan sau mișcări nu mai e întrebat de la început, nici la prima deschidere, nici
     * după o reinstalare care a păstrat datele.
     */
    return saved && saved !== "income" ? saved : householdIsSetUp(data) ? "ready" : saved || "income";
  });
  const [messages, setMessages] = useState<ChatMessage[]>(() => { try { return JSON.parse(window.localStorage.getItem(CHAT_KEY) || "[]") as ChatMessage[]; } catch { return []; } });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [quota, setQuota] = useState<QuotaInfo>(() => loadQuota());
  const [memory, setMemory] = useState<GuideMemory>(() => {
    guideMemory.current = loadMemory();
    return guideMemory.current;
  });
  const [spendDay, setSpendDay] = useState(today);
  const [pickedChoice, setPickedChoice] = useState<ChatChoice | null>(null);
  const [dateTapped, setDateTapped] = useState(false);
  const lastSaveRef = useRef({ key: "", at: 0 });
  const pendingReceiptRef = useRef<PendingReceiptDraft | null>(null);
  const monthSummary = useMemo(() => { const month = today().slice(0, 7); const current = data.transactions.filter((item) => item.date.startsWith(month)); return { income: current.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0), expense: current.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0) }; }, [data]);
  const todayPace = useMemo(() => Math.round(todayBrief(data).spendable), [data]);
  /** Ce merită întrebat acum, din situația reală: plic gol, salariu aproape, datorii. */
  const suggestions = useMemo(() => buildSuggestions(data), [data]);
  const contextReply = useMemo(() => { if (guideStage === "income") return t("Sunt aici cu tine și te ghidez pas cu pas. Începem cu veniturile: ce bani intră într-o lună obișnuită — salariu, pensie, freelancing sau alte venituri? Spune-mi suma și îți pun prima bază în aplicație."); if (guideStage === "debts") return t("Perfect, am notat venitul. Acum vreau să expunem toate obligațiile: ai credite, rate, carduri de cumpărături sau bani împrumutați? Spune-mi numele și soldul aproximativ. Dacă nu ai, spune doar «nu am datorii»."); if (guideStage === "rate") return `Am trecut „${pendingDebtName || "datoria"}”. Mai știi cât plătești lunar pentru ea? Dacă nu știi exact, spune o estimare sau «nu știu».`; if (guideStage === "allocation") return t("Acum împărțim venitul: cât vrei să rezervi pentru mâncare, casă și facturi, transport și economii? Poți scrie într-o singură frază, de exemplu «alimente 1500, facturi 800, transport 400, economii 500»."); if (!data.transactions.length) return t("Sunt aici cu tine. Poți să-mi scrii orice mișcare în cuvintele tale, iar eu o verific înainte să o salvez."); const briefing = analyze("ce fac azi?", data); if (briefing) { const overspend = monthSummary.income > 0 && monthSummary.expense > monthSummary.income ? ` Luna asta ai ${money(monthSummary.expense)} cheltuieli și ${money(monthSummary.income)} venituri.` : ""; return `${briefing.headline}${briefing.detail ? ` ${briefing.detail}` : ""}${overspend} Spune-mi ce vrei să înțelegi sau să schimbi.`; } if (monthSummary.income > 0 && monthSummary.expense > monthSummary.income) return `M-am uitat la luna aceasta: ai ${money(monthSummary.expense)} cheltuieli și ${money(monthSummary.income)} venituri. Nu te judec — hai să vedem împreună ce ajustăm.`; return `Sunt cu tine în ${view === "today" ? "tabloul de azi" : "secțiunea deschisă"}. Spune-mi ce vrei să înțelegi sau să schimbi.`; }, [data, guideStage, monthSummary, pendingDebtName, view]);

  useEffect(() => { try { window.localStorage.setItem("buget-familie:ai-guide-stage-v1", guideStage); } catch { /* ignore */ } }, [guideStage]);
  useEffect(() => { if (!open || messages.length) return; setMessages([{ id: "welcome", role: "assistant", text: contextReply }]); }, [open, messages.length, contextReply]);
  useEffect(() => { try { window.localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-30))); } catch { /* spațiu local indisponibil */ } }, [messages]);
  useEffect(() => {
    document.documentElement.classList.toggle("ai-guide-open", open);
    return () => {
      document.documentElement.classList.remove("ai-guide-max");
      document.documentElement.classList.remove("ai-guide-open");
    };
  }, [open]);
  useEffect(() => { try { window.localStorage.setItem(QUOTA_KEY, JSON.stringify(quota)); } catch { /* ignore */ } }, [quota]);
  useEffect(() => {
    guideMemory.current = memory;
    try { window.localStorage.setItem(MEMORY_KEY, JSON.stringify(memory)); } catch { /* ignore */ }
  }, [memory]);
  useEffect(() => {
    setMemory((current) => {
      const next = seedMemory(current, data);
      guideMemory.current = next;
      return next;
    });
  }, [data.transactions.length]);
  useEffect(() => {
    if (quota.mode !== "local" || !quota.resetAt) return;
    const tick = () => {
      if (Date.parse(quota.resetAt) <= Date.now()) setQuota(emptyQuota());
    };
    tick();
    const id = window.setInterval(tick, 15000);
    return () => window.clearInterval(id);
  }, [quota.mode, quota.resetAt]);

  useEffect(() => {
    const root = historyRef.current;
    if (!root) return;
    root.scrollTop = root.scrollHeight;
  }, [messages, typing, open]);

  useEffect(() => {
    const openGuide = () => { setOpen(true); };
    window.addEventListener("buget-familie:open-guide", openGuide);
    return () => window.removeEventListener("buget-familie:open-guide", openGuide);
  }, []);

  const addMessage = (entry: Omit<ChatMessage, "id">) => {
    const proposed = entry.updates?.find((item) => item.kind === "expense" || item.kind === "income");
    if (proposed && (proposed.kind === "expense" || proposed.kind === "income") && proposed.date) setSpendDay(proposed.date);
    setMessages((current) => [...current, { ...entry, id: `${Date.now()}-${current.length}` }].slice(-30));
  };
  /**
   * Ziua se alege înainte de confirmare, la fel pentru venit și pentru cheltuială.
   * Nu e de ajuns să reținem alegerea: propunerea de deasupra o scrie negru pe alb
   * („venit 5.000 RON · Salariu · 11 sept.”), deci o rescriem odată cu ea. Altfel
   * omul ar apăsa „Confirmă” cu două date diferite pe ecran.
   */
  const resetSpendDraft = () => {
    setPickedChoice(null);
    setDateTapped(false);
  };
  const commitChoice = (choice: ChatChoice, day: string) => {
    const stamp = `${choice.update.kind}|${"title" in choice.update ? choice.update.title : ""}|${"amount" in choice.update ? choice.update.amount : ""}|${day}|${choice.update.kind === "expense" ? choice.update.allocationId : ""}`;
    if (stamp === lastSaveRef.current.key && Date.now() - lastSaveRef.current.at < 900) return;
    lastSaveRef.current = { key: stamp, at: Date.now() };
    const update = choice.update.kind === "expense" || choice.update.kind === "income"
      ? { ...choice.update, date: day, clientCaptureId: choice.update.clientCaptureId || newId(`capture-${choice.update.kind}`) }
      : choice.update;
    const draft = pendingReceiptRef.current;
    const stamped = update.kind === "expense" && draft && Math.abs(draft.amount - update.amount) <= 0.05
      ? { ...update, receiptDraft: draft }
      : update;
    if (stamped.kind === "expense" && "receiptDraft" in stamped && stamped.receiptDraft) pendingReceiptRef.current = null;
    onFinancialUpdate(stamped);
    if (stamped.kind === "expense") {
      const proposed = [...messages].reverse().find((item) => item.role === "assistant" && item.updates?.length)?.updates?.[0];
      setMemory(learn(stamped, isCorrection(proposed, stamped) ? 2 : 1));
    }
    resetSpendDraft();
    if (stamped.kind === "delete-transaction") {
      addMessage({ role: "assistant", text: `Am șters **${stamped.title}**, ${money(stamped.amount)}.`, action: { type: "journal", label: t("Vezi în Mișcări") } });
      setHistoryOpen(false);
      return;
    }
    if (stamped.kind === "amend-transaction") {
      addMessage({ role: "assistant", text: `Am schimbat **${stamped.title}** din ${money(stamped.was)} în **${money(stamped.amount)}**.`, action: { type: "journal", label: t("Vezi în Mișcări") } });
      setHistoryOpen(false);
      return;
    }
    if (stamped.kind === "transfer") {
      addMessage({ role: "assistant", text: `Am mutat ${money(stamped.amount)} din **${stamped.fromLabel}** în **${stamped.toLabel}**.`, action: { type: "plan", label: t("Vezi în Plan") } });
      setHistoryOpen(false);
      return;
    }
    const spent = stamped.kind === "expense" || stamped.kind === "income" ? `${stamped.title} ${money(stamped.amount)}` : money("amount" in stamped ? stamped.amount : 0);
    addMessage({
      role: "assistant",
      text: noDoubleStop(`Am salvat ${spent} · ${choice.label} · ${dateCopy(day)}.${stamped.kind === "expense" && "receiptDraft" in stamped && stamped.receiptDraft ? ` ${t("Produsele sunt la Bonuri.")}` : ""}`),
      action: { type: "journal", label: t("Vezi în Mișcări") },
      undo: (stamped.kind === "expense" || stamped.kind === "income") ? { kind: stamped.kind, title: stamped.title, amount: stamped.amount, date: day } : undefined,
    });
    setHistoryOpen(false);
  };
  const applySpendDay = (day: string) => {
    setSpendDay(day);
    setDateTapped(true);
    setMessages((current) => {
      const index = current.map((item) => item.role).lastIndexOf("assistant");
      const target = current[index];
      if (!target) return current;
      const pendingUpdates = target.action?.type === "apply" ? target.updates : undefined;
      if (!pendingUpdates?.length && !target.choices?.length) return current;
      const dateOf = (item: FinancialUpdate) => (item.kind === "expense" || item.kind === "income" || item.kind === "funds" ? item.date : undefined);
      const before = pendingUpdates?.map(dateOf).find(Boolean) || target.choices?.map((item) => dateOf(item.update)).find(Boolean);
      const intents = target.intents?.map((item) => (item.kind === "expense" || item.kind === "income" || item.kind === "funds" ? { ...item, date: day } : item));
      const next = [...current];
      next[index] = {
        ...target,
        updates: pendingUpdates?.map((item) => (item.kind === "expense" || item.kind === "income" || item.kind === "funds" ? { ...item, date: day } : item)) || target.updates,
        intents,
        choices: target.choices?.map((item) => (item.update.kind === "expense" || item.update.kind === "income" || item.update.kind === "funds" ? { ...item, update: { ...item.update, date: day } } : item)),
        text: intents
          ? proposalText(intents, data, guideMemory.current)
          : before
            ? retimeText(target.text, before, day)
            : target.text,
      };
      return next;
    });
    if (pickedChoice && isDatedSpendChoice(pickedChoice)) commitChoice(pickedChoice, day);
  };
  /**
   * Unde sunt banii declarați. Aplicația ghicea prima sursă și tăcea, deci „am 1.200 lei”
   * ateriza pe cardul greșit fără ca omul să afle. Alegerea nu salvează nimic: schimbă
   * propunerea de deasupra, iar confirmarea rămâne a lui.
   */
  const applyFundsSource = (sourceId: string) => {
    setMessages((current) => {
      const index = current.map((item) => item.role).lastIndexOf("assistant");
      const target = current[index];
      if (!target || target.action?.type !== "apply" || !target.updates?.length) return current;
      const intents = target.intents?.map((item) => (item.kind === "funds" ? { ...item, sourceId } : item));
      const next = [...current];
      next[index] = {
        ...target,
        updates: target.updates.map((item) => (item.kind === "funds" ? { ...item, sourceId } : item)),
        intents,
        text: intents ? proposalText(intents, data, guideMemory.current) : target.text,
      };
      return next;
    });
  };

  const applyChoice = (choice: ChatChoice) => {
    if (isDatedSpendChoice(choice) && !canCommitGuideSpend(true, dateTapped)) {
      setPickedChoice(choice);
      return;
    }
    const day = spendDay || ((choice.update.kind === "expense" || choice.update.kind === "income") ? choice.update.date : undefined) || today();
    commitChoice(choice, day);
  };
  const clearChat = () => {
    const hasPlan = data.transactions.length > 0 || data.settings.salaryPlan.allocations.length > 0;
    const stage: GuideStage = hasPlan ? "ready" : "income";
    const fresh: ChatMessage[] = [{ id: `welcome-${Date.now()}`, role: "assistant", text: t("Am golit conversația. Mișcările și plicurile rămân în registru. Spune-mi cu ce vrei să începem.") }];
    setMessages(fresh);
    setHistoryOpen(false);
    setGuideStage(stage);
    setPendingDebtName("");
    setAttachments([]);
    pendingReceiptRef.current = null;
    resetSpendDraft();
    try {
      window.localStorage.setItem(CHAT_KEY, JSON.stringify(fresh));
      window.localStorage.setItem("buget-familie:ai-guide-stage-v1", stage);
    } catch { /* ignore */ }
  };
  const runAction = (type: "add" | "plan" | "journal" | "insights", label: string) => { addMessage({ role: "user", text: label }); setTyping(true); window.setTimeout(() => { setTyping(false); addMessage({ role: "assistant", text: type === "add" ? t("Deschid formularul. Completează ce mai lipsește și verifică înainte să salvezi.") : type === "plan" ? t("Deschid planul. Acolo așezăm veniturile pe destinații și ritmuri.") : type === "journal" ? t("Deschid jurnalul și ne uităm la mișcările care contează.") : t("Deschid analiza ca să vedem tiparele lunii."), action: { type, label: type === "add" ? t("Deschide formularul") : type === "plan" ? t("Vezi planul") : type === "journal" ? t("Vezi jurnalul") : t("Vezi analiza") } }); if (type === "add") onAdd(); else onGo(type); setOpen(false); }, 260); };
  const handleAction = (item: ChatMessage) => {
    if (item.action?.type === "apply" && item.updates?.length) {
      item.updates.forEach((update) => onFinancialUpdate(update));
      item.updates.forEach((update) => { if (update.kind === "expense") setMemory(learn(update)); });
      if (item.updates.some((update) => update.kind === "income")) setGuideStage("debts");
      const dated = item.updates.find((update) => update.kind === "expense" || update.kind === "income");
      const day = dated && (dated.kind === "expense" || dated.kind === "income") ? dated.date : "";
      /**
       * „Am trecut-o în registru” la o declarație de bani suna a mișcare adăugată, iar omul
       * o căuta în Mișcări și nu o găsea. Soldul de pornire nu e o intrare de bani: se spune
       * ce s-a schimbat și cum se scrie o intrare adevărată, dacă asta a vrut.
       */
      const doarBani = item.updates.every((update) => update.kind === "funds");
      const plicuri = item.updates.filter((update) => update.kind === "allocation").length;
      addMessage(doarBani
        ? {
            role: "assistant",
            text: t("Gata. Banii sunt în Mișcări ca intrare, iar soldul arată acum cât ai spus."),
            action: { type: "journal", label: t("Vezi în Mișcări") },
          }
        : {
            role: "assistant",
            text: plicuri >= 2
              ? t("Gata, am făcut cele {count} plicuri. Le vezi în Plan, cu tranșele pe săptămâni.", { count: String(plicuri) })
              : `Gata. ${item.updates.length === 1 ? "Am trecut-o" : "Le-am trecut"} în registru${day ? ` pe ${dateCopy(day)}` : ""}; poți corecta orice din ecranul respectiv.`,
            action: plicuri >= 2 ? { type: "plan", label: t("Vezi în Plan") } : { type: "journal", label: t("Vezi în Mișcări") },
          });
      setHistoryOpen(false);
      resetSpendDraft();
      return;
    }
    if (!item.action || item.action.type === "apply") return;
    if (item.action.type === "catalog") {
      window.dispatchEvent(new CustomEvent("buget-familie:open-catalog", { detail: { query: item.action.query || "" } }));
      setOpen(false);
      return;
    }
    if (item.action.type === "add") onAdd();
    else onGo(item.action.type as MainView);
    setOpen(false);
  };
  const offerSpend = (proposal: { text: string; choices: ChatChoice[] }) => {
    resetSpendDraft();
    const dated = proposal.choices.find((item) => (item.update.kind === "expense" || item.update.kind === "income") && item.update.date);
    if ((dated?.update.kind === "expense" || dated?.update.kind === "income") && dated.update.date) setSpendDay(dated.update.date);
    addMessage({ role: "assistant", text: proposal.text, choices: proposal.choices });
  };
  const offerCatalog = (name: string) => {
    const q = name.trim();
    addMessage({
      role: "assistant",
      text: t("„{name}” arată a produs. Caută-l în Catalog — acolo sunt listele online, nu în ghid.", { name: q }),
      action: { type: "catalog", label: t("Caută „{name}” în catalog", { name: q }), query: q },
    });
  };
  const applyGuide = (updates: FinancialUpdate[]) => {
    updates.forEach((update) => onFinancialUpdate(update));
    if (updates.some((update) => update.kind === "income")) setGuideStage("debts");
  };
  const firstAmount = (raw: string) => { const match = raw.match(/\d[\d\s.]*(?:,\d{1,2})?/); if (!match) return 0; const token = match[0].replace(/\s/g, ""); const normalized = token.includes(",") ? token.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(?:\.\d{3})+$/.test(token) ? token.replace(/\./g, "") : token; return parseFloat(normalized) || 0; };
  const localSend = (alreadyAdded = false, draft = message) => { const raw = draft.trim(); if (!raw) return; setMessage(""); if (!alreadyAdded) addMessage({ role: "user", text: raw }); const amount = firstAmount(raw); const folded = raw.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, ""); setTyping(true); window.setTimeout(() => { setTyping(false);
    if (!amount && looksLikeProductSearch(raw)) { offerCatalog(raw); return; }
    /**
     * Intențiile explicite au prioritate față de ghidul pas cu pas. Aici era eroarea:
     * cât timp ghidul aștepta un venit, orice mesaj cu cifre era citit ca venit, deci o
     * cerere de plic devenea „salariu 600 lei”. Lăsăm ghidul să răspundă doar când
     * utilizatorul chiar spune lucrul pe care ghidul îl cere.
     */
    const stageKind = guideStage === "income" ? "income" : guideStage === "debts" || guideStage === "rate" ? "debt" : guideStage === "allocation" ? "envelope" : undefined;
    /**
     * Fără rețea se citește exact la fel ca în rest — aceeași funcție, aceleași
     * scoruri. Înainte erau două cascade cu ordini diferite, deci aceeași frază
     * putea însemna altceva online față de offline.
     */
    const offline = understand(raw, data, { memory: guideMemory.current, asOf: isoToday() }).filter((reading) => {
      // Ghidul pas cu pas întreabă ceva anume; îi lăsăm lui răspunsul la întrebarea lui.
      if (!stageKind || reading.kind !== "intents") return true;
      return reading.intents.some((item) => item.intent.kind !== stageKind);
    });
    const { winner: offlineWinner } = decide(offline);
    if (offlineWinner) {
      const trimmed: Reading = offlineWinner.kind === "intents" && stageKind
        ? { ...offlineWinner, intents: offlineWinner.intents.filter((item) => item.intent.kind !== stageKind) }
        : offlineWinner;
      if (act(trimmed)) return;
    }
    /**
     * Ghidul de pornire întreabă de venit, dar nu orice cifră este un venit.
     * „300 lei la dentist” ajungea în registru ca venit lunar, fără confirmare,
     * fiindcă pasul de pornire revendica orice mesaj cu o sumă. Acum îl lăsăm să
     * revendice doar ce chiar sună a venit; restul merge mai departe, ca oricând.
     */
    const soundsLikeIncome = /venit|salariu|leafa|pensie|primesc|castig|incasez|intra|bonus|chirie|freelanc/.test(foldRo(raw));
    if (guideStage === "income" && !soundsLikeIncome && amount) {
      addMessage({ role: "assistant", text: t("Asta nu pare un venit. Spune-mi întâi ce bani intră într-o lună obișnuită — salariu, pensie sau altceva — și ne întoarcem imediat la restul.") });
      return;
    }
    if (guideStage === "income") { if (!amount) { addMessage({ role: "assistant", text: t("Am nevoie doar de o sumă aproximativă. De exemplu: «salariul meu este 6.500 lei pe lună».") }); return; } onFinancialUpdate({ kind: "income", amount, title: /salariu/i.test(folded) ? "Salariu lunar" : t("Venit lunar") }); setGuideStage("debts"); addMessage({ role: "assistant", text: `Am notat ${money(amount)} ca venit lunar. Următoarea întrebare: ai datorii, credite, rate sau carduri de cumpărături?` }); return; } if (guideStage === "debts") { if (/nu\s+(am|exista)|fara\s+datorii|niciuna/.test(folded)) { setGuideStage("allocation"); addMessage({ role: "assistant", text: t("În regulă, fără datorii. Acum împărțim venitul pe categorii: alimente, facturi, transport și economii. Ce sume vrei să rezervi?") }); return; } if (!amount) { addMessage({ role: "assistant", text: t("Spune-mi, de exemplu: «Credit auto, mai am 18.000 lei» sau «rată la bancă, sold 42.000 lei».") }); return; } const debtName = raw.replace(/\d[\d.,\s]*(?:lei|ron)?/gi, "").replace(/(mai am|sold|datorie|credit|rata|rată|la banca|la bancă)/gi, "").replace(/[,:-]/g, " ").trim() || "Datorie"; setPendingDebtName(debtName); onFinancialUpdate({ kind: "debt", name: debtName, remaining: amount }); setGuideStage("rate"); addMessage({ role: "assistant", text: `Am trecut „${debtName}” cu soldul de ${money(amount)}. Cât plătești lunar pentru această datorie?` }); return; } if (guideStage === "rate") { if (amount) onFinancialUpdate({ kind: "debt-monthly", amount }); setGuideStage("allocation"); addMessage({ role: "assistant", text: amount ? `Am notat rata de ${money(amount)}. Acum împărțim venitul pe categorii: alimente, facturi, transport și economii.` : t("În regulă, lăsăm rata de completat mai târziu. Acum împărțim venitul pe categorii: alimente, facturi, transport și economii.") }); return; } if (guideStage === "allocation") { const categories = ["alimente", "facturi", "casa", "transport", "economii", "datorii"]; const found = categories.map((category) => { const match = folded.match(new RegExp(`${category}[^\\d]{0,18}(\\d[\\d.,]*)`)); return match ? { category, amount: firstAmount(match[1]) } : undefined; }).filter((item): item is { category: string; amount: number } => Boolean(item?.amount)); if (!found.length) { addMessage({ role: "assistant", text: t("Nu am găsit categoriile și sumele. Scrie simplu: «alimente 1500, facturi 800, transport 400, economii 500».") }); return; } found.forEach((item) => onFinancialUpdate({ kind: "allocation", category: item.category === "facturi" || item.category === "casa" ? "Casă & facturi" : item.category[0].toLocaleUpperCase("ro-RO") + item.category.slice(1), amount: item.amount, weekly: item.category === "alimente" || item.category === "transport" })); setGuideStage("ready"); addMessage({ role: "assistant", text: `Am repartizat ${found.map((item) => `${item.category} ${money(item.amount)}`).join(", ")}. Putem ajusta orice sumă. De acum sunt disponibil să urmărim împreună cheltuielile, veniturile și ritmul lunii.` }); return; } const parsed = parseNaturalSpendScenario(raw, [...expenseCategories, ...data.settings.customCategories]); if (!parsed.understood) { if (looksLikeProductSearch(raw)) { offerCatalog(raw); return; } addMessage({ role: "assistant", text: t("Spune-mi suma și ce ai plătit, de exemplu: «am cheltuit 50 de lei pe combustibil».") }); return; } const proposal = expenseProposal(raw, { amount: parsed.amount, category: parsed.category, title: naturalTitle(raw, parsed.category) }, data, guideMemory.current, true); if (proposal) { offerSpend(proposal); return; } offerSpend(buildExpenseOffer(data, { amount: parsed.amount, title: naturalTitle(raw, parsed.category), category: parsed.category || t("Altele"), date: spendDate(raw) }, guideMemory.current)); }, 420); };

  const handleAttachments = async (list?: FileList | null) => {
    const picked = list ? Array.from(list) : [];
    if (!picked.length) return;
    const room = 2 - attachments.length;
    if (room <= 0) {
      addMessage({ role: "assistant", text: t("Un bon poate avea două fotografii: capătul de sus și totalul de jos. Elimină una înainte să adaugi alta.") });
      return;
    }
    setAttachmentBusy(true);
    try {
      const { compressReceiptImage, isReceiptImageFile } = await import("@/lib/receipt-utils");
      const next: ChatAttachment[] = [];
      for (const file of picked.slice(0, room)) {
        const okPdf = /pdf/i.test(file.type) || /\.pdf$/i.test(file.name);
        if (!isReceiptImageFile(file) && !okPdf) {
          addMessage({ role: "assistant", text: t("Pot analiza imagini JPG, PNG, WEBP și fișiere PDF. Alege un bon într-unul dintre aceste formate.") });
          continue;
        }
        if (file.size > 25 * 1024 * 1024) {
          addMessage({ role: "assistant", text: t("Fișierul este prea mare. Alege un bon de maximum 25 MB.") });
          continue;
        }
        if (okPdf) {
          const data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("read"));
            reader.onerror = () => reject(reader.error || new Error("read"));
            reader.readAsDataURL(file);
          });
          next.push({ name: file.name, mimeType: file.type || "application/pdf", data });
          continue;
        }
        const data = await compressReceiptImage(file);
        next.push({ name: file.name || `bon-${attachments.length + next.length + 1}.jpg`, mimeType: "image/jpeg", data });
      }
      if (next.length) setAttachments((current) => [...current, ...next].slice(0, 2));
    } catch {
      addMessage({ role: "assistant", text: t("Nu am putut citi fișierul. Încearcă din nou cu o fotografie clară a bonului.") });
    } finally {
      setAttachmentBusy(false);
    }
  };

  /**
   * Ce se întâmplă cu citirea aleasă. Întoarce `false` când citirea nu duce la
   * nimic de arătat, ca mesajul să meargă mai departe la model.
   */
  const act = (reading: Reading): boolean => {
    if (reading.kind === "intents") {
      const only = reading.intents.length === 1 ? reading.intents[0].intent : undefined;
      if (only?.kind === "expense") {
        offerSpend(buildExpenseOffer(data, only, guideMemory.current));
        return true;
      }
      const intents = reading.intents.map((item) => item.intent);
      /**
       * „Deschide-mi Planul” nu se confirmă, se face. Un ecran nu scrie nimic în registru,
       * deci n-are ce căuta într-o propunere cu buton de salvare — ar fi arătat „Confirmă”
       * pentru ceva ce nu se salvează.
       */
      const doarEcran = intents.length === 1 && intents[0].kind === "open" ? intents[0] : undefined;
      if (doarEcran && doarEcran.kind === "open") {
        addMessage({
          role: "assistant",
          text: t("Deschid „{screen}”.", { screen: SCREEN_NAMES[doarEcran.screen] }),
          action: { type: doarEcran.screen, label: t("Deschide „{screen}”", { screen: SCREEN_NAMES[doarEcran.screen] }) },
        });
        return true;
      }
      resetSpendDraft();
      addMessage({
        role: "assistant",
        text: proposalText(intents, data, guideMemory.current, reading.headline, planWarningFor(reading.intents, data)),
        updates: intents.map((item) => intentToUpdate(item, data, guideMemory.current)).filter((item): item is FinancialUpdate => Boolean(item)),
        intents,
        action: { type: "apply", label: intents.length === 1 ? t("Confirmă și salvează") : t("Confirmă pe toate") },
        choices: spendAlternatives(data, reading.intents, guideMemory.current),
      });
      return true;
    }
    if (reading.kind === "question") {
      addMessage({ role: "assistant", text: answerToText(reading.answer), followUps: reading.answer.followUps });
      return true;
    }
    if (reading.kind === "expense" || reading.kind === "transfer" || reading.kind === "income" || reading.kind === "revise" || reading.kind === "due") {
      offerSpend(reading.proposal);
      return true;
    }
    if (reading.kind === "insight") {
      addMessage({ role: "assistant", text: reading.text });
      return true;
    }
    return false;
  };

  const send = (draft?: string) => {
    const raw = (draft ?? message).trim();
    if (!raw && !attachments.length) return;
    const requestText = raw || t("Analizează bonul atașat și propune cheltuiala.");
    const sentAttachments = attachments;
    if (!sentAttachments.length) pendingReceiptRef.current = null;
    setMessage("");
    setAttachments([]);
    setHistoryOpen(false);
    addMessage({ role: "user", text: sentAttachments.length ? `${raw || t("Analizează bonul atașat.")} 📎 ${sentAttachments.map((item) => item.name).join(", ")}` : raw });
    const pending = [...messages].reverse().find((item) => item.role === "assistant" && item.choices?.length);
    if (pending?.choices?.length && isConfirm(raw)) {
      if (pending.choices.length === 1) {
        applyChoice(pending.choices[0]);
        return;
      }
      addMessage({ role: "assistant", text: t("Alege plicul sau sursa de mai sus — nu salvez până apeși o opțiune.") });
      return;
    }
    if (isConfirm(raw)) {
      const lastSpend = [...messages].reverse().find((item) => item.role === "user" && expenseProposal(item.text, undefined, data, guideMemory.current));
      const recovered = lastSpend ? expenseProposal(lastSpend.text, undefined, data, guideMemory.current, true) : undefined;
      if (recovered) {
        offerSpend(recovered);
        return;
      }
    }
    /**
     * O singură citire a mesajului, un singur loc unde se alege. Înainte, fiecare
     * cititor avea propriul `if … return` și ordinea lor era ordinea liniilor din
     * funcție: cine recunoștea primul lua mesajul, restul nu mai apucau să se uite.
     * De aici veneau confuziile — o cerere de plic citită ca venit, o întrebare
     * citită ca cheltuială. Acum toți citesc, iar `decide` compară.
     *
     * Bonul fotografiat nu trece pe înțelegerea din cuvinte: suma e în imagine.
     * OCR-ul rămâne pe telefon. La Gemini pleacă doar textul citit local, niciodată poza.
     */
    const sentPhotos = sentAttachments.length > 0;
    const readings = sentPhotos ? [] : understand(requestText, data, { memory: guideMemory.current, asOf: isoToday() });
    const { winner, runnerUp, ambiguous } = decide(readings);
    const blocked = quota.mode === "local" || quota.remaining <= 0;
    /**
     * Două citiri la fel de bune nu înseamnă că omul a vorbit neclar — înseamnă că noi
     * citim cu reguli. Până acum îi puneam lui întrebarea („alege ce-ai vrut”) chiar
     * când aveam la îndemână un model care înțelege fraza întreagă. Acum întrebăm întâi
     * modelul; alegerea rămâne pregătită, pentru cazul în care nici el nu lămurește.
     */
    const picks = !sentPhotos && ambiguous && winner && runnerUp && shouldAskWhichReading(winner, runnerUp)
      ? [
          { label: readingLabel(winner), reading: winner },
          { label: readingLabel(runnerUp), reading: runnerUp },
        ]
      : undefined;
    const askWhich = (text?: string) => addMessage({ role: "assistant", text: text || t("Nu sunt sigur. Alege ce-ai vrut:"), picks });
    if (picks && blocked) {
      askWhich();
      return;
    }
    /**
     * Citirea locală câștiga întotdeauna, chiar și când lăsa jumătate de mesaj necitit:
     * „am 1800 de lei pe care îi împart în plicuri până pe 9 octombrie” primea înapoi
     * doar data salariului, iar modelul online — plătit și disponibil — nu vedea mesajul.
     *
     * Când citirea e marcată `soft`, drumul online trece primul. Nu pierdem nimic:
     * dacă rețeaua cade sau modelul nu întoarce nimic folosibil, `localSend` reia exact
     * aceeași cascadă locală și propune ce ar fi propus și acum.
     */
    const escalate = Boolean(winner?.soft || picks) && !blocked && !sentPhotos;
    if (winner && !escalate) {
      setMemory(markLocalSave());
      if (act(winner)) return;
    }
    /**
     * Catalogul e ultima soluție, nu prima. Verificarea stătea înaintea înțelegerii, deci
     * o frază despre gospodărie care semăna cu un nume de produs — „gata cu casa luna
     * asta” — pleca la lista de produse fără ca ghidul să o citească măcar. Acum întâi
     * citim mesajul; abia ce nu înseamnă nimic pentru registru poate fi un produs.
     */
    if (!sentPhotos && !winner && looksLikeProductSearch(requestText)) {
      offerCatalog(requestText);
      return;
    }
    if (!sentPhotos && !escalate && isQuestion(requestText)) {
      const answer = analyze(requestText, data);
      if (answer) {
        addMessage({ role: "assistant", text: answerToText(answer), followUps: answer.followUps });
        return;
      }
    }
    if (blocked && !sentPhotos) {
      setQuota((current) => ({ ...current, mode: "local", remaining: Math.min(current.remaining, 0) }));
      localSend(true, raw);
      return;
    }
    setTyping(true);
    void (async () => {
      try {
        let onlineRequestText = requestText;
        let localReceiptAmount: number | undefined;
        const imageData = sentAttachments.filter((item) => item.mimeType.startsWith("image/") || !item.mimeType).map((item) => item.data);
        if (imageData.length) {
          try {
            const { readReceiptLocally, receiptReadIsReconciled } = await import("@/lib/receipt-utils");
            const local = await readReceiptLocally(imageData);
            localReceiptAmount = local.amount;
            const ocrItems = local.items.slice(0, 40).map((item) => `${item.label}=${item.amount}`).join("; ");
            const ocrHint = [
              t("[OCR local de verificare — nu este autoritate contabilă]"),
              local.vendor ? `magazin: ${local.vendor}` : "",
              local.date ? `data: ${local.date}` : "",
              local.amount ? `total candidat: ${local.amount}` : "",
              ocrItems ? `produse: ${ocrItems}` : "",
              local.text ? `text brut: ${local.text.slice(0, 5000)}` : "",
            ].filter(Boolean).join("\n");
            if (local.amount) {
              pendingReceiptRef.current = {
                vendor: local.vendor || t("Bon"),
                amount: local.amount,
                date: local.date,
                items: local.items.map((item) => ({ label: item.label, amount: item.amount, category: item.category })),
              };
              const extracted: ExtractedGuide = {
                amount: local.amount,
                title: local.vendor || t("Bon"),
                vendor: local.vendor,
                date: local.date,
                category: dominantReceiptCategory(local.items),
                confidence: receiptReadIsReconciled(local) ? "high" : "medium",
              };
              const localProposal = expenseProposal(requestText, extracted, data, guideMemory.current, true);
              if (localProposal) {
                setTyping(false);
                offerSpend(localProposal);
                return;
              }
            }
            if (sentAttachments.length === 1) {
              setTyping(false);
              setAttachments(sentAttachments);
              addMessage({ role: "assistant", text: t("Nu văd TOTAL pe această poză. Adaugă și partea de jos a bonului — a doua fotografie — apoi trimite din nou.") });
              return;
            }
            onlineRequestText = `${requestText}\n\n${ocrHint}`;
          } catch {
            // Analiza vizuală online rămâne disponibilă și fără OCR local.
          }
        }
        if (blocked) {
          setQuota((current) => ({ ...current, mode: "local", remaining: Math.min(current.remaining, 0) }));
          setTyping(false);
          localSend(true, raw);
          return;
        }
        const [token, identity] = await Promise.all([appCheckHeader(), authHeader()]);
        const headers: Record<string, string> = { "content-type": "application/json" };
        if (token) headers["X-Firebase-AppCheck"] = token;
        if (identity) headers.Authorization = identity;
        const response = await fetch("https://europe-central2-buget-familie-a6a0d.cloudfunctions.net/aiGuide", {
          method: "POST", headers,
          body: JSON.stringify({ messages: [...messages, { role: "user", text: onlineRequestText }].slice(-20), context: compactGuideContext(data, { view, income: monthSummary.income, expense: monthSummary.expense }) }),
        });
        const payload = await response.json() as {
          reply?: string;
          intent?: string;
          /** Intențiile citite de model, în aceeași formă ca cele citite pe telefon. */
          readings?: unknown;
          needsConfirmation?: boolean;
          extracted?: ExtractedGuide;
          quota?: { remaining?: number | null; limit?: number | null; resetAt?: string | null };
          code?: string;
        };
        const nextQuota = consumeQuota(quota, payload.quota, response.ok, response.status === 429 || payload.code === "quota");
        setQuota(nextQuota);
        if (!response.ok) throw new Error(payload.code || "AI unavailable");
        setTyping(false);
        /**
         * Ce a înțeles modelul este ce se scrie — dacă trece validarea. Până acum
         * răspunsul lui era doar un cuvânt, iar propunerea se refăcea din textul
         * brut prin euristici: două adevăruri paralele, din care câștiga cel mai
         * slab. Acum trece prin aceeași poartă ca citirea locală, deci ajunge la
         * aceeași confirmare, aceeași alegere a zilei și aceleași alternative.
         *
         * Nimic nu e crezut pe cuvânt: `parseModelIntents` aruncă orice intenție
         * incompletă sau imposibilă, iar dacă nu rămâne nimic valid, mesajul cade
         * pe drumul dinainte. Un răspuns stricat nu poate scrie în registru.
         */
        const modelIntents = sentPhotos ? [] : parseModelIntents(payload.readings, { asOf: isoToday(), message: requestText });
        /**
         * Ce spune modelul despre lucruri existente se leagă de ele sau se spune pe față.
         * Un „mut 200 din Transport în Alimente” fără plicurile alea era aruncat în tăcere,
         * iar omul primea textul modelului — care povestea o mutare ce nu s-a întâmplat.
         */
        const { kept, missing } = resolveIntents(modelIntents, data);
        if (kept.length) {
          act({ kind: "intents", score: 100, why: "citit de model", intents: kept });
          if (missing.length) addMessage({ role: "assistant", text: t("Nu găsesc {what}. Restul e mai sus, gata de confirmat.", { what: missing.join(", ") }) });
          return;
        }
        if (missing.length) {
          addMessage({ role: "assistant", text: t("Nu găsesc {what}. Spune-mi numele exact așa cum e în aplicație, sau creează-l întâi.", { what: missing.join(", ") }) });
          return;
        }
        // Nici modelul nu a ales: atunci întrebarea e cinstită, iar textul lui rămâne deasupra.
        if (picks) {
          askWhich(payload.reply);
          return;
        }
        /**
         * Escaladarea nu are voie să piardă ce înțelesesem deja. „Adaugă scadența chirie
         * 1500 pe data de 5” pleca online fiindcă rămânea o sumă necitită, iar când modelul
         * nu întorcea nimic, omul primea doar textul lui: scadența citită corect pe telefon
         * se pierdea pe drum. Dacă modelul n-a adus nimic de scris, ne întoarcem la citirea
         * noastră, aceeași pe care ar fi arătat-o și fără rețea.
         */
        if (escalate && winner && winner.kind === "intents") {
          setMemory(markLocalSave());
          if (act(winner)) return;
        }
        if (payload.intent === "question" || payload.intent === "summary" || payload.intent === "next_step") {
          const localAnswer = analyze(requestText, data);
          if (localAnswer) {
            addMessage({ role: "assistant", text: answerToText(localAnswer), followUps: localAnswer.followUps });
            return;
          }
        }
        const receiptExtracted = sentPhotos && localReceiptAmount && localReceiptAmount > 0
          ? { ...payload.extracted, amount: localReceiptAmount }
          : payload.extracted;
        const lastSpendText = [...messages].reverse().find((item) => item.role === "user" && expenseProposal(item.text, undefined, data, guideMemory.current))?.text || requestText;
        const extractedText = payload.extracted?.vendor ? `${sourceTextSafe(requestText)} ${payload.extracted.vendor}` : requestText;
        const sourceText = isConfirm(raw) ? lastSpendText : extractedText;
        const proposal = payload.intent === "income" || payload.intent === "allocation" || payload.intent === "debt"
          ? undefined
          : expenseProposal(sourceText, receiptExtracted, data, guideMemory.current, Boolean(sentPhotos) || payload.intent === "expense" || /cheltuial/.test(payload.reply || ""));
        if (proposal) {
          offerSpend(proposal);
          return;
        }
        const updates = updatesFromGuide(payload.intent, payload.extracted, raw, data, messages);
        const saveNow = updates.length > 0 && (!payload.needsConfirmation || isConfirm(raw) || claimsSaved(payload.reply || "") || payload.intent === "allocation" || payload.intent === "debt");
        if (saveNow) applyGuide(updates);
        addMessage({
          role: "assistant",
          text: payload.reply || t("Am analizat mesajul. Spune-mi ce vrei să facem în continuare."),
          action: saveNow && updates.some((update) => update.kind === "income")
            ? { type: "journal", label: t("Vezi în Mișcări") }
            : saveNow && updates.some((update) => update.kind === "allocation")
              ? { type: "plan", label: t("Vezi tranșele în Plan") }
              : !saveNow && updates.length
              ? { type: "apply", label: `Adaugă ${updates.filter((update) => "amount" in update).map((update) => money((update as { amount: number }).amount)).join(" + ")} în registru` }
              : undefined,
          updates: !saveNow && updates.length ? updates : undefined,
        });
      } catch {
        setQuota((current) => current.remaining <= 0 ? { ...current, mode: "local", remaining: 0 } : current);
        setTyping(false);
        if (picks) askWhich();
        else localSend(true, raw);
      }
    })();
  };
  const lastAssistant = [...messages].reverse().find((item) => item.role === "assistant");
  const pendingUpdate = lastAssistant?.action?.type === "apply"
    ? lastAssistant.updates?.find((item) => item.kind === "expense" || item.kind === "income" || item.kind === "funds")
    : undefined;
  /** Banii declarați din propunerea curentă: pentru ei se arată și rândul de surse. */
  const pendingFunds = lastAssistant?.action?.type === "apply"
    ? lastAssistant.updates?.find((item): item is Extract<FinancialUpdate, { kind: "funds" }> => item.kind === "funds")
    : undefined;
  const fundsSourceId = pendingFunds ? pickFundsSource(data, pendingFunds.sourceHint, pendingFunds.sourceId)?.id : undefined;
  const pendingKind = pendingUpdate?.kind
    || lastAssistant?.choices?.find((item) => item.update.kind === "expense" || item.update.kind === "income")?.update.kind;
  const pendingSpend = Boolean(pendingKind);
  const shown = shownChatMessages(messages, historyOpen);
  const hiddenCount = hiddenChatCount(messages);
  return <><button type="button" className="os-ghid" hidden aria-hidden="true" tabIndex={-1}><span className="os-ghid-bf">BF</span><span className="os-ghid-label">{t("Ghidul tău")}</span>{open ? <ChevronDown size={14} /> : <span className="os-ghid-pace">Azi {todayPace} RON</span>}</button>{open && <aside className={`ai-companion-panel ai-chat-panel${historyOpen ? "" : " is-history-collapsed"}`} aria-label={t("Conversație cu ghidul tău AI")}><header className="ai-companion-head"><div className="ai-avatar"><Bot size={18} /></div><div className="ai-head-copy"><p className="ai-eyebrow">GHIDUL TĂU · {quota.mode === "local" ? "LOCAL" : "ONLINE"}</p><h2>{t("Sunt aici cu tine")}</h2><span className={`ai-status ${quota.mode === "local" ? "is-local" : ""}`}><i /> {quota.mode === "local" ? t("Ghid local până {when}", { when: formatReset(quota.resetAt) }) : t("Îți răspund din contextul bugetului tău")}</span></div><div className="ai-head-actions"><button type="button" className="ai-tool" onClick={clearChat}><Trash2 size={15} /><span>{t("Golește")}</span></button><button type="button" className="ai-tool ai-tool-close" aria-label={t("Închide ghidul")} onClick={() => { setOpen(false); }}><X size={16} /></button></div></header><GuideQuotaBar quota={quota} habits={memory.phrases.filter((item) => item.count >= 2).length} />{hiddenCount > 0 ? <button type="button" className="ai-history-toggle" onClick={() => setHistoryOpen((current) => !current)}>{historyOpen ? <><ChevronUp size={13} /> {t("Restrânge istoricul")}</> : <><ChevronDown size={13} /> {t("Istoric ({count})", { count: String(hiddenCount) })}</>}</button> : null}<div className={`ai-chat-history${shown.length ? "" : " is-empty"}`} ref={historyRef} aria-live="polite">{shown.map((item) => <div className={`ai-chat-row ${item.role}`} key={item.id}><div className="ai-chat-bubble">{item.role === "assistant" && <Bot size={14} /> }<GuideText text={item.text} /></div>{item.action && <button type="button" className="ai-chat-action" onClick={() => handleAction(item)}><CircleCheck size={14} /> {item.action.label}</button>}{item.undo && onRevert && <button type="button" className="ai-chat-action" onClick={() => { const undone = item.undo; if (!undone) return; onRevert(undone); setMessages((current) => current.map((entry) => entry.id === item.id ? { ...entry, undo: undefined, text: t("Am anulat {title} {amount}.", { title: undone.title, amount: money(undone.amount) }) } : entry)); }}>{t("Anulează")}</button>}{item.choices && item.choices.length > 0 && <div className="ai-chat-choices">{item.choices.map((choice) => <button type="button" className={pickedChoice?.label === choice.label ? "ai-chat-action is-on" : "ai-chat-action"} key={choice.label} onClick={() => applyChoice(choice)}>{choice.label}</button>)}</div>}{item.picks && item.picks.length > 0 && <div className="ai-chat-choices">{item.picks.map((pick) => <button type="button" className="ai-chat-action" key={pick.label} onClick={() => { setMemory(markLocalSave()); act(pick.reading); }}>{pick.label}</button>)}</div>}{item.followUps && item.followUps.length > 0 && <div className="ai-chat-followups">{item.followUps.map((question) => <button type="button" key={question} onClick={() => send(question)}>{question}</button>)}</div>}</div>)}{!shown.length && !typing ? <p className="ai-chat-empty">{t("Conversația începe aici. Scrie-mi orice despre banii tăi.")}</p> : null}{typing && <div className="ai-chat-row assistant"><div className="ai-chat-bubble ai-typing"><i /><i /><i /></div></div>}</div>{pendingFunds ? <div className="ai-date-bar ai-source-bar"><p>{t("Unde sunt banii?")} · {money(pendingFunds.amount)}</p><small>{pendingFunds.sourceId ? t("Îi trec pe „{name}”.", { name: pickFundsSource(data, pendingFunds.sourceHint, pendingFunds.sourceId)?.name || "" }) : t("Atinge locul lor; altfel îi trec pe „{name}”.", { name: pickFundsSource(data, pendingFunds.sourceHint, pendingFunds.sourceId)?.name || "" })}</small><div className="ai-date-row">{data.settings.paymentSources.map((source) => { const persoana = data.settings.members.find((item) => item.id === source.memberId)?.name; return <button type="button" key={source.id} className={`ai-date-chip ${fundsSourceId === source.id ? "is-on" : ""}`} onClick={() => applyFundsSource(source.id)}>{source.name}{persoana && data.settings.members.length > 1 ? ` · ${persoana}` : ""}</button>; })}</div></div> : null}{pendingSpend ? <div className="ai-date-bar"><p>{pendingKind === "funds" ? t("Din ce zi sunt banii?") : `Pe ce zi treci ${pendingKind === "income" ? "venitul" : t("mișcarea")}?`} · {dateCopy(spendDay)}</p><small>{pendingKind === "funds" ? t("Dacă banii sunt de ieri sau de acum trei zile, alege ziua — altfel îi trec pe azi.") : pickedChoice && !dateTapped ? t("Am ținut {label}. Alege și ziua, apoi salvez.", { label: pickedChoice.label }) : dateTapped && !pickedChoice ? t("Ziua e aleasă. Alege de unde scoatem banii.") : t("Alege plicul și ziua — salvez după ambele.")}</small><div className="ai-date-row"><button type="button" className={`ai-date-chip ${dateTapped && spendDay === shiftDay(-2) ? "is-on" : ""}`} onClick={() => applySpendDay(shiftDay(-2))}>{t("Alaltăieri")}</button><button type="button" className={`ai-date-chip ${dateTapped && spendDay === shiftDay(-1) ? "is-on" : ""}`} onClick={() => applySpendDay(shiftDay(-1))}>{t("Ieri")}</button><button type="button" className={`ai-date-chip ${dateTapped && spendDay === shiftDay(0) ? "is-on" : ""}`} onClick={() => applySpendDay(shiftDay(0))}>{t("Azi")}</button><label className="ai-date-field">{t("Calendar")}<RoDateInput value={spendDay} onChange={(event) => event.target.value && applySpendDay(event.target.value)} /></label></div></div> : null}<div className="ai-chat-suggestions"><button type="button" onClick={() => runAction("add", t("Vreau să adaug o mișcare"))}>{t("+ Adaugă o mișcare")}</button><button type="button" onClick={() => { window.dispatchEvent(new CustomEvent("buget-familie:open-catalog")); setOpen(false); }}>{t("Caută un produs")}</button>{suggestions.map((item) => <button type="button" key={item.text} title={item.why} onClick={() => send(item.text)}>{item.text}</button>)}</div><form className="ai-natural-form ai-chat-input" onSubmit={(event) => { event.preventDefault(); send(); }}><label htmlFor="ai-natural-message">{t("Scrie-mi orice despre banii tăi sau încarcă un bon")}</label>{attachments.length > 0 && <div className="ai-attachment-list">{attachments.map((item, index) => <div className="ai-attachment-chip" key={`${item.name}-${index}`}><FileText size={14} /><span>{item.name}</span><button type="button" onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={t("Elimină atașamentul")}>×</button></div>)}{attachments.length === 1 ? <p className="ai-attachment-hint">{t("Mai poți adăuga o poză — partea de jos, unde scrie TOTAL.")}</p> : null}</div>}<div><input id="ai-natural-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder={attachments.length ? t("Opțional: spune-mi ceva despre bon") : t("ex. am dat 50 lei pe benzină")} /><label className="ai-attach-button" aria-label={t("Atașează bon (până la 2 poze)")}><Paperclip size={16} /><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,image/*" multiple onChange={(event) => { void handleAttachments(event.target.files); event.currentTarget.value = ""; }} disabled={attachmentBusy || typing || attachments.length >= 2} /></label><button type="submit" aria-label={t("Trimite mesajul")} disabled={attachmentBusy || typing || (!message.trim() && !attachments.length)}><Send size={16} /></button></div><p><Lightbulb size={12} /> {t("Exemple: «am dat 50 lei pe benzină». Bon lung: 2 poze — sus și jos. Salvez doar după confirmarea ta.")}</p></form><p className="ai-privacy"><WalletCards size={13} /> {t("Conversația rămâne pe telefon. La Gemini pleacă doar un rezumat, dacă ghidul local n-a înțeles.")}</p></aside>}</>;
}

export default AICompanion;
