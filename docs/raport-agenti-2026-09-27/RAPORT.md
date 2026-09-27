# Buget Familie: raport unificat, runda a treia (7 agenți)

**Data:** 27.09.2026 · **Versiune testată:** 1.1.96 (commit `5b63e2a`) · Rapoartele pe roluri sunt alături, în acest folder. Starea reparațiilor: [STATUS.md](./STATUS.md).

| Rol | 26.09 | 27.09 | Raport |
|---|---|---|---|
| Utilizator obișnuit (2 salarii, tichete, rată, o lună simulată) | 5,5 | **6** | [user-report.md](./user-report.md) |
| Tester QA (limite, 6 lățimi × 3 teme, 3.000 de mișcări, backup) | 7 | **8** | [qa-report.md](./qa-report.md) |
| Dezvoltator senior (bani, sync, persistență, Android, CI) | 7 | **7,5** | [dev-report.md](./dev-report.md) |
| Securitate (reguli pe emulator, criptare, Functions, CI) | 7,5 | **8** | [security-report.md](./security-report.md) |
| Performanță (build de producție, CPU 4–6×, 0/1.000/5.000 de mișcări) | 6 | **7** | [perf-report.md](./perf-report.md) |
| Designer UI/UX (18 ecrane × 3 teme × 5 lățimi) | B− (7) | **B (7,5)** | [design-report.md](./design-report.md) |
| Strateg de produs (Play RO, concurență, preț, diaspora) | 7,5 | **8** | [product-report.md](./product-report.md) |

**Media: 7,4/10** (runda trecută 6,9). Toate notele au urcat. Nimic P0 nicăieri. Testele automate trec: 1.132 de teste unitare, fluxurile e2e, testul de interfață (13 ecrane × 3 teme × 2 lățimi).

## 1. Pe scurt

Aproape tot ce s-a cerut pe 26.09 ține la reverificare. Aplicația e mult mai rapidă cu registru mare (TBT la pornire −44%, „Gata” −46%), securitatea n-are nimic P0/P1, designul e consecvent între ecrane.

Problemele noi sunt în trei locuri, iar mai multe au fost găsite independent de doi–trei agenți:

1. **Cifrele citite zilnic** (utilizator, produs, dev): corecția de sold ajunge în plicuri, facturile Engie/Enel cad în plicul Chirie (regresie), plata unei facturi din plicul ei aduce „Poți folosi azi” la 0, prima zi nu scade chiria și rata, ziua salariului cu două venituri pune toată mâncarea într-o săptămână.
2. **„Închide anul”** (dev + QA, confirmat de amândoi): taie ciclul decembrie–ianuarie și umflă plicul; o mișcare din anul închis care vine mai târziu dispare fără să intre în sold.
3. **Corectarea mișcărilor speciale și sync-ul pe două telefoane** (QA + dev): o rată corectată nu mai scade din datorie, un transfer corectat devine venit; o cheltuială notată în timpul decriptării se poate pierde; două salarii repartizate în același plic pe două telefoane dau un conflict fără variantă corectă.

Pentru Play: **capturile 01, 03, 04 și 07 se contrazic** (ambele salarii pe 18, 53% nerepartizat sub „Fiecare leu are un loc”, 216 lei „pentru 1 zi” duminica), ghidul AI n-are buton „Semnalează răspunsul”, descrierea lungă are puține cuvinte-cheie.

## 2. De reparat, pe priorități

### P1: înainte de testarea închisă

| # | Ce | Surse | Unde |
|---|---|---|---|
| 1 | Corecția de sold nu atinge plicurile, „Ieșit” și închiderea ciclului | User P1-1 | `finance-data.ts:1472`, `TodayView.tsx:224` |
| 2 | Facturile nu mai cad în plicul Chirie (regresie) + test | User P1-2 | `QuickEntryPanel.tsx:113-119, 227` |
| 3 | Plata unei facturi din plicul ei nu scade cifra zilei | User P1-3 | `household-insights.ts:859-874` |
| 4 | Prima zi: cifra scade plățile până la salariu; întrebare „salariul e deja în sold?”; propunere de plicuri pentru soldul de pornire | User P1-5/6, Produs A | pornirea, `household-insights.ts` |
| 5 | Ziua salariului cu două venituri: ciclul nou pornit la aplicare, fără „deja acoperiți” din ciclul vechi | User P1-4 | propunerea de repartizare |
| 6 | Corectarea mișcărilor speciale păstrează natura (rată, transfer, corecție, recurentă) | QA3-01 | `TransactionForm.tsx:136` |
| 7 | „Închide anul”: ciclul peste an, mișcări târzii din anul închis | Dev P1-2/3, QA3-02 | `year-close.ts`, `finance-data.ts:656`, `family-crypto.ts:609` |
| 8 | Cheltuială pierdută în timpul decriptării | Dev P1-1 | `useFamilySync.ts:311, 325, 528-537` |
| 9 | Repartizări pe două telefoane: sumele de plic se adună, nu se aleg | Dev P1-4, P2-1 | merge |
| 10 | Capturile Play refăcute (salarii în zile diferite, plan repartizat, zi obișnuită, rată confirmabilă) + captura „două telefoane” | Produs C, Design D14 | `scripts/store-screenshots/seed.mjs` |
| 11 | Ghidul AI: „Semnalează răspunsul”; aplicarea propunerii văzute, nu a unui răspuns nou | Produs E, Sec S10 | Ghid, `functions/src/index.ts:97` |
| 12 | Contrast sub 2:1 (Navy bară laterală, „Arată toate ratele”, eticheta proiecției) | Design D1–D3, QA3-06 | `contrast-fix.css:376`, `visibility-safety.css:268` |
| 13 | „Notează” lipsește între 761 și 1199 px (tabletă) | Design D4 | antet/dock |
| 14 | Performanță: perioada planului memorizată; `PlanStudio` cu `useMemo`, foaia „+ Plic” separată | Perf P1-1/2 | `finance-data.ts:1684-1712`, `PlanStudio.tsx` |
| 15 | Limitele planului gratuit coerente (sau scoase) înainte de Billing | Produs B | `NeedsQuickStart.tsx:88`, `PlanStudio.tsx:351` |

### P2: înainte de producție

- **Securitate:** S1 cache-ul și cheia pe originea comună (reparația de fond: domeniu propriu; până atunci verificarea integrității în `sw.js`), S2 „Mută familia” ireversibil (`sealedAt`), S3 CI: `pnpm exec firebase`, publicarea separată de teste.
- **Bani și date:** ziua salariului alunecă după februarie (QA3-04), două plăți la aceeași datorie, reguli 50/50 la sume cu bani, „nerepartizați” cu tichete, soldul EUR la închiderea anului, hidratarea peste plafonul localStorage (Dev P2), arhiva anului reimportabilă (QA3-03).
- **Android:** reamintiri duble (WorkManager + Capacitor), reamintiri învechite neanulate.
- **Design:** padding „De rezolvat” și card gol pe tabletă, chevroane la acordeoane, „+ Plic” ca dialog (și accesibil: `role="dialog"`, focus – QA3-05), Analiză: filtre și „Ritm” pe toată lățimea.
- **Performanță:** sortarea registrului o singură dată (paletă, jurnal), unirea sync în worker, baza de sync în IndexedDB.
- **Produs:** descrierea Play rescrisă pentru ASO; decizie despre măsurare (opt-in sau formular în zilele 3 și 14).

### P3

Căutare cu virgulă în sumă, rotunjirea sumei plicului, `aria-label` pe span, „1 zile”, „Salariul Mariei (Maria)”, invitația permanentă, regulile de urgență, lista de licențe open-source în aplicație, documentele vechi (`PLAY_LISTING.md`, `README.md`, `PLAY_STATUS.md`), fontul Fraunces latin, service worker-ul care descarcă `i18n-en`.

## 3. Ține de proprietar

Domeniu propriu (S1), Play Integrity + App Check Enforce, Workload Identity, alertă de buget și restricția cheii API, cheia Gemini pe nivel plătit, limita de conturi anonime, TTL, variabila Billing, decizia despre telemetrie și preț, 6 cupluri printre cei 12 testeri. Dacă mai ai alte repo-uri cu GitHub Pages pornit pe același cont, oprește-le sau mută aplicația pe domeniu (S1).
