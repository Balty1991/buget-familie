/**
 * Datele inventate pentru capturile din magazin: familia Andrei și Maria, joi 24 septembrie 2026.
 * Două salarii (Andrei pe 10, Maria pe 25), plicuri, o rată, abonamente și cheltuieli pe categorii.
 * Se scriu doar în localStorage-ul browserului de test, nu în Firebase.
 *
 * makeSeed întoarce text: capture.mjs îl evaluează în pagină cu `fd` = modulul finance-data.
 * `pendingIncome`: salariul Mariei intră azi, încă nerepartizat (cadrul „Se împarte singur”).
 */
export function makeSeed(lang, opts = {}) {
  const en = lang === "en";
  const config = {
    family: en ? "The Popescus" : "Familia Popescu",
    me: "Andrei",
    partner: "Maria",
    pendingIncome: Boolean(opts.pendingIncome),
    yearHistory: Boolean(opts.yearHistory),
    shopping: en ? [["Milk", 1], ["Eggs", 1], ["Bread", 0], ["Apples", 0], ["Detergent", 0], ["Coffee", 0]] : [["Lapte", 1], ["Ouă", 1], ["Pâine", 0], ["Mere", 0], ["Detergent", 0], ["Cafea", 0]],
  };
  return `(() => {
    const cfg = ${JSON.stringify(config)};
    const data = fd.createEmptyAppData();
    const stamp = "2026-09-10T08:00:00.000Z";
    const me = { id: "m-andrei", name: cfg.me, color: "#256B5B" };
    const partner = { id: "m-maria", name: cfg.partner, color: "#2F6FD6" };
    data.settings.familyName = cfg.family;
    data.settings.memberName = cfg.me;
    data.settings.members = [{ ...(data.settings.members[0] || {}), ...me }, { ...(data.settings.members[0] || {}), ...partner, kind: undefined }];
    data.settings.selfMemberId = me.id;
    const base = data.settings.paymentSources[0] || {};
    data.settings.paymentSources = [
      { ...base, id: "src-andrei", name: "Card Andrei", kind: "card", memberId: me.id, openingBalance: 1200 },
      { ...base, id: "src-maria", name: "Card Maria", kind: "card", memberId: partner.id, openingBalance: 900 },
      { ...base, id: "src-cash", name: "Cash", kind: "cash", memberId: me.id, openingBalance: 250 },
    ];
    const plan = data.settings.salaryPlan;
    plan.periodStart = "2026-09-10";
    plan.nextPayday = "2026-10-10";
    plan.paydayFlexDays = 3;
    plan.sourceIds = ["src-andrei", "src-maria"];
    plan.incomes = [
      { id: "inc-andrei", memberId: me.id, label: "Salariul lui Andrei", amount: 4700, day: 10, updatedAt: stamp },
      { id: "inc-maria", memberId: partner.id, label: "Salariul Mariei", amount: 4300, day: 25, updatedAt: stamp },
    ];
    plan.needs = [
      { id: "n-chirie", label: "Chirie", category: "Casă & facturi", cadence: "monthly", min: 1800, max: 1800, priority: "fixed", dueDay: 5, allocationId: "a-chirie", updatedAt: stamp },
      { id: "n-rata", label: "Rată bancă", category: "Credite", cadence: "monthly", min: 1100, max: 1100, priority: "fixed", dueDay: 15, allocationId: "a-rata", updatedAt: stamp },
      { id: "n-gradinita", label: "Grădiniță", category: "Consumabile copil", cadence: "monthly", min: 700, max: 700, priority: "fixed", dueDay: 1, allocationId: "a-gradinita", updatedAt: stamp },
      { id: "n-utilitati", label: "Utilități", category: "Casă & facturi", cadence: "monthly", min: 380, max: 480, priority: "fixed", dueDay: 20, allocationId: "a-utilitati", updatedAt: stamp },
      { id: "n-mancare", label: "Mâncare", category: "Alimente", cadence: "weekly", min: 560, max: 560, priority: "flex", allocationId: "a-mancare", updatedAt: stamp },
      { id: "n-transport", label: "Transport", category: "Transport", cadence: "monthly", min: 600, max: 700, priority: "flex", allocationId: "a-transport", updatedAt: stamp },
      { id: "n-neprevazute", label: "Neprevăzute", category: "Sănătate", cadence: "monthly", min: 300, max: 300, priority: "buffer", allocationId: "a-sanatate", updatedAt: stamp },
    ];
    plan.allocations = [
      { id: "a-chirie", label: "Chirie", category: "Casă & facturi", amount: 1800, weeklyPace: false, alertThreshold: 80 },
      { id: "a-rata", label: "Rată bancă", category: "Credite", amount: 1100, weeklyPace: false, alertThreshold: 80 },
      { id: "a-gradinita", label: "Grădiniță", category: "Consumabile copil", amount: 700, weeklyPace: false, alertThreshold: 80 },
      { id: "a-utilitati", label: "Utilități", category: "Casă & facturi", amount: 480, weeklyPace: false, alertThreshold: 80 },
      { id: "a-mancare", label: "Mâncare", category: "Alimente", amount: 2400, weeklyPace: true, alertThreshold: 80 },
      { id: "a-transport", label: "Transport", category: "Transport", amount: 700, weeklyPace: true, alertThreshold: 80 },
      { id: "a-timp", label: "Timp liber", category: "Timp liber", amount: 600, weeklyPace: true, alertThreshold: 80 },
      { id: "a-sanatate", label: "Neprevăzute", category: "Sănătate", amount: 300, weeklyPace: false, alertThreshold: 80 },
    ];
    let n = 0;
    const tx = (date, title, amount, category, who = me, sourceId = "src-andrei", kind = "expense", allocationId) => ({
      id: "t" + (++n), date, title, amount, kind, category, memberId: who.id, person: who.name, sourceId,
      source: sourceId === "src-maria" ? "Card Maria" : sourceId === "src-cash" ? "Cash" : "Card Andrei",
      ...(allocationId ? { allocationId } : {}), createdAt: date + "T09:00:00.000Z", updatedAt: date + "T09:00:00.000Z",
    });
    data.transactions = [
      tx("2026-09-10", "Salariu Andrei", 4700, "Salariu", me, "src-andrei", "income"),
      tx("2026-08-25", "Salariu Maria", 4300, "Salariu", partner, "src-maria", "income"),
      tx("2026-09-11", "Chirie septembrie", 1800, "Casă & facturi", me, "src-andrei", "expense", "a-chirie"),
      tx("2026-09-12", "Grădiniță", 700, "Consumabile copil", partner, "src-maria", "expense", "a-gradinita"),
      tx("2026-09-15", "Rată bancă", 1100, "Credite", me, "src-andrei", "expense", "a-rata"),
      tx("2026-09-20", "Enel", 212.3, "Casă & facturi", me, "src-andrei", "expense", "a-utilitati"),
      tx("2026-09-20", "Apa Nova", 86.5, "Casă & facturi", partner, "src-maria", "expense", "a-utilitati"),
      tx("2026-09-11", "Kaufland", 318.4, "Alimente", partner, "src-maria", "expense", "a-mancare"),
      tx("2026-09-14", "Lidl", 241.9, "Alimente", me, "src-andrei", "expense", "a-mancare"),
      tx("2026-09-17", "Mega Image", 96.2, "Alimente", partner, "src-maria", "expense", "a-mancare"),
      tx("2026-09-19", "Piață", 74, "Alimente", me, "src-cash", "expense", "a-mancare"),
      tx("2026-09-21", "Lidl", 124.3, "Alimente", me, "src-andrei", "expense", "a-mancare"),
      tx("2026-09-22", "Profi", 38.6, "Alimente", partner, "src-maria", "expense", "a-mancare"),
      tx("2026-09-13", "Benzină OMV", 250, "Transport", me, "src-andrei", "expense", "a-transport"),
      tx("2026-09-18", "Bolt", 32, "Transport", partner, "src-maria", "expense", "a-transport"),
      tx("2026-09-22", "Abonament STB", 80, "Transport", partner, "src-maria", "expense", "a-transport"),
      tx("2026-09-16", "Farmacia Catena", 64, "Sănătate", partner, "src-maria", "expense", "a-sanatate"),
      tx("2026-09-20", "Cinema", 96, "Timp liber", me, "src-andrei", "expense", "a-timp"),
      tx("2026-09-23", "Pizza", 78, "Timp liber", partner, "src-maria", "expense", "a-timp"),
      tx("2026-09-12", "Netflix", 59.99, "Abonamente", me, "src-andrei"),
      tx("2026-09-24", "Cafea", 14, "Alimente", me, "src-cash", "expense", "a-mancare"),
      ...(cfg.pendingIncome ? [tx("2026-09-24", "Salariul Mariei", 4300, "Salariu", partner, "src-maria", "income")] : []),
    ];
    data.debts = [{ id: "d-credit", name: "Credit nevoi personale", remaining: 18500, monthly: 1100, annualRate: 11.5, kind: "credit", due: "", tone: "coral", dueDate: "2026-10-15" }];
    data.savings = [{ id: "s-vacanta", name: "Vacanță la mare", current: 1800, target: 5000, due: "", tone: "forest", dueDate: "2027-06-30" }];
    data.recurring = [
      { id: "r-net", name: "Internet Digi", amount: 60, category: "Casă & facturi", sourceId: "src-andrei", memberId: me.id, dueDay: 28, active: true },
      { id: "r-netflix", name: "Netflix", amount: 59.99, category: "Abonamente", sourceId: "src-andrei", memberId: me.id, dueDay: 12, active: true },
      { id: "r-tel", name: "Abonament telefon", amount: 45, category: "Abonamente", sourceId: "src-maria", memberId: partner.id, dueDay: 2, active: true },
    ];
    // Lista de cumpărături: câteva de luat, două deja în coș (unul adăugat de Maria).
    data.settings.shoppingList = cfg.shopping.map(([text, done], index) => ({ id: "shop-" + index, text, ...(done ? { done: true } : {}), by: index === 2 ? partner.id : me.id, updatedAt: new Date(Date.UTC(2026, 8, 24, 9, 30 - index)).toISOString() }));
    // „Anul vostru”: ianuarie–august, ca retrospectiva să aibă un an în spate (doar pentru cadrul ei).
    if (cfg.yearHistory) {
      let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const shops = [["Lidl", "Alimente", 60, 260], ["Kaufland", "Alimente", 80, 340], ["Mega Image", "Alimente", 20, 120], ["Benzină OMV", "Transport", 150, 300], ["Farmacia Catena", "Sănătate", 20, 140], ["Cinema", "Timp liber", 50, 120]];
      for (let m = 1; m <= 8; m++) {
        const mm = String(m).padStart(2, "0");
        data.transactions.push(tx("2026-" + mm + "-10", "Salariul lui Andrei", 4700, "Salariu", me, "src-andrei", "income"), tx("2026-" + mm + "-25", "Salariul Mariei", 4300, "Salariu", partner, "src-maria", "income"), tx("2026-" + mm + "-12", "Chirie", 1800, "Casă & facturi", me, "src-andrei"));
        for (let d = 1; d <= 28; d++) {
          if (rnd() < 0.35) continue;
          const [title, category, lo, hi] = shops[Math.floor(rnd() * shops.length) % shops.length];
          data.transactions.push(tx("2026-" + mm + "-" + String(d).padStart(2, "0"), title, Math.round(lo + rnd() * (hi - lo)), category, rnd() < 0.5 ? me : partner, "src-andrei"));
        }
      }
    }
    return data;
  })()`;
}
