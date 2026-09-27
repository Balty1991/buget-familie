# Starea reparațiilor, runda a treia (27.09.2026)

✅ reparat și urcat · ⏳ de făcut · 👤 ține de tine

## P1: înainte de testarea închisă

| # | Ce | Din | Stare |
|---|---|---|---|
| 1 | Corecția de sold nu atinge plicurile, „Ieșit” și închiderea ciclului | User P1-1 | ✅ `1ff308a` |
| 2 | Facturile nu mai cad în plicul Chirie (regresie) + test | User P1-2 | ✅ `1ff308a` |
| 3 | Plata unei facturi din plicul ei nu scade cifra zilei | User P1-3 | ✅ `1ff308a` |
| 4 | Prima zi: cifra scade plățile până la salariu; întrebare „salariul e deja în sold?”; propunere de plicuri pentru soldul de pornire | User P1-5/6, Produs A | ✅ `708703c` |
| 5 | Ziua salariului cu două venituri: ciclul nou pornit la aplicare, fără „deja acoperiți” din ciclul vechi | User P1-4 | ✅ `708703c` |
| 6 | Corectarea mișcărilor speciale păstrează natura (rată, transfer, corecție, recurentă) | QA3-01 | ✅ `7d9e1ee` |
| 7 | „Închide anul”: ciclul peste an, mișcări târzii din anul închis | Dev P1-2/3, QA3-02 | ✅ `7d9e1ee` |
| 8 | Cheltuială pierdută în timpul decriptării | Dev P1-1 | ✅ `7d9e1ee` |
| 9 | Repartizări pe două telefoane: sumele de plic se adună, nu se aleg | Dev P1-4, P2-1 | ✅ `7d9e1ee` |
| 10 | Capturile Play refăcute (salarii în zile diferite, plan repartizat, zi obișnuită, rată confirmabilă) + captura „două telefoane” | Produs C, Design D14 | ✅ `5b4b624` |
| 11 | Ghidul AI: „Semnalează răspunsul”; aplicarea propunerii văzute, nu a unui răspuns nou | Produs E, Sec S10 | ✅ `8a8624f` |
| 12 | Contrast sub 2:1 (Navy bară laterală, „Arată toate ratele”, eticheta proiecției) | Design D1–D3, QA3-06 | ✅ `1924f29` |
| 13 | „Notează” lipsește între 761 și 1199 px (tabletă) | Design D4 | ✅ `1924f29` |
| 14 | Performanță: perioada planului memorizată; `PlanStudio` cu `useMemo`, foaia „+ Plic” separată | Perf P1-1/2 | ✅ `9d92ec4` (parțial: perioada și istoricul memorizate; foaia „+ Plic” separată rămâne) |
| 15 | Limitele planului gratuit coerente (sau scoase) înainte de Billing | Produs B | ✅ `e88ff39` |

## P2 și P3 reparate

- ✅ Dev P2: plăți concurente la datorie, 50/50 la ban, tichete în „nerepartizați”, soldul EUR la închiderea anului, hidratarea după golirea localStorage, reamintiri Android pe un canal și anulate când nu mai sunt adevărate (`7d9e1ee`); reluarea sync-ului după eșec (`535bd05`); `functions/lib` scos din git (`8a8624f`).
- ✅ QA: ziua salariului nu alunecă (QA3-04), arhiva anului se deschide din Setări (QA3-03), căutare fără diacritice și cu „86,40” (QA3-08), suma plicului la ban (QA3-09), `aria` în Analiză (QA3-07) (`535bd05`).
- ✅ Utilizator P2/P3: cifra mare „Poți folosi azi” cu deficitul dedesubt, bilanțul săptămânii după plicuri, magazine noi pe categorii, avertizare la mișcare dublă, numele tău la pornire, tichete fără nume repetat, indiciul „Notează” se retrage, sync fără internet spune pe loc, data salariului o singură dată în Plicuri (`708703c`, `4b890c0`, `5b4b624`).
- ✅ Design: D1–D6, D8, D9, D13, D14 (`1924f29`, `5b4b624`).
- ✅ Performanță: perioada planului, istoricul plicurilor, căutarea, scroll-ul la schimbarea ecranului, formatările (`9d92ec4`).
- ✅ Securitate: S1 amprente în service worker (`f04c602`), S3 CI (`8a8624f`), S10 ghidul AI (`8a8624f`).
- ✅ Produs: fișa Play (ASO) (`7ede845`), planul gratuit coerent (`e88ff39`), capturile (`5b4b624`), „Semnalează răspunsul” (`8a8624f`).

## Rămase

- D7 foaia „+ Plic” ca dialog pe ecranele late, D10 „Mai mult” fără meniul vechi, D11 filtrele din Analiză, D12 tipografia pe teme (M).
- S2 „Mută familia” ireversibil (`sealedAt` în reguli), S4/S6 plafoane AI și stocare pe utilizator.
- Perf: unirea sync în worker, baza de sync în IndexedDB.

## P2, P3 și ce ține de proprietar

Lista completă e în [RAPORT.md](./RAPORT.md), secțiunile 2 și 3. Se trec aici pe măsură ce se repară.
