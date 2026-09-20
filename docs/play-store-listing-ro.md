# Listare Google Play — Buget Familie

Text gata de lipit în Play Console. **Fără prețuri IAP** cât `BILLING_LIVE = false`. Plățile (Play Billing) se activează separat, după closed testing stabil.

**Versiune listing (sept 2026):** `versionName` **1.1.45** / `versionCode` **47**.

Sursă de poziționare: [`PLAY_LISTING.md`](./PLAY_LISTING.md). Data safety detaliat: [`PLAY_CONSOLE_DATA_SAFETY.md`](./PLAY_CONSOLE_DATA_SAFETY.md).

## Identitate

| Câmp | Valoare |
|---|---|
| Nume (max 30) | Buget Familie |
| Pachet | `ro.balty1991.bugetfamilie` |
| versionName | `1.1.45` |
| versionCode | `47` |
| Categorie | Finance |
| Etichete | Buget, Familie, Cheltuieli, Plicuri, România, Ciclu salariu |
| Contact | contact.vanzo@gmail.com |
| Politică | https://balty1991.github.io/buget-familie/privacy.html |
| Termeni | https://balty1991.github.io/buget-familie/terms.html |
| Ștergere date | https://balty1991.github.io/buget-familie/delete-data.html |

## Descriere scurtă (≤80 caractere)

```
Plicuri pe ciclu de salariu, sync familie criptat — fără login bancar.
```

(72 caractere cu spații)

## Descriere completă

```
Buget Familie este registrul unei gospodării românești: fiecare leu are un loc până la următorul venit.

De ce e altfel
• Plicuri pe categorie, membru și sursă — card, cash, bonuri de masă, transfer comun.
• Fără login bancar și fără cont. Datele stau pe telefon.
• Sincronizare opțională între telefoane: o parolă de familie, pachet AES-GCM; serverul nu vede lei în clar.
• Astăzi: un număr de decizie — cât poți folosi fără să strici următoarea perioadă.
• Scor de sănătate, ritm zilnic, recapitulare de lună.
• El și ea: cine a mișcat banii, fără conturi separate.
• Bonuri cu OCR local. Pozele nu pleacă de pe telefon.
• De verificat: bonuri și CSV bancă (BCR, BT, ING, Revolut) confirmate înainte de registru.
• PDF de bilanț și CSV, generate în aplicație.
• Widget și dală: cheltuială sau bon, fără sume pe ecranul de start.
• Teme: Alb Atelier, Noapte, Aurora, Navy, Cyber — contrast verificat pe controale.
• Reamintiri locale pe orizont scurt (≤14 zile); la deschiderea aplicației se reprogramează.

Planuri (catalog în app; fără reclame pe ecranele cu bani)
• Casa — gratuit: registrul de bază, până la 10 plicuri, un membru.
• Familia — un plan pentru toată casa: sync criptat, plicuri nelimitate, până la 6 persoane. Disponibilitatea plății pe Google Play vine după activarea Billing — până atunci nu există unlock-uri plătite în magazin.

Aplicația nu plătește facturi, nu investește și nu înlocuiește un consultant. Este un atelier de decizii, în română, în lei.
```

## Feature bullets

1. Plicuri pe **ciclul vostru de salariu** (nu doar luna calendar) + tranșe săptămânale
2. Fără login bancar — date pe telefon; sync familie opțional, AES-GCM
3. Un număr clar pe Astăzi: ce poți cheltui azi, fără să strici perioada
4. El și ea: până la 6 membri, cine a scos din ce plic
5. Bon → De verificat → registru (poze doar pe telefon; OCR local)
6. Import CSV bănci RO + dedupe (fără OAuth bancar)
7. Conflict onest pe plicuri și mișcări (nu LWW tăcut pe bani)
8. Widget / dală rapidă + PIN local + backup export/import

> **Nu** lipi prețuri IAP (19,99 / 149 etc.) în store cât `BILLING_LIVE=false`. Vezi `BILLING_PLAY_PREP.md`.

## Data safety (rezumat)

Răspunsuri complete, mapate pe categorii Play: [`PLAY_CONSOLE_DATA_SAFETY.md`](./PLAY_CONSOLE_DATA_SAFETY.md).

- Date financiare: da, colectate de aplicație, stocate pe dispozitiv.
- Sincronizare: da, opțională; AES-GCM; dezvoltatorul nu poate citi plaintext.
- Cont utilizator: nu (core use).
- Publicitate / sharing / vânzare: nu.
- Analytics: opțional Umami, doar dacă e configurat la build.
- Backup sistem Android: nu (`allowBackup=false`).
- Ștergere: in-app Resetare + pagina publică de ștergere.
- AI: rezumat opțional către Gemini, niciodată registrul întreg.
- Bonuri: IndexedDB local, nu sync.

## Content rating

App de finanțe personale, fără user-generated public, fără violență, fără locație. Public țintă: 18+.

## Declarații Play

- **Financial features:** evidență personală / de familie. Nu e sfat de investiții, nu e credit, nu inițiază plăți.
- **Closed testing:** 12+ testers, 14 zile, înainte de producție.
- **Play Billing:** dezactivat în acest build (`BILLING_LIVE = false`). Produsele Casa (gratuit) și Familia (`familie_lunar`, `familie_anual`) se creează în Console după listare stabilă.

## Grafică de magazin

- Grafic caracteristică: [play-feature.svg](https://balty1991.github.io/buget-familie/play-feature.svg) — exportă PNG 1024×500 (Play nu acceptă SVG).
- Capturi: Astăzi (un număr + feed), Plan (plicuri), Mișcări, De verificat, Sync, Analiză, temă Noapte, Setări → Încredere.
- Shot list detaliat: [`PLAY_LISTING.md`](./PLAY_LISTING.md).

## Ce NU s-a atins

`family-crypto.ts`, `realtime-sync.ts`, `firestore.rules` — protocolul de familie rămâne identic. Play Billing nu e pornit (`BILLING_LIVE = false`).
