/**
 * Fraze reale, așa cum le scrie omul, și ce ar trebui să însemne fiecare.
 *
 * Fără lista asta, „înțelege bine?” este o părere. Cu ea este un număr, iar orice
 * schimbare la felul în care citim un mesaj se vede imediat dacă strică altceva.
 * Așteptarea este scrisă ca **înțeles**, nu ca mecanism: dacă o cheltuială ajunge
 * în registru prin parserul de intenții sau prin propunerea euristică e treaba
 * codului, nu a omului care a scris fraza.
 *
 * Când adaugi un caz nou, scrie-l cum l-ai spune cu voce tare, cu diacritice sau
 * fără, cu virgulă zecimală sau fără. Greșelile de tastare sunt bine-venite: exact
 * acolo se rupe înțelegerea.
 */
export type Outcome =
  | "expense" | "income" | "envelope" | "debt" | "recurring" | "goal" | "payday"
  | "transfer" | "answer" | "confirm" | "revise" | "due" | "none";

export type Case = {
  text: string;
  /**
   * Ce ar trebui să însemne. `none` = niciun cititor local nu are voie să revendice
   * fraza. O listă înseamnă că mai multe citiri sunt la fel de corecte pentru om.
   */
  want: Outcome | Outcome[];
  /** De ce e greu cazul, când nu e evident. */
  note?: string;
  /**
   * Caz recunoscut ca nerezolvat: se raportează, dar nu pică testul. Se pune doar
   * când s-a decis pe față că merge mai târziu — nu ca să treacă o schimbare.
   */
  pending?: boolean;
};

export const CORPUS: Case[] = [
  // --- cheltuieli scrise simplu -------------------------------------------
  { text: "am dat 50 lei pe benzină", want: "expense" },
  { text: "am dat 50 lei pe benzina", want: "expense", note: "fără diacritice" },
  { text: "50 lei benzina", want: "expense", note: "fără verb" },
  { text: "am cheltuit 120 pe alimente", want: "expense" },
  { text: "am plătit 35,50 la farmacie", want: "expense", note: "virgulă zecimală" },
  { text: "taxi 28 lei", want: "expense" },
  { text: "am luat pâine și lapte, 17 lei", want: "expense" },
  { text: "cafea 12", want: "expense" },
  { text: "am dat 200 la Kaufland", want: "expense" },
  { text: "factura de curent 340 lei", want: "expense" },
  { text: "am cumpărat țigări de 25 lei", want: "expense" },
  { text: "150 lei haine pentru copil", want: "expense" },
  { text: "am dat 80 de lei pe medicamente", want: "expense" },
  { text: "plin de motorină 400", want: "expense" },
  { text: "abonament telefon 45 lei", want: "expense" },

  // --- cheltuieli cu dată --------------------------------------------------
  { text: "ieri am dat 60 lei pe alimente", want: "expense" },
  { text: "alaltăieri taxi 30", want: "expense" },
  { text: "am uitat să trec 90 lei pe 3 septembrie", want: "expense" },
  { text: "pe 05.09 am plătit 120 lei la dentist", want: "expense" },
  { text: "azi 40 lei dulciuri", want: "expense" },

  // --- venituri ------------------------------------------------------------
  { text: "am primit salariul, 5000 lei", want: "income" },
  { text: "Adaugă un venit de 5000 lei salariu", want: "income" },
  { text: "mi-a intrat salariul 4200", want: "income" },
  { text: "salariul soției 3800 lei", want: "income" },
  { text: "am primit 500 lei de la părinți", want: "income" },
  { text: "venit din chirie 1200", want: "income" },
  { text: "bonus 700 lei", want: "income", note: "cuvânt de venit neacoperit" },

  // --- plicuri -------------------------------------------------------------
  { text: "fă-mi plic Alimente 2400 cu limită săptămânală 600", want: "envelope" },
  { text: "vreau un plic de transport de 500 lei", want: "envelope" },
  { text: "pune 800 lei pe casă și facturi", want: "envelope" },
  { text: "repartizează 1500 pentru alimente", want: "envelope" },
  { text: "plic economii 1000 pe lună", want: "envelope" },

  // --- datorii -------------------------------------------------------------
  { text: "datorie card 1800, rata 150", want: "debt" },
  { text: "am un credit la bancă cu sold restant 12000", want: "debt" },
  { text: "împrumut de la un prieten 2000 lei", want: "debt" },
  { text: "rata lunară la mașină e 900 lei", want: ["debt", "recurring"], note: "o rată lunară e și obligație, și detaliu de datorie — fără sold rămas, scadența e citirea onestă" },
  { text: "am achitat rata de 350 lei", want: "expense", note: "plata unei rate e cheltuială, nu datorie nouă" },

  // --- scadențe și obiective ----------------------------------------------
  { text: "chiria e 1500 lei pe data de 5", want: "recurring" },
  { text: "abonament Netflix 45 lei pe 12 ale lunii", want: "recurring" },
  { text: "vreau să strâng 10000 lei pentru concediu", want: "goal" },
  { text: "obiectiv fond de urgență 6000", want: "goal" },
  { text: "următorul salariu pe 07.10.2026", want: "payday" },
  { text: "salariul vine pe 15 octombrie", want: "payday" },

  // --- transferuri între plicuri ------------------------------------------
  { text: "mută 100 lei din alimente în transport", want: "transfer" },
  { text: "transferă 50 din transport în alimente", want: "transfer" },
  { text: "treci 200 de lei din economii în casă și facturi", want: "transfer" },

  // --- întrebări pentru analist -------------------------------------------
  { text: "cât pot cheltui pe zi?", want: "answer" },
  { text: "unde se duc banii?", want: "answer" },
  { text: "cât am cheltuit luna asta?", want: "answer" },
  { text: "cât am cheltuit la Kaufland luna trecută?", want: "answer" },
  { text: "care e cea mai mare cheltuială a lunii?", want: "answer" },
  { text: "ajung cu banii până la salariu?", want: "answer" },
  { text: "cât mai am în plicul de alimente?", want: "answer" },
  { text: "ce abonamente am?", want: "answer" },
  { text: "cât mai am de plătit la datorii?", want: "answer" },
  { text: "cât am economisit anul ăsta?", want: "answer" },
  { text: "compară luna asta cu luna trecută", want: "answer" },
  { text: "când vine salariul?", want: "answer" },
  { text: "cât am cheltuit pe alimente săptămâna asta?", want: "answer" },
  { text: "ce mai am disponibil?", want: "answer" },
  { text: "cum stau cu banii?", want: "answer" },

  // --- capcane: întrebări care arată ca niște cheltuieli --------------------
  { text: "îmi permit 500 de lei pe alimente?", want: "answer", note: "are formă de cheltuială, dar e întrebare" },
  { text: "pot să dau 300 lei pe haine?", want: "answer" },
  { text: "mai am 200 de lei pentru taxi?", want: "answer" },
  { text: "cât ar rămâne dacă dau 400 pe mobilă?", want: "answer" },

  // --- confirmări ----------------------------------------------------------
  { text: "da", want: "confirm" },
  { text: "ok", want: "confirm" },
  { text: "confirmă", want: "confirm" },
  { text: "adaugă", want: "confirm" },
  { text: "salvează", want: "confirm" },

  // --- nimic de înregistrat -------------------------------------------------
  { text: "mulțumesc", want: "none" },
  { text: "bună ziua", want: "none" },
  { text: "cum funcționează plicurile?", want: "none", note: "întrebare despre aplicație, nu despre bani" },
  { text: "nu am datorii", want: "none" },
  { text: "ce părere ai?", want: "none" },
];

/** Fraze adăugate după ce am probat ce chiar spun oamenii, nu doar ce e ușor de citit. */
export const CORPUS_EXTRA: Case[] = [
  // --- corectarea unei greșeli ---------------------------------------------
  { text: "șterge ultima cheltuială", want: "revise" },
  { text: "sterge ultima miscare", want: "revise", note: "fără diacritice" },
  { text: "anulează ce am adăugat", want: "revise" },
  { text: "am greșit, era 60 nu 50", want: "revise" },
  { text: "schimbă suma în 75", want: "revise" },

  // --- cine a cheltuit ------------------------------------------------------
  { text: "cât a cheltuit soția luna asta?", want: "answer" },
  { text: "pe ce a dat soția banii?", want: "answer" },

  // --- cereri de a vedea, nu de a înregistra --------------------------------
  { text: "arată-mi cheltuielile de peste 100 de lei", want: "answer", note: "are sumă și formă de cheltuială, dar cere o listă" },
  { text: "ce am cumpărat de la Kaufland?", want: "answer" },
  { text: "de câte ori am dat pe taxi luna asta?", want: "answer" },

  // --- o scadență plătită, fără să repeți suma ------------------------------
  { text: "am plătit chiria", want: "due", note: "suma o știe aplicația din Plan" },
];
