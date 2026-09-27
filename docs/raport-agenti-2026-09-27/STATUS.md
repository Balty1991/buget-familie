# Starea reparațiilor, runda a treia (27.09.2026)

✅ reparat și urcat · ⏳ de făcut · 👤 ține de tine

## P1: înainte de testarea închisă

| # | Ce | Din | Stare |
|---|---|---|---|
| 1 | Corecția de sold nu atinge plicurile, „Ieșit” și închiderea ciclului | User P1-1 | ⏳ |
| 2 | Facturile nu mai cad în plicul Chirie (regresie) + test | User P1-2 | ⏳ |
| 3 | Plata unei facturi din plicul ei nu scade cifra zilei | User P1-3 | ⏳ |
| 4 | Prima zi: cifra scade plățile până la salariu; întrebare „salariul e deja în sold?”; propunere de plicuri pentru soldul de pornire | User P1-5/6, Produs A | ⏳ |
| 5 | Ziua salariului cu două venituri: ciclul nou pornit la aplicare, fără „deja acoperiți” din ciclul vechi | User P1-4 | ⏳ |
| 6 | Corectarea mișcărilor speciale păstrează natura (rată, transfer, corecție, recurentă) | QA3-01 | ⏳ |
| 7 | „Închide anul”: ciclul peste an, mișcări târzii din anul închis | Dev P1-2/3, QA3-02 | ⏳ |
| 8 | Cheltuială pierdută în timpul decriptării | Dev P1-1 | ⏳ |
| 9 | Repartizări pe două telefoane: sumele de plic se adună, nu se aleg | Dev P1-4, P2-1 | ⏳ |
| 10 | Capturile Play refăcute (salarii în zile diferite, plan repartizat, zi obișnuită, rată confirmabilă) + captura „două telefoane” | Produs C, Design D14 | ⏳ |
| 11 | Ghidul AI: „Semnalează răspunsul”; aplicarea propunerii văzute, nu a unui răspuns nou | Produs E, Sec S10 | ⏳ |
| 12 | Contrast sub 2:1 (Navy bară laterală, „Arată toate ratele”, eticheta proiecției) | Design D1–D3, QA3-06 | ⏳ |
| 13 | „Notează” lipsește între 761 și 1199 px (tabletă) | Design D4 | ⏳ |
| 14 | Performanță: perioada planului memorizată; `PlanStudio` cu `useMemo`, foaia „+ Plic” separată | Perf P1-1/2 | ⏳ |
| 15 | Limitele planului gratuit coerente (sau scoase) înainte de Billing | Produs B | ⏳ |

## P2, P3 și ce ține de proprietar

Lista completă e în [RAPORT.md](./RAPORT.md), secțiunile 2 și 3. Se trec aici pe măsură ce se repară.
