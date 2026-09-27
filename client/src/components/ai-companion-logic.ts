/** Ghidul: din ce scrie omul sau din răspunsul modelului, ce actualizare propunem și cum o descriem. */
import { formatDate, isoToday, matchingAllocationsForExpense, sourceBalance, type AppData } from "@/lib/finance-data";
import { t } from "@/lib/i18n";
import { type AppScreen, type AssistantIntent, type ParsedIntent } from "@/lib/assistant-intents";
import {
  memberIdFor,
  planWeeks,
  matchEnvelope,
  matchPlannedEvent,
  matchRecurring,
  matchTransaction,
  parsePayday,
  parseWeeks,
  spendDate,
  buildExpenseOffer,
  type ChatChoice,
  type ExtractedGuide,
  type FinancialUpdate,
  type GuideMemory,
} from "@/lib/understand";
import { planIncome } from "@/lib/suggest-source";
import { money } from "@/components/ai-companion-parts";
import type { ChatMessage } from "@/components/AICompanion";

function allAmounts(raw: string) {
  const matches = raw.match(/\d[\d.\s]*(?:,\d{1,2})?/g) || [];
  return matches.map((tokenRaw) => {
    const token = tokenRaw.replace(/\s/g, "");
    const normalized = token.includes(",") ? token.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(?:\.\d{3})+$/.test(token) ? token.replace(/\./g, "") : token;
    return parseFloat(normalized) || 0;
  }).filter((value) => value >= 20);
}

function parseWeeklyAmount(raw: string) {
  const folded = raw.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const match = folded.match(/(\d[\d .]*)\s*(?:lei|ron)?\s*(?:\/|pe)\s*saptaman/);
  return match ? allAmounts(match[1])[0] : undefined;
}

function parseAllocationUpdate(extracted: ExtractedGuide | undefined, userText: string): FinancialUpdate | undefined {
  const folded = userText.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const looksLikeEnvelope = Boolean(extracted?.category) || /plic|imparte|repartiz|aloc|aliment|saptaman/.test(folded);
  if (!looksLikeEnvelope) return undefined;
  const weeklyAmount = parseWeeklyAmount(userText);
  const amounts = allAmounts(userText).filter((value) => value !== weeklyAmount && value < 1900);
  let amount = extracted?.amount;
  if (!amount && amounts.length) {
    amount = /din (cei|cei|cele)|imparte din/.test(folded) && amounts.length >= 2 ? Math.min(...amounts.filter((value) => value >= 100)) : amounts.find((value) => value >= 100) || amounts[0];
  }
  if (!amount) return undefined;
  const category = extracted?.category
    || (/aliment/.test(folded) ? "Alimente" : /transport|taxi/.test(folded) ? "Transport" : /factura|casa|chirie/.test(folded) ? "Casă & facturi" : /econom/.test(folded) ? "Economii" : "Alimente");
  const weeks = parseWeeks(userText) || (weeklyAmount ? Math.round(amount / weeklyAmount) : 4);
  return { kind: "allocation", category, amount, weekly: true, weeklyAmount, weeks: weeks >= 2 && weeks <= 12 ? weeks : 4, payday: parsePayday(userText) };
}

export function updatesFromGuide(intent: string | undefined, extracted: ExtractedGuide | undefined, userText: string, data: AppData, history: ChatMessage[] = []): FinancialUpdate[] {
  const sourceText = allAmounts(userText).length ? userText : [...history].reverse().find((item) => item.role === "user" && allAmounts(item.text).length)?.text || userText;
  if (intent === "expense") return [];
  if (intent === "debt" && (extracted?.debtName || extracted?.title) && (extracted.amount || extracted.monthlyPayment)) {
    const updates: FinancialUpdate[] = [];
    if (extracted.amount) updates.push({ kind: "debt", name: extracted.debtName || extracted.title || "Datorie", remaining: extracted.amount, due: extracted.dueDay ? `Ziua ${extracted.dueDay}` : undefined });
    if (extracted.monthlyPayment) updates.push({ kind: "debt-monthly", amount: extracted.monthlyPayment, name: extracted.debtName || extracted.title || "Datorie" });
    return updates;
  }
  const envelope = parseAllocationUpdate(extracted, sourceText);
  if (intent === "allocation" || envelope && /plic|imparte|repartiz|aloc|aliment.*saptaman|saptaman/.test(sourceText.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) {
    if (envelope) return [envelope];
  }
  if (intent !== "income" && intent !== "next_step" && intent !== "summary") {
    if (!/venit|salariu|intrare|întrare/i.test(sourceText) && !extracted?.amount && !extracted?.items?.length) return [];
  }
  const named = (extracted?.items || []).filter((item): item is { amount: number; title?: string } => Boolean(item.amount && item.amount > 0));
  if (named.length) {
    return named.map((item, index) => ({ kind: "income" as const, amount: item.amount, title: item.title || (index ? "Salariu partener" : "Salariu"), date: spendDate(sourceText), memberId: memberIdFor(data, item.title || "", index) }));
  }
  const spoken = allAmounts(sourceText);
  if (spoken.length >= 2 && /salariu|venit|sotie|soție|partener|intrare|întrare/i.test(sourceText)) {
    return spoken.slice(0, 3).map((amount, index) => ({
      kind: "income" as const,
      amount,
      title: index === 0 ? "Salariu" : index === 1 ? "Salariu partener" : `Venit ${index + 1}`,
      date: spendDate(sourceText),
      memberId: memberIdFor(data, sourceText, index),
    }));
  }
  if (extracted?.amount) {
    return [{ kind: "income", amount: extracted.amount, title: extracted.title || t("Venit lunar"), date: spendDate(sourceText), memberId: memberIdFor(data, extracted.title || sourceText, 0) }];
  }
  if (spoken.length === 1 && /venit|salariu|intrare|întrare/i.test(sourceText)) {
    return [{ kind: "income", amount: spoken[0], title: /salariu/i.test(sourceText) ? "Salariu" : t("Venit lunar"), date: spendDate(sourceText), memberId: data.settings.members[0]?.id }];
  }
  return [];
}

/**
 * Unde se pun banii declarați. Indiciul din frază („în card”, „cash”) alege sursa; altfel
 * prima sursă a omului. Nu se creează surse noi dintr-o frază — ar apărea conturi pe care
 * nu le-a cerut nimeni.
 */
export const pickFundsSource = (data: AppData, hint?: string, sourceId?: string) => {
  const sources = data.settings.paymentSources;
  // Alegerea omului bate orice indiciu din frază: el știe unde sunt banii.
  const ales = sourceId ? sources.find((item) => item.id === sourceId) : undefined;
  if (ales) return ales;
  if (hint) {
    const match = sources.find((item) => item.kind === hint);
    if (match) return match;
  }
  return sources[0];
};

/**
 * Intenția, tradusă în lucrul pe care aplicația îl face. Întoarce `undefined` când
 * intenția vorbește despre ceva ce nu există în registru — un plic, un eveniment sau o
 * scadență pe care nu le găsim — ca să nu ajungă în propunere un buton care nu face nimic.
 */
export function intentToUpdate(intent: AssistantIntent, data?: AppData, memory?: GuideMemory): FinancialUpdate | undefined {
  switch (intent.kind) {
    case "expense": {
      if (data) {
        const offer = buildExpenseOffer(data, intent, memory);
        const picked = offer.choices[0]?.update;
        if (picked && picked.kind === "expense") return picked;
      }
      return { kind: "expense", amount: intent.amount, title: intent.title, category: intent.category, date: intent.date };
    }
    case "income": return { kind: "income", amount: intent.amount, title: intent.title, date: intent.date, memberId: intent.memberId };
    case "income-split": return { kind: "income-split" };
    case "envelope": return { kind: "allocation", label: intent.label, category: intent.category || intent.label, amount: intent.amount, weekly: intent.weeklyPace, weeklyAmount: intent.weeklyLimit, amountIsWeekly: intent.amountIsWeekly, delta: intent.delta };
    case "debt": return { kind: "debt", name: intent.name, remaining: intent.remaining };
    case "recurring": return { kind: "recurring", name: intent.name, amount: intent.amount, dueDay: intent.dueDay, category: intent.category };
    case "goal": return { kind: "goal", name: intent.name, target: intent.target, current: intent.current, dueDate: intent.dueDate };
    case "planned-event": return { kind: "planned-event", name: intent.name, date: intent.date, estimate: intent.estimate, repeat: intent.repeat };
    case "envelope-delete": return { kind: "allocation-delete", label: intent.label };
    case "funds": return { kind: "funds", amount: intent.amount, sourceHint: intent.sourceHint as "cash" | "card" | "meal" | undefined, sourceId: intent.sourceId, date: intent.date };
    case "payday": return { kind: "payday", date: intent.date, flexDays: intent.flexDays };
    case "transfer": {
      const from = data ? matchEnvelope(data, intent.from) : undefined;
      const to = data ? matchEnvelope(data, intent.to) : undefined;
      if (!from || !to || from.id === to.id) return undefined;
      return { kind: "transfer", amount: intent.amount, fromId: from.id, toId: to.id, fromLabel: from.label, toLabel: to.label };
    }
    case "event-contribution": {
      const event = data ? matchPlannedEvent(data, intent.name) : undefined;
      if (!event) return undefined;
      return { kind: "event-contribution", eventId: event.id, name: event.name, amount: intent.amount, date: intent.date || isoToday() };
    }
    case "open": return undefined; // nu scrie nimic în registru: se deschide un ecran
    case "transaction-delete": {
      const found = data ? matchTransaction(data, { title: intent.title, amount: intent.amount, date: intent.date }) : undefined;
      return found ? { kind: "delete-transaction", id: found.id, title: found.title, amount: found.amount } : undefined;
    }
    case "transaction-amend": {
      const found = data ? matchTransaction(data, { title: intent.title, amount: intent.was, date: intent.date }) : undefined;
      return found ? { kind: "amend-transaction", id: found.id, amount: intent.amount, title: found.title, was: found.amount } : undefined;
    }
    case "merchant-rule": {
      const envelope = data && intent.envelope ? matchEnvelope(data, intent.envelope) : undefined;
      if (!intent.category && !envelope) return undefined;
      return { kind: "merchant-rule", match: intent.match, category: intent.category, allocationId: envelope?.id, envelopeLabel: envelope?.label };
    }
    case "salary-rule": {
      const envelope = data ? matchEnvelope(data, intent.envelope) : undefined;
      if (!envelope) return undefined;
      return { kind: "salary-rule", allocationId: envelope.id, label: intent.label || envelope.label, mode: intent.mode, value: intent.value };
    }
    case "due-paid": {
      const due = data ? matchRecurring(data, intent.name) : undefined;
      if (!due || !data) return undefined;
      const source = data.settings.paymentSources.find((item) => item.id === due.sourceId) || data.settings.paymentSources[0];
      const matched = matchingAllocationsForExpense(data, { category: due.category, memberId: due.memberId, sourceId: due.sourceId })[0];
      return {
        kind: "expense",
        amount: due.amount,
        title: due.name,
        category: due.category,
        date: intent.date || isoToday(),
        sourceId: source?.id,
        allocationId: matched?.id || "outside",
        memberId: due.memberId,
        recurringId: due.id,
      };
    }
  }
}

/** Ce spune asistentul înainte de confirmare — exact cifrele pe care le va scrie. */
/**
 * Ce a înțeles asistentul, scris pentru cineva care stă în magazin cu telefonul în
 * mână. La o cheltuială, „40 RON · Alimente” nu e destul ca să apeși pe salvează:
 * lipsește tocmai lucrul pe care îl decizi acolo — din ce plic se scad banii.
 * `buildExpenseOffer` alege locurile cu bani; omul atinge săptămâna.
 */
/** Numele ecranelor, exact cum le vede omul în aplicație. */
export const SCREEN_NAMES: Record<AppScreen, string> = {
  today: "Astăzi",
  journal: "Mișcări",
  plan: "Plan",
  obligations: "Obligații",
  goals: "Obiective",
  habits: "Obiceiuri",
  calendar: "Calendar",
  insights: "Analiză",
  utilities: "Mai mult",
};

function describeIntent(intent: AssistantIntent, data?: AppData, memory?: GuideMemory): string {
  switch (intent.kind) {
    case "expense": {
      const head = t("cheltuială {amount} · {category} · {date}", { amount: money(intent.amount), category: t(intent.category), date: formatDate(intent.date) });
      if (!data) return head;
      const offer = buildExpenseOffer(data, intent, memory);
      const first = offer.choices[0];
      return first ? `${head}\n  ↳ ${first.label}` : `${head}\n  ↳ ${offer.text}`;
    }
    case "income": {
      const head = t("venit {amount} · {title} · {date}", { amount: money(intent.amount), title: intent.title, date: formatDate(intent.date) });
      if (!data) return head;
      const target = planIncome(data)[0];
      const line = target ? `${head}\n  ↳ ${t("intră în {source} ({balance} acum)", { source: target.source.name, balance: money(target.balance) })}` : head;
      // „am primit salariul 4700” a doua oară: întreabă, nu dubla venitul.
      const twin = data.transactions.find((item) => item.kind === "income" && Math.abs(item.amount - intent.amount) < 0.005 && Math.abs(Date.parse(`${item.date}T12:00:00`) - Date.parse(`${intent.date}T12:00:00`)) <= 25 * 86_400_000);
      return twin ? `${line}\n  ⚠ ${t("Ai deja {title} {amount} pe {date}. E altul? Dacă nu, nu confirma.", { title: twin.title, amount: money(twin.amount), date: formatDate(twin.date) })}` : line;
    }
    case "envelope": {
      /**
       * La o ajustare se scrie și rezultatul, nu doar suma spusă: „mărește cu 200” și
       * „pune 200” arătau amândouă „plicul Alimente cu 200 RON”, deci o tăiere de 700 de
       * lei se confirma fără ca nimic din ecran să o dea de gol.
       */
      if (intent.delta && data) {
        const current = data.settings.salaryPlan.allocations.find((item) => item.label === intent.label || item.category === intent.label);
        const before = current?.amount ?? 0;
        const after = intent.delta === "increase" ? before + intent.amount : Math.max(0, before - intent.amount);
        return current
          ? t("plicul „{label}”: {sign}{amount} ({before} → {after})", { label: intent.label, sign: intent.delta === "increase" ? "+" : "−", amount: money(intent.amount), before: money(before), after: money(after) })
          : t("plicul „{label}” cu {amount} — nu există încă, îl creez", { label: intent.label, amount: money(intent.amount) });
      }
      if (intent.delta) return t("plicul „{label}”: {sign}{amount}", { label: intent.label, sign: intent.delta === "increase" ? "+" : "−", amount: money(intent.amount) });
      if (intent.amountIsWeekly) return t("plicul „{label}” cu {amount} pe săptămână întreagă, până la venit", { label: intent.label, amount: money(intent.amount) });
      /**
       * Ritmul se scrie în propunere, nu se lasă pe ghicite: omul cere „împarte-mi banii pe
       * săptămâni”, vede o listă de plicuri cu totaluri și crede că n-am împărțit nimic.
       */
      const saptamani = intent.weeklyPace && !intent.weeklyLimit && data ? planWeeks(data) : 0;
      const ritm = saptamani > 1 ? t(", pe săptămâni (~{amount} pe săptămână)", { amount: money(Math.round(intent.amount / saptamani)) }) : "";
      return `${t("plicul „{label}” cu {amount}", { label: intent.label, amount: money(intent.amount) })}${intent.weeklyLimit ? t(", limită săptămânală {amount}", { amount: money(intent.weeklyLimit) }) : ritm}`;
    }
    case "debt": return `${t("datoria „{name}”, sold {amount}", { name: intent.name, amount: money(intent.remaining) })}${intent.monthly ? t(", rată {amount}", { amount: money(intent.monthly) }) : ""}`;
    case "recurring": return t("scadența „{name}”, {amount} pe data de {day}", { name: intent.name, amount: money(intent.amount), day: intent.dueDay });
    case "goal": return `${t("obiectivul „{name}”, țintă {amount}", { name: intent.name, amount: money(intent.target) })}${intent.current ? t(", strâns {amount}", { amount: money(intent.current) }) : ""}`;
    case "funds": {
      const source = data ? pickFundsSource(data, intent.sourceHint, intent.sourceId) : undefined;
      if (!source || !data) return t("banii pe care îi ai acum: {amount}", { amount: money(intent.amount) });
      /**
       * Se scrie cât intră, nu doar cât ai. Când sursa are deja bani, în Mișcări intră
       * doar diferența — altfel omul ar vedea o intrare mai mare decât ce s-a schimbat.
       */
      const diferenta = Math.round((intent.amount - sourceBalance(data, source.id)) * 100) / 100;
      if (Math.abs(diferenta) < 0.005) return t("banii pe care îi ai acum: {amount} pe „{source}” — atât arată și acum, nu am ce schimba", { amount: money(intent.amount), source: source.name });
      const cand = intent.date && intent.date !== isoToday() ? t(", pe {date}", { date: formatDate(intent.date) }) : "";
      return diferenta > 0
        ? t("banii pe care îi ai acum: {amount} pe „{source}” — trec {diff} ca intrare în Mișcări{when}", { amount: money(intent.amount), source: source.name, diff: money(diferenta), when: cand })
        : t("banii pe care îi ai acum: {amount} pe „{source}” — scad {diff} din registru{when}, ca să iasă soldul", { amount: money(intent.amount), source: source.name, diff: money(Math.abs(diferenta)), when: cand });
    }
    case "envelope-delete": {
      const current = data?.settings.salaryPlan.allocations.find((item) => item.label === intent.label || item.category === intent.label);
      return current
        ? t("șterge plicul „{label}” — cei {amount} din el se întorc în nerepartizat", { label: current.label, amount: money(current.amount) })
        : t("șterge plicul „{label}” — nu găsesc niciun plic cu numele ăsta", { label: intent.label });
    }
    case "planned-event": return `${t("evenimentul „{name}” pe {date}", { name: intent.name, date: formatDate(intent.date, { day: "2-digit", month: "long", year: "numeric" }) })}${intent.estimate ? t(", cost estimat {amount}", { amount: money(intent.estimate) }) : t(", fără cost estimat încă")}${intent.repeat === "yearly" ? t(", în fiecare an") : ""}`;
    case "payday": return `${t("următorul venit pe {date}", { date: formatDate(intent.date, { day: "2-digit", month: "long", year: "numeric" }) })}${intent.flexDays ? t(", cu {days} zile de flexibilitate", { days: intent.flexDays }) : ""}`;
    case "transfer": return t("mută {amount} din plicul „{from}” în „{to}” — banii rămân pe același card", { amount: money(intent.amount), from: intent.from, to: intent.to });
    case "event-contribution": return t("pune {amount} deoparte pentru „{name}” — socoteală de planificare, nu iese din surse", { amount: money(intent.amount), name: intent.name });
    case "due-paid": {
      const due = data ? matchRecurring(data, intent.name) : undefined;
      return due
        ? t("scadența „{name}”, {amount} — o trec ca plătită", { name: due.name, amount: money(due.amount) })
        : t("scadența „{name}” — nu o găsesc printre plățile tale recurente", { name: intent.name });
    }
    case "open": return t("deschid ecranul {screen}", { screen: t(SCREEN_NAMES[intent.screen]) });
    /**
     * La o corectare se scrie rândul găsit, nu ce a spus omul: „50 lei” poate fi oricare
     * dintre trei cafele. Dacă pe ecran scrie ziua și titlul exact, confirmarea e informată.
     */
    case "transaction-delete": {
      const found = data ? matchTransaction(data, { title: intent.title, amount: intent.amount, date: intent.date }) : undefined;
      return found
        ? t("șterge mișcarea „{title}” · {amount} · {date}", { title: found.title, amount: money(found.amount), date: formatDate(found.date) })
        : t("șterge mișcarea „{title}” — nu o găsesc în registru", { title: intent.title || "" });
    }
    case "transaction-amend": {
      const found = data ? matchTransaction(data, { title: intent.title, amount: intent.was, date: intent.date }) : undefined;
      return found
        ? t("corectează „{title}” · {date}: {was} → {amount}", { title: found.title, date: formatDate(found.date), was: money(found.amount), amount: money(intent.amount) })
        : t("corectează „{title}” — nu găsesc mișcarea", { title: intent.title || "" });
    }
    case "merchant-rule": {
      const unde = intent.envelope ? t("plicul „{label}”", { label: intent.envelope }) : t("categoria {category}", { category: t(intent.category || "") });
      return t("regulă: de fiecare dată când scrie „{match}”, propun {target}", { match: intent.match, target: unde });
    }
    case "income-split": return intent.preview;
    case "salary-rule": {
      const cat = intent.mode === "percent" ? `${intent.value}%` : money(intent.value);
      return t("din fiecare venit, {share} merg în plicul „{label}” — se aplică la venitul următor", { share: cat, label: intent.envelope });
    }
  }
}

/** Textul propunerii, scris o singură dată ca să poată fi refăcut la schimbarea zilei. */
export function proposalText(intents: AssistantIntent[], data?: AppData, memory?: GuideMemory, headline?: string, warning?: string): string {
  // O propunere de împărțire nu e o înțelegere a mesajului, deci nu se anunță „am înțeles”.
  // Titlul propriu își aduce punctul lui; lista de dedesubt adaugă „:”, deci ar ieși „.:”.
  const head = (headline ? headline.replace(/\.$/, "") : undefined) || (intents.length === 1 ? t("Am înțeles") : t("Am înțeles {count} lucruri", { count: intents.length }));
  const avertisment = warning ? `\n\n${warning}` : "";
  return `${head}:\n${intents.map((item) => `• ${describeIntent(item, data, memory)}`).join("\n")}${avertisment}\n\n${t("Confirmi să le trec în registru?")}`;
}

/** Alternativele se arată doar când mesajul conține exact o cheltuială; altfel ar fi ambiguu ce schimbă atingerea. */
export function spendAlternatives(data: AppData, parsed: ParsedIntent[], memory?: GuideMemory): ChatChoice[] | undefined {
  if (parsed.length !== 1) return undefined;
  const intent = parsed[0].intent;
  if (intent.kind !== "expense") return undefined;
  const choices = buildExpenseOffer(data, intent, memory).choices;
  return choices.length ? choices : undefined;
}

