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
    case "income": return { kind: "income", amount: intent.amount, title: intent.title, date: intent.date };
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
      const head = `cheltuială ${money(intent.amount)} · ${intent.category} · ${formatDate(intent.date)}`;
      if (!data) return head;
      const offer = buildExpenseOffer(data, intent, memory);
      const first = offer.choices[0];
      return first ? `${head}\n  ↳ ${first.label}` : `${head}\n  ↳ ${offer.text}`;
    }
    case "income": {
      const head = `venit ${money(intent.amount)} · ${intent.title} · ${formatDate(intent.date)}`;
      if (!data) return head;
      const target = planIncome(data)[0];
      return target ? `${head}\n  ↳ intră în ${target.source.name} (${money(target.balance)} acum)` : head;
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
          ? `plicul „${intent.label}”: ${intent.delta === "increase" ? "+" : "−"}${money(intent.amount)} (${money(before)} → ${money(after)})`
          : `plicul „${intent.label}” cu ${money(intent.amount)} — nu există încă, îl creez`;
      }
      if (intent.delta) return `plicul „${intent.label}”: ${intent.delta === "increase" ? "+" : "−"}${money(intent.amount)}`;
      if (intent.amountIsWeekly) return `plicul „${intent.label}” cu ${money(intent.amount)} pe săptămână întreagă, până la venit`;
      /**
       * Ritmul se scrie în propunere, nu se lasă pe ghicite: omul cere „împarte-mi banii pe
       * săptămâni”, vede o listă de plicuri cu totaluri și crede că n-am împărțit nimic.
       */
      const saptamani = intent.weeklyPace && !intent.weeklyLimit && data ? planWeeks(data) : 0;
      const ritm = saptamani > 1 ? `, pe săptămâni (~${money(Math.round(intent.amount / saptamani))} pe săptămână)` : "";
      return `plicul „${intent.label}” cu ${money(intent.amount)}${intent.weeklyLimit ? `, limită săptămânală ${money(intent.weeklyLimit)}` : ritm}`;
    }
    case "debt": return `datoria „${intent.name}”, sold ${money(intent.remaining)}${intent.monthly ? `, rată ${money(intent.monthly)}` : ""}`;
    case "recurring": return `scadența „${intent.name}”, ${money(intent.amount)} pe data de ${intent.dueDay}`;
    case "goal": return `obiectivul „${intent.name}”, țintă ${money(intent.target)}${intent.current ? `, strâns ${money(intent.current)}` : ""}`;
    case "funds": {
      const source = data ? pickFundsSource(data, intent.sourceHint, intent.sourceId) : undefined;
      if (!source || !data) return `banii pe care îi ai acum: ${money(intent.amount)}`;
      /**
       * Se scrie cât intră, nu doar cât ai. Când sursa are deja bani, în Mișcări intră
       * doar diferența — altfel omul ar vedea o intrare mai mare decât ce s-a schimbat.
       */
      const diferenta = Math.round((intent.amount - sourceBalance(data, source.id)) * 100) / 100;
      if (Math.abs(diferenta) < 0.005) return `banii pe care îi ai acum: ${money(intent.amount)} pe „${source.name}” — atât arată și acum, nu am ce schimba`;
      const cand = intent.date && intent.date !== isoToday() ? `, pe ${formatDate(intent.date)}` : "";
      return diferenta > 0
        ? `banii pe care îi ai acum: ${money(intent.amount)} pe „${source.name}” — trec ${money(diferenta)} ca intrare în Mișcări${cand}`
        : `banii pe care îi ai acum: ${money(intent.amount)} pe „${source.name}” — scad ${money(Math.abs(diferenta))} din registru${cand}, ca să iasă soldul`;
    }
    case "envelope-delete": {
      const current = data?.settings.salaryPlan.allocations.find((item) => item.label === intent.label || item.category === intent.label);
      return current
        ? `șterge plicul „${current.label}” — cei ${money(current.amount)} din el se întorc în nerepartizat`
        : `șterge plicul „${intent.label}” — nu găsesc niciun plic cu numele ăsta`;
    }
    case "planned-event": return `evenimentul „${intent.name}” pe ${formatDate(intent.date, { day: "2-digit", month: "long", year: "numeric" })}${intent.estimate ? `, cost estimat ${money(intent.estimate)}` : ", fără cost estimat încă"}${intent.repeat === "yearly" ? ", în fiecare an" : ""}`;
    case "payday": return `următorul venit pe ${formatDate(intent.date, { day: "2-digit", month: "long", year: "numeric" })}${intent.flexDays ? `, cu ${intent.flexDays} zile de flexibilitate` : ""}`;
    case "transfer": return `mută ${money(intent.amount)} din plicul „${intent.from}” în „${intent.to}” — banii rămân pe același card`;
    case "event-contribution": return `pune ${money(intent.amount)} deoparte pentru „${intent.name}” — socoteală de planificare, nu iese din surse`;
    case "due-paid": {
      const due = data ? matchRecurring(data, intent.name) : undefined;
      return due
        ? `scadența „${due.name}”, ${money(due.amount)} — o trec ca plătită`
        : `scadența „${intent.name}” — nu o găsesc printre plățile tale recurente`;
    }
    case "open": return `deschid ecranul ${SCREEN_NAMES[intent.screen]}`;
    /**
     * La o corectare se scrie rândul găsit, nu ce a spus omul: „50 lei” poate fi oricare
     * dintre trei cafele. Dacă pe ecran scrie ziua și titlul exact, confirmarea e informată.
     */
    case "transaction-delete": {
      const found = data ? matchTransaction(data, { title: intent.title, amount: intent.amount, date: intent.date }) : undefined;
      return found
        ? `șterge mișcarea „${found.title}” · ${money(found.amount)} · ${formatDate(found.date)}`
        : `șterge mișcarea „${intent.title || ""}” — nu o găsesc în registru`;
    }
    case "transaction-amend": {
      const found = data ? matchTransaction(data, { title: intent.title, amount: intent.was, date: intent.date }) : undefined;
      return found
        ? `corectează „${found.title}” · ${formatDate(found.date)}: ${money(found.amount)} → ${money(intent.amount)}`
        : `corectează „${intent.title || ""}” — nu găsesc mișcarea`;
    }
    case "merchant-rule": {
      const unde = intent.envelope ? `plicul „${intent.envelope}”` : `categoria ${intent.category}`;
      return `regulă: de fiecare dată când scrie „${intent.match}”, propun ${unde}`;
    }
    case "salary-rule": {
      const cat = intent.mode === "percent" ? `${intent.value}%` : money(intent.value);
      return `din fiecare venit, ${cat} merg în plicul „${intent.envelope}” — se aplică la venitul următor`;
    }
  }
}

/** Textul propunerii, scris o singură dată ca să poată fi refăcut la schimbarea zilei. */
export function proposalText(intents: AssistantIntent[], data?: AppData, memory?: GuideMemory, headline?: string, warning?: string): string {
  // O propunere de împărțire nu e o înțelegere a mesajului, deci nu se anunță „am înțeles”.
  // Titlul propriu își aduce punctul lui; lista de dedesubt adaugă „:”, deci ar ieși „.:”.
  const head = (headline ? headline.replace(/\.$/, "") : undefined) || (intents.length === 1 ? "Am înțeles" : `Am înțeles ${intents.length} lucruri`);
  const avertisment = warning ? `\n\n${warning}` : "";
  return `${head}:\n${intents.map((item) => `• ${describeIntent(item, data, memory)}`).join("\n")}${avertisment}\n\nConfirmi să le trec în registru?`;
}

/** Alternativele se arată doar când mesajul conține exact o cheltuială; altfel ar fi ambiguu ce schimbă atingerea. */
export function spendAlternatives(data: AppData, parsed: ParsedIntent[], memory?: GuideMemory): ChatChoice[] | undefined {
  if (parsed.length !== 1) return undefined;
  const intent = parsed[0].intent;
  if (intent.kind !== "expense") return undefined;
  const choices = buildExpenseOffer(data, intent, memory).choices;
  return choices.length ? choices : undefined;
}

