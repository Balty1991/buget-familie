# Buget Familie — Cercetare de piață (condensat)

**Data:** 20 septembrie 2026 (EEST)  
**Context:** PWA/Capacitor local-first, plicuri pe ciclu de salariu, sync familie AES-GCM, fără login bancar, UI RO.  
**Document complet (sursă):** material de lucru pe box; acest fișier e varianta scurtă pentru repo.

---

## 1. Rezumat

Piața Play e saturată pe „conectează banca → auto-categorizează → grafice”, dar rămâne sub-acoperită pe **familie + plicuri + ciclu salarial + privacy fără open banking**. Acolo se poziționează Buget Familie.

**One-liner:** plicuri pe ciclu salarial, fără bank login, sync criptat, UI RO.

**Monetizare recomandată (RO):** freemium generos + Familia **19,99 RON/lună** / **149 RON/an** (deja în `entitlements.ts`); opțional mai târziu un tier Family mai sus ~**29,99 / 229**. Trial 14 zile. Fără ads pe ecrane financiare. `BILLING_LIVE=false` până după listare stabilă.

---

## 2. Concurenți (scurt)

| Produs | Poziție | Preț (indicativ) | Notă |
|---|---|---|---|
| **YNAB** | Zero-based / plicuri | ~14,99 USD/lună / 109 USD/an | Metodă puternică; scump pentru masa RO |
| **Goodbudget** | Envelope clasic | ~10 USD/lună / 80 USD/an | UI perceput învechit; rating mai slab |
| **Spendee** (CZ) | Tracker vizual + shared | Free + Plus/Premium (~1,99–5,99 USD/lună) | Design; plângeri bank sync / carduri |
| **Wallet** (BudgetBakers, CZ) | Multi-valută / polish | Freemium + Premium | Dominant EE; bank sync agresiv |
| **Money Manager** | Free all-rounder | Free + cloud sync plătit | Popular; sharing familie slab |
| **Toshl** | Tracking elegant | Pro ~2,99–4,99 USD/lună | Mai puțin „envelope household” |
| **CashControl** (RO) | Tracking local | Pro ~19,99 lei/lună | Relevant RO; nu flux plicuri-ciclu familie |
| **Martia** (RO) | AI + open banking | Abonament | Opusul privacy local-first |
| **Plan & Multiply** | Offline cuplu | Solo/Couple €/an | Similar ca poziție; nu e RO |

Băncile RO (BT Pay, Revolut) = categorii, nu plan pe plicuri.

---

## 3. Teme de durere (review-uri 2024–2026)

1. **Bank sync eșuează** / tranzacții greșite (cea mai acută).
2. **Complexitate / onboarding** greu (YNAB etc.).
3. **Ads** și freemium toxic pe ecranele de bani.
4. **Family sharing** slab sau scump per loc.
5. **Limbă / localizare** EE-RO insuficientă.
6. **Frica de bank login** și privacy.
7. Lag UI, restore purchases, filtre lipsă (secundar).

---

## 4. Diferențiatori Buget Familie

| Diferențiator | De ce contează |
|---|---|
| Plicuri + **tranșe pe ciclu salarial** | „Ce pot folosi acum” fără bank sync |
| Fără login bancar | Trust; opus Martia/Spendee Premium |
| Sync criptat familie (parolă comună) | Cuplu/gospodărie fără conturi grele |
| UI românesc calm | ASO + retenție RO |
| Casa generos (10 plicuri în cod) + Familia 1 preț | Conversie fără ostatici pe date |
| Widget / dală / captură rapidă | Habit loop fără sume pe home screen |

---

## 5. Prețuri RO (recomandare)

| Plan | Preț | Rol |
|---|---|---|
| **Casa** | 0 | 10 plicuri, 1 membru, 1 device — sursa de adevăr: `entitlements.ts` |
| **Familia** | **19,99 RON/lună** / **149 RON/an** | Sync, membri, OCR/PDF etc. (conform entitlements) |
| Opțional later | ~29,99 / 229 | Tier Family mai sus dacă piața suportă |

Justificare: sub YNAB/Goodbudget, aliniat CashControl Pro (~20 lei), family sharing tip YNAB la preț local.

**Gates sigure:** nu bloca înregistrarea cheltuielilor; nu bloca datele la anulare; paywall pe sync multi-device / membri / OCR premium.

---

## 6. Roadmap P0 / P1 / P2

### P0 — Launch Play (0–8 săptămâni)
- Closed testing + checklist pe device
- Privacy/terms la versiunea release
- App Check metrics (fără Enforce prematur)
- Listing RO (fără IAP cât Billing e off)
- Polish Astăzi / plicuri / onboarding ciclu

### P1 — Retenție + ARPU (luna 2–4)
- Play Billing + restore + downgrade fără pierdere date
- Monitorizare conflicte sync
- Widgets / membri / analiză clară
- Opțional: tier Family superior

### P2 — Diferențiere (luna 4–9)
- minify/ProGuard, split Home, Playwright
- OCR polish, CSV bank import (fără open banking obligatoriu)
- Material You / perf mid-range

---

## 7. Gap vs. produs curent (v1.1.45)

| Zonă | Stare | Acțiune |
|---|---|---|
| Plicuri + tranșe | Puternic | Evidențiază în ASO |
| Fără bank linking | Aliniat poziției | Nu adăuga open banking în P0 |
| Sync criptat | Implementat | Closed testing 2 device |
| Billing | Off (corect) | După listare stabilă |
| Casa 10 plicuri | Cod OK; strategie aliniată în acest commit | Menține o singură sursă |
| Widgets | Există | Bifează pe telefon |

---

## 8. Surse (URL)

### Concurență & prețuri
- YNAB: https://www.ynab.com/pricing
- Goodbudget: https://goodbudget.com/pricing/
- Spendee Play: https://play.google.com/store/apps/details?id=com.cleevio.spendee
- Wallet Play: https://play.google.com/store/apps/details?id=com.droid4you.application.wallet
- Money Manager Play: https://play.google.com/store/apps/details?id=com.realbyteapps.moneymanagerfree
- CashControl: https://www.cashcontrol.ro/pricing
- Martia: https://martia.ro/ (open banking RO)

### Play / date / abonamente
- User Data: https://support.google.com/googleplay/android-developer/answer/10144311
- Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Subscriptions: https://support.google.com/googleplay/android-developer/answer/12154973

### UX
- Android accessibility: https://developer.android.com/guide/topics/ui/accessibility/apps

---

## 9. Concluzie

Nu „bate YNAB la features” și nu „Spendee la bank sync”. Câștigă **familia din România care vrea plicuri pe ciclu de salariu, fără să lege banca**, la un abonament Familie accesibil, cu UI calm și sync criptat. P0 = listare + trust; P1 = Billing + retenție; P2 = polish lung.
