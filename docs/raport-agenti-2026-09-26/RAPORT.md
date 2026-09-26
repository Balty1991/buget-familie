# Buget Familie: raport unificat, runda a doua (7 agenți)

**Data:** 26.09.2026 · **Versiune testată:** 1.1.96 (commit `1935b14`) · Rapoartele pe roluri sunt alături, în acest folder.

| Rol | Notă | Raport |
|---|---|---|
| Utilizator obișnuit (2 salarii, tichete, rată, grădiniță, o lună simulată) | 5,5/10 | [user-report.md](./user-report.md) |
| Tester QA (cazuri-limită, 5 lățimi, 3 teme, axe, 3.000 de mișcări) | 7/10 | [qa-report.md](./qa-report.md) |
| Dezvoltator senior (bani, sync, persistență, Android, CI) | 7/10 | [dev-report.md](./dev-report.md) |
| Securitate și confidențialitate (reguli pe emulator, CSP, Functions, politică) | 7,5/10 | [security-report.md](./security-report.md) |
| Performanță (build de producție, CPU 4–6×, 0/1.000/5.000 de mișcări) | 6/10 | [perf-report.md](./perf-report.md) |
| Designer UI/UX (16 ecrane × 3 teme × mobil/desktop, contrast măsurat) | B− (7/10) | [design-report.md](./design-report.md) |
| Strateg de produs (concurență RO, funcții, monetizare, ASO) | 7,5/10 | [product-report.md](./product-report.md) |

## 1. Pe scurt

Față de runda din 25.09, toate notele au urcat: designul de la C+ la B−, pornirea cu 5.000 de mișcări e de două ori mai rapidă, iar securitatea nu mai are nimic P0/P1. Aproape tot din primul audit e reparat corect.

Problemele noi au stat în trei locuri:

1. **Sincronizarea dintre telefoane** putea pierde date fără semn: o cheltuială notată chiar când sosea pachetul partenerului nu mai pleca, conflictele se „rezolvau” singure în favoarea unui telefon, iar un backup vechi importat pe un telefon conectat dădea înapoi toată familia.
2. **Cifre care nu se potriveau**: aceeași „cât pot azi” cu trei valori, chiria plătită și întârziată în același timp, închiderea ciclului care propunea Lumină 250 → 2.830 lei, ciclul cu două salarii care lăsa mâncarea la 0.
3. **Granițele dintre module**: bonurile își pierdeau pozele la reîncărcare, sumele cu 3 zecimale creșteau de 1.000 de ori la corectură, butonul Înapoi închidea aplicația, exporturile nu mergeau în APK.

## 2. Ce am reparat (toate pe `main`, cu teste)

| Commit | Ce | Din raport |
|---|---|---|
| `b634970` | Sync: schimbarea locală nu mai rămâne netrimisă; reîncercare singură după eșec; coadă serială; precondiție și la intrare/reluare; conflictele arată sumele din perspectiva telefonului, blochează unirea automată și se închid pe toate telefoanele; PBKDF2 o dată pe sare; categoriile recreate și contribuțiile șterse nu mai revin | Dev D1–D4, D6–D9 |
| `33f7b6e` | Backup pe telefon conectat doar adaugă; redenumirea familiei se sincronizează; pietre de mormânt la 2.000; ghid AI: plafon pe 10 documente, IP înaintea telefonului, IPv6 pe /64 | Dev D5, D10–D12, D14; Sec S3 |
| `2bab932` | CSP pe căi exacte; reguli: 950 KB și recuperare doar `create`; `playRtdn` cere contul configurat; confirmare completă la invitație; politică și Data safety cu jsDelivr, Open Food Facts și cheia de recuperare; server dev pe 127.0.0.1; `firebase-tools` fixat; lint și toate testele în build-urile Android | Sec S1, S2 (declarare), S6, S8, S9, S11, S14–S16; Dev D15 |
| `c4faf1d` | Închiderea ciclului: pe plic, pe lungimea ciclului nou, fără facturi, nebifat | Utilizator #1 (P0) |
| `b2ef974` | Pozele bonurilor păstrate; sume rotunjite la bani și plafonate; recurentele șterse nu revin; soldul datoriei urmează corectura plății | QA-01 (P0), QA-02, QA-03, QA-04, QA-08 |
| `3b6c1e5` | Înapoi pe Android; exporturi CSV/PDF prin partajare; CSV fără formule; date invalide oprite | QA-05, QA-06, QA-07, QA-11 |
| `b0e96cf` | Două file unite; pornire cu date stricate; plata ratei după confirmare | QA-09, QA-10, QA-12 |
| `7bb943d` | O singură cifră pe zi (erou, notă, plic); cascada cu scăderi; plicul urmează categoria în Notează + benzinării; scadența plătită de mână; cifra zilei din plicurile curente | Design D1–D3; Utilizator #3, #4, #7, #10 |
| `256cd3f` | Două salarii: mâncare până la al doilea salariu, „Așteaptă venitul următor”, „Salariul a intrat” | Utilizator #2 |

## 3. Ce urmează, în ordine

**Viteză (perf P1):** o singură socoteală a zilei pe randare, salvarea scoasă din cadrul clicului, pornirea fără normalizare dublă, jurnalul pe bucăți.

**Aspect (design P1):** blocul întunecat din tema Alb (D4), roșul „întârziat” pe temele închise (D5), sumele într-un singur font (D7), paleta de categorii (D8), fâșia de 24 px pe desktop (D9).

**Cifre și texte mai mici (utilizator P2/P3):** calendarul fără facturi (#5), scurtăturile de venit tăiate (#6), ajustarea de sold numărată ca venit (#8), tichetele în „Nerepartizați” (#9), analiza după o singură lună (#13), căutarea fără sumă și dată (#14), mementoul de backup (#15).

**Funcții noi propuse (produs):** ciclul „până la salariu” pornit din banii de acum (cifra zilei din prima zi), tipul „transfer” între conturi proprii și retrageri de numerar, recenzia din aplicație după un moment reușit, „Mă alătur familiei” la pornire.

**Rămân la tine (nu se fac din cod):** App Check cu Play Integrity pe Android și Enforce (S3, S9), domeniu propriu (S5), Workload Identity în loc de cheia JSON (S6), variabila `PLAY_RTDN_SERVICE_ACCOUNT` când pornește Billing (S11), decizia de preț și probă (produs §6).
