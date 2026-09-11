/**
 * De unde iau banii.
 *
 * Când asistentul înțelege o cheltuială, „am înțeles: 40 RON · Alimente” nu este
 * încă destul ca să apeși pe salvează: mai lipsește tocmai lucrul pe care omul îl
 * decide în magazin — din ce sursă reală ies banii și din ce plic se scade.
 *
 * Aici calculăm recomandarea și, la fel de important, alternativele: fiecare
 * sursă cu soldul ei și fiecare plic cu cât mai are, ca alegerea să fie o
 * atingere, nu o căutare prin Setări.
 */
import {
  allocationStatus,
  allocationWeekStatus,
  sourceBalance,
  type AppData,
  type BudgetAllocation,
  type PaymentSource,
} from "./finance-data";

export type SourceOption = {
  source: PaymentSource;
  balance: number;
  /** Soldul acoperă suma cerută. */
  covers: boolean;
  owner: string;
};

export type EnvelopeOption = {
  allocation: BudgetAllocation;
  /** Cât mai are: tranșa săptămânii pentru plicurile cu ritm, altfel tot ciclul. */
  remaining: number;
  covers: boolean;
  /** „S2” când suma arătată este a săptămânii active. */
  weekLabel?: string;
  /**
   * Cât de bine se potrivește cu ce s-a cumpărat: plicul din care scoți de obicei
   * pentru lucrul ăsta, cel pe exact acea categorie, unul înrudit ca subiect
   * (dulciurile ies din alimente), sau doar unul care mai are bani. Propunerea se
   * oprește la „înrudit”; restul rămân de ales cu mâna.
   */
  match: "habit" | "exact" | "related" | "other";
};

/**
 * Ce plic ține locul altuia. Dulciurile se iau din alimente, nu din transport:
 * fără tabelul ăsta, „50 lei dulciuri” nu găsea niciun plic și ajungea în afara
 * lor, deși alimentele aveau bani.
 */
export function relatedCategories(category: string): string[] {
  const map: Record<string, string[]> = {
    Dulciuri: ["Alimente"],
    Băuturi: ["Alimente"],
    Apă: ["Alimente", "Casă & facturi"],
    Alimente: ["Dulciuri", "Băuturi"],
    Transport: [],
    "Casă & facturi": ["Apă"],
  };
  return map[category] || [];
}

export type SpendPlan = {
  sources: SourceOption[];
  envelopes: EnvelopeOption[];
  /** Sursa propusă: cea a plicului potrivit, altfel prima care acoperă suma. */
  source?: SourceOption;
  /** Plicul propus, dacă există unul compatibil. */
  envelope?: EnvelopeOption;
  /** Ce scrie asistentul în dreptul propunerii. */
  summary: string;
  /** Ce merită spus chiar dacă nu întreabă nimeni: sold insuficient, plic depășit. Pot fi ambele. */
  warnings: string[];
};

const money = (value: number) =>
  `${Number(value.toFixed(2)).toLocaleString("ro-RO", { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })} RON`;

const ownerName = (data: AppData, source: PaymentSource) =>
  source.memberId ? data.settings.members.find((item) => item.id === source.memberId)?.name || "Familie" : "Familie / comun";

/** Cât mai are un plic, în unitatea în care îl citește omul. */
const envelopeRemaining = (data: AppData, allocation: BudgetAllocation, date?: string): { remaining: number; weekLabel?: string } => {
  if (allocation.weeklyPace === false) return { remaining: allocationStatus(data, allocation).remaining };
  const week = allocationWeekStatus(data, allocation, date);
  if (!week) return { remaining: allocationStatus(data, allocation).remaining };
  return { remaining: week.remaining, weekLabel: `S${week.index}` };
};

export function planSpend(
  data: AppData,
  input: {
    amount: number;
    category: string;
    date?: string;
    memberId?: string;
    /** Plicul din care a ales omul ultima oară pentru lucrul ăsta; bate categoria. */
    preferAllocationId?: string;
  },
): SpendPlan {
  const amount = Math.max(0, input.amount);
  const memberId = input.memberId || data.settings.members[0]?.id;

  const sources: SourceOption[] = data.settings.paymentSources.map((source) => {
    const balance = Math.round(sourceBalance(data, source.id) * 100) / 100;
    return { source, balance, covers: balance >= amount, owner: ownerName(data, source) };
  });

  /**
   * `matchingAllocationsForExpense` cere sursa deja aleasă, fiindcă slujește
   * formularul, unde omul a ales-o. Aici întrebarea este tocmai „din ce plătesc?”,
   * deci sursa nu există încă: alegem după categorie și membru, iar sursa o
   * propunem după plicul găsit. Un plic al familiei, fără membru, se potrivește
   * oricui.
   *
   * Trecem prin toate plicurile membrului, nu doar prin cele pe categoria exactă.
   * Altfel „50 lei dulciuri” nu găsea nimic și pleca în afara plicurilor, deși
   * alimentele aveau bani — iar omul rămânea cu o listă de surse goale, care nu-l
   * ajută cu nimic. Notăm însă cât de bine se potrivește fiecare, ca propunerea să
   * nu ajungă să scoată o cheltuială de sănătate din plicul de mâncare.
   */
  const related = relatedCategories(input.category);
  const rank = { habit: 0, exact: 1, related: 2, other: 3 } as const;
  const envelopes: EnvelopeOption[] = data.settings.salaryPlan.allocations
    .filter((allocation) => !allocation.memberId || allocation.memberId === memberId)
    .map((allocation) => {
      const subject = allocation.category || allocation.label;
      const match: EnvelopeOption["match"] = allocation.id === input.preferAllocationId
        ? "habit"
        : subject === input.category ? "exact" : related.includes(subject) ? "related" : "other";
      const { remaining, weekLabel } = envelopeRemaining(data, allocation, input.date);
      return { allocation, remaining: Math.round(remaining * 100) / 100, covers: remaining >= amount, weekLabel, match };
    })
    .sort((left, right) => rank[left.match] - rank[right.match]
      || Number(right.covers) - Number(left.covers)
      || right.remaining - left.remaining);

  /**
   * Propunerea: plicul pe categoria exactă, chiar dacă nu acoperă suma (atunci
   * spunem cu cât se depășește). Dacă nu există niciunul, unul înrudit care chiar
   * are banii. Mai departe nu mergem: un plic doar „cu bani în el” se alege cu
   * mâna, nu îl propunem noi.
   */
  const habit = envelopes.find((item) => item.match === "habit" && item.remaining > 0);
  const exact = envelopes.filter((item) => item.match === "exact");
  const envelope = habit
    || exact.find((item) => item.covers)
    || exact[0]
    || envelopes.find((item) => item.match === "related" && item.covers);

  const bySourceId = new Map(sources.map((item) => [item.source.id, item]));
  const source =
    (envelope?.allocation.sourceId ? bySourceId.get(envelope.allocation.sourceId) : undefined)
    || sources.find((item) => item.covers && item.source.memberId === memberId)
    || sources.find((item) => item.covers)
    || [...sources].sort((a, b) => b.balance - a.balance)[0];

  const parts: string[] = [];
  if (source) parts.push(`din ${source.source.name} (${money(source.balance)})`);
  if (envelope) {
    parts.push(`plicul „${envelope.allocation.label}”${envelope.weekLabel ? ` ${envelope.weekLabel}` : ""}: ${money(Math.max(0, envelope.remaining))} rămași`);
  } else if (data.settings.salaryPlan.allocations.length) {
    parts.push("în afara plicurilor — nu consumă niciun buget repartizat");
  }

  // Amândouă pot fi adevărate deodată, iar omul are nevoie de amândouă.
  const warnings: string[] = [];
  if (source && !source.covers) {
    warnings.push(`Soldul din ${source.source.name} nu acoperă suma: ${money(source.balance)} față de ${money(amount)}.`);
  }
  if (envelope && !envelope.covers) {
    warnings.push(`Plicul „${envelope.allocation.label}” mai are ${money(Math.max(0, envelope.remaining))}; ar ieși ${money(Math.round((amount - envelope.remaining) * 100) / 100)} peste.`);
  }

  return { sources, envelopes, source, envelope, summary: parts.join(" · "), warnings };
}

/** Unde intră un venit: sursele, cu soldul lor, cea a membrului întâi. */
export function planIncome(data: AppData, input: { memberId?: string } = {}): SourceOption[] {
  const memberId = input.memberId || data.settings.members[0]?.id;
  return data.settings.paymentSources
    .map((source) => ({
      source,
      balance: Math.round(sourceBalance(data, source.id) * 100) / 100,
      covers: true,
      owner: ownerName(data, source),
    }))
    .sort((a, b) => Number(b.source.memberId === memberId) - Number(a.source.memberId === memberId));
}
