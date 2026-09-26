# Starea fiecărei constatări (runda 26.09)

✅ reparat și urcat · ⏳ în lucru · 👤 ține de tine (consolă, cont, decizie)

## Dezvoltator (dev-report.md)
| # | Constatare | Stare |
|---|---|---|
| D1 | Cheltuiala netrimisă când sosește pachetul partenerului | ✅ `b634970` |
| D2 | Conflict de plic rezolvat tăcut / inversat | ✅ `b634970` |
| D3 | Conflictul rezolvat reapare | ✅ `b634970` |
| D4 | Scrieri fără precondiție la intrare/reluare | ✅ `b634970` |
| D5 | Backup vechi importat derulează familia | ✅ `33f7b6e` |
| D6 | Categoria recreată dispare | ✅ `b634970` |
| D7 | Contribuțiile scoase revin | ✅ `b634970` |
| D8 | PBKDF2 la fiecare criptare | ✅ `b634970` |
| D9 | Pachete procesate în paralel | ✅ `b634970` |
| D10 | Redenumirea familiei nu se propagă | ✅ `33f7b6e` |
| D11 | Pietre de mormânt tăiate la 500 | ✅ `33f7b6e` |
| D12 | adoptOutsideExpenses la fiecare randare | ✅ `33f7b6e` |
| D13 | Cifra „pe zi” cu 5 reguli de rotunjire | ⏳ |
| D14 | Contor zilnic AI într-un singur document | ✅ `33f7b6e` |
| D15 | Teste fără verificare de tipuri, CI incomplet, firebase-tools nefixat | parțial ✅ `2bab932`, ⏳ tipurile din teste |
| D16 | Fișiere mari, teste lipsă pentru sync | ⏳ test cap-coadă pentru D1 |

## Securitate (security-report.md)
| # | Constatare | Stare |
|---|---|---|
| S1 | CSP permite tot jsDelivr | ✅ `2bab932` |
| S2 | Cod OCR de pe CDN; destinatari nedeclarați | ✅ declarați `2bab932`; ⏳ căutare Open Food Facts doar la cerere |
| S3 | Plafonul AI se golește ușor | ✅ IPv6 /64, shard-uri `33f7b6e`; ⏳ rezervă pentru cererile verificate; 👤 Play Integrity |
| S4 | Telefonul revocat are încă cheia | ⏳ |
| S5 | Invitația în clar pe web | ⏳; 👤 domeniu propriu |
| S6 | Lanțul de aprovizionare în CI | ✅ firebase-tools fixat; ⏳ pnpm; 👤 Workload Identity |
| S7 | Ghidul AI scrie fără confirmare pe calea veche | ⏳ |
| S8 | Codul de recuperare se poate suprascrie | ✅ `2bab932` |
| S9 | Reguli: 2 MB, câmpuri fără tip | ✅ 950 KB `2bab932`; ⏳ tipuri; 👤 App Check Enforce |
| S10 | Camere vechi cu parolă după 2027 | ⏳ |
| S11 | playRtdn acceptă orice cont Google | ✅ `2bab932`; 👤 variabila la pornirea Billing |
| S12 | verifyPlayPurchase nelegat de cumpărător | ⏳ |
| S13 | FLAG_SECURE sub Android 13, titluri de notificare | ⏳ |
| S14 | Invitație-capcană | ✅ `2bab932` |
| S15 | Server de dezvoltare, dependențe | ✅ `2bab932` |
| S16 | Politică / Data safety | ✅ `2bab932` |

## QA (qa-report.md)
Toate cele 12 (QA-01 … QA-12): ✅ `b2ef974`, `3b6c1e5`, `b0e96cf`, `a323cff`.

## Utilizator (user-report.md)
| # | Constatare | Stare |
|---|---|---|
| 1 | Închiderea ciclului absurdă | ✅ `c4faf1d` |
| 2 | Două salarii în zile diferite | ✅ `256cd3f` |
| 3 | Benzina în Mâncare | ✅ `7bb943d` |
| 4 | 358 lei/zi cu Mâncare 0 | ✅ `7bb943d` |
| 5 | Calendarul fără facturi | ⏳ |
| 6 | Scurtături de salariu tăiate | ✅ `3df805e` |
| 7 | „bani liberi” | ✅ `7bb943d` |
| 8 | Ajustarea de sold ca venit | ⏳ |
| 9 | Tichetele în „nerepartizați” | ✅ `3df805e`; ⏳ tichete pe membru |
| 10 | Două cifre pe zi (banner) | ⏳ |
| 11 | Săptămâni de 9 zile, S1 fantomă | ⏳ |
| 12 | Plăți rare în rezumat | ✅ `3df805e` |
| 13 | Analiză după o lună | ✅ `3df805e` |
| 14 | Căutarea | ✅ `3df805e` |
| 15 | Mementoul de backup | ✅ `3df805e` |
| 16 | Mărunțișuri (texte, limită plan gratuit, bandă de zile) | ⏳ |

## Performanță (perf-report.md)
| # | Constatare | Stare |
|---|---|---|
| P1-1…P1-4 | Gata, revenire pe Astăzi, pornire, jurnal | ✅ `444d385` |
| P2-5…P2-11, P3 | Căutarea din jurnal, Plicuri, randări, sync, CSS, service worker, fonturi | ⏳ (paleta de căutare ✅ `3df805e`) |

## Design (design-report.md)
| # | Constatare | Stare |
|---|---|---|
| D1–D3 | Trei cifre, cascada, chirie | ✅ `7bb943d` |
| D4, D5, D7, D8 | Bloc închis pe Alb, roșu, fonturi, paletă | ✅ `bbab747` |
| D6 | Accent Navy, „OLED” | ✅ `bbab747`, `aec8069` |
| D9 | Fâșia de pe desktop | ✅ `a58e0f2` |
| D10 | Layout de desktop | ⏳ |
| D11–D18 | Plicuri, Obligații, Analiză, Setări, + Plic, „Cum se citește”, Mișcări | ⏳ |
| D19–D23 | Text mic, gri, ghid, first-run, sync | ⏳ |
| D24 | Straturi CSS | ⏳ continuu |

## Produs (product-report.md)
| # | Constatare | Stare |
|---|---|---|
| 1 | Nimic util până la primul salariu | ⏳ |
| 2 | Transferuri numărate drept cheltuieli | ⏳ |
| 3 | Fără măsurare | 👤 decizie (telemetrie) |
| 4 | Pornirea nu compară cu venitul | ⏳ |
| 5 | Cererea de recenzie | ⏳ |
| 6 | 6 intenții, lipsește „Mă alătur familiei” | ⏳ |
| 7 | Materiale de lansare vechi | ⏳ |
| 8 | „Închide anul” | ⏳ |
| — | Preț, probă, ASO | 👤 decizie |
