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
| D13 | Cifra „pe zi” cu 5 reguli de rotunjire | ✅ `c29cfac` |
| D14 | Contor zilnic AI într-un singur document | ✅ `33f7b6e` |
| D15 | Teste fără verificare de tipuri, CI incomplet, firebase-tools nefixat | ✅ `2bab932`, `3e874ab` |
| D16 | Fișiere mari, teste lipsă pentru sync | ✅ test cap-coadă pentru D1; ⏳ extragerea `sync-engine.ts` |

## Securitate (security-report.md)
| # | Constatare | Stare |
|---|---|---|
| S1 | CSP permite tot jsDelivr | ✅ `2bab932` |
| S2 | Cod OCR de pe CDN; destinatari nedeclarați | ✅ declarați `2bab932`; Open Food Facts doar la cerere `3fa74bc` |
| S3 | Plafonul AI se golește ușor | ✅ IPv6 /64, shard-uri `33f7b6e`; cererile fără App Check au 1/5 din plafon `3fa74bc`; 👤 Play Integrity |
| S4 | Telefonul revocat are încă cheia | ✅ `368d921` |
| S5 | Invitația în clar pe web | ✅ `f13b9b8`; 👤 domeniu propriu |
| S6 | Lanțul de aprovizionare în CI | ✅ firebase-tools fixat, pnpm 10.34.5 `3fa74bc`; 👤 Workload Identity, acțiuni fixate pe SHA |
| S7 | Ghidul AI scrie fără confirmare pe calea veche | ✅ `3fa74bc` |
| S8 | Codul de recuperare se poate suprascrie | ✅ `2bab932` |
| S9 | Reguli: 2 MB, câmpuri fără tip | ✅ 950 KB `2bab932`, tipuri `3fa74bc`; 👤 App Check Enforce |
| S10 | Camere vechi cu parolă după 2027 | ✅ îndemn la fiecare intrare `3fa74bc` |
| S11 | playRtdn acceptă orice cont Google | ✅ `2bab932`; 👤 variabila la pornirea Billing |
| S12 | verifyPlayPurchase nelegat de cumpărător | ✅ `3fa74bc` |
| S13 | FLAG_SECURE sub Android 13, titluri de notificare | ✅ `3fa74bc` |
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
| 5 | Calendarul fără facturi | ✅ `d4b7559` |
| 6 | Scurtături de salariu tăiate | ✅ `3df805e` |
| 7 | „bani liberi” | ✅ `7bb943d` |
| 8 | Ajustarea de sold ca venit | ✅ `112502d` |
| 9 | Tichetele în „nerepartizați” | ✅ `3df805e`, tichete pe membru `946f34e` |
| 10 | Două cifre pe zi (banner) | ✅ `7bb943d` |
| 11 | Săptămâni de 9 zile, S1 fantomă | ✅ `357780e` |
| 12 | Plăți rare în rezumat | ✅ `3df805e` |
| 13 | Analiză după o lună | ✅ `3df805e` |
| 14 | Căutarea | ✅ `3df805e` |
| 15 | Mementoul de backup | ✅ `3df805e` |
| 16 | Mărunțișuri (texte, limită plan gratuit, bandă de zile) | ✅ `4a90313`, `6c55981`, `19a0ab9`, `7dd03af` |

## Performanță (perf-report.md)
| # | Constatare | Stare |
|---|---|---|
| P1-1…P1-4 | Gata, revenire pe Astăzi, pornire, jurnal | ✅ `444d385` |
| P2-5, P2-6, P2-7 | Căutarea din jurnal, paleta, Plicuri (formatDate) | ✅ `d691122`, `3df805e` |
| P2-8 | Randări la orice schimbare din Home | ✅ `53206ff` |
| P2-9 | Sync pe firul principal | ✅ cheie pe sare, iv sărit `b634970`, base64 `9e816d6`; ⏳ Web Worker |
| P2-10 | CSS 635 KB | ⏳ continuu (D24) |
| P2-11 | Service worker offline | ✅ `53206ff` |
| P3-12, P3-14, P3-15 | Pachet de pornire, layout la pornire, animații | ✅ `d691122`, `1d894c0`, `9e816d6` |
| P3-13 | Fonturi (subset Fraunces) | ⏳ |

## Design (design-report.md)
| # | Constatare | Stare |
|---|---|---|
| D1–D3 | Trei cifre, cascada, chirie | ✅ `7bb943d` |
| D4, D5, D7, D8 | Bloc închis pe Alb, roșu, fonturi, paletă | ✅ `bbab747` |
| D6 | Accent Navy, „OLED” | ✅ `bbab747`, `aec8069` |
| D9 | Fâșia de pe desktop | ✅ `a58e0f2` |
| D10 | Layout de desktop | ⏳ |
| D11 | Cardul plicului compact | ⏳ |
| D12 | Trei totaluri pe Plicuri | ✅ `7fd69b4` |
| D13 | Obligații | ✅ `0a76d3f` (plata era deja verde) |
| D14 | Analiză | ✅ `f88b581` |
| D15 | Setări grupate | ⏳ (textele ✅ `4a90313`) |
| D16 | „+ Plic” în foaie | ⏳ |
| D17 | „Cum se citește?” | ✅ `bc64dbf` |
| D18 | Mișcări | ✅ `51dae9f` |
| D19–D23 | Text mic, gri, ghid, first-run, sync | ✅ D19, D20 `09fe9b5`; D21 `81bbc18`, `529763b`; D22 `4403de5`; D23 era deja făcut |
| D24 | Straturi CSS | ⏳ continuu |

## Produs (product-report.md)
| # | Constatare | Stare |
|---|---|---|
| 1 | Nimic util până la primul salariu | ✅ `85eff2b` |
| 2 | Transferuri numărate drept cheltuieli | ✅ `df711bd` |
| 3 | Fără măsurare | 👤 decizie (telemetrie) |
| 4 | Pornirea nu compară cu venitul | ✅ `677b675` |
| 5 | Cererea de recenzie | ✅ `21b3d5c` (👤 un build APK/AAB ca să intre pluginul Play Review) |
| 6 | 6 intenții, lipsește „Mă alătur familiei” | ✅ `4403de5` |
| 7 | Materiale de lansare vechi | ✅ `7e6b1ab` (👤 capturile noi) |
| 8 | „Închide anul” | ⏳ |
| — | Preț, probă, ASO | 👤 decizie |
