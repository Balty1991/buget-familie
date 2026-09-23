# Listare Google Play — Buget Familie

Text gata de lipit în Play Console. **Fără prețuri IAP** cât `BILLING_LIVE = false`. Plățile (Play Billing) se activează separat, după closed testing stabil.

**Versiune listing (sept 2026):** `versionName` **1.1.86** / `versionCode` **88**.

Sursă de poziționare: [`PLAY_LISTING.md`](./PLAY_LISTING.md). Data safety detaliat: [`PLAY_CONSOLE_DATA_SAFETY.md`](./PLAY_CONSOLE_DATA_SAFETY.md).

## Identitate

| Câmp | Valoare |
|---|---|
| Nume (max 30) | Buget Familie |
| Pachet | `ro.balty1991.bugetfamilie` |
| versionName | `1.1.86` |
| versionCode | `88` |
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
Buget Familie îți spune câți lei poți folosi azi, din plic, până la salariu. Nu e un jurnal de magazin și nu se leagă de bancă.

Pe Astăzi
• Un singur număr: cât poți folosi azi.
• Intrat și ieșit în ciclul ăsta, sub număr.
• Zilele săptămânii în aceeași fișă — vezi cât mai ține fiecare zi, nu un al doilea ecran.
• Ultimele trei mișcări. Scorul, bilanțul și graficul stau la „Mai mult din ziua asta”.
• Pe Astăzi, „Notează” deschide suma. Nu mai e un plus plutitor peste bară.

Plicuri
• Fiecare plic arată cât s-a cheltuit din limită, pe săptămână sau pe tot ciclul.
• Poți muta lei între plicuri și între săptămâni.

Casă
• Până la 6 persoane, fără conturi separate. Sync opțional, o parolă, criptat; serverul nu vede sumele.
• Obligații: chirie, rate, abonamente — nume și sumă, fără logo-uri.
• Bonuri citite pe telefon. Pozele nu pleacă. Un extras CSV intră doar după ce confirmi.

Din afara aplicației
• Widget pe ecranul principal: Cheltuială, Bon și până la 3 obiceiuri. Doar nume, nicio sumă pe ecranul de start.
• Dală în Setări rapide: o cheltuială din trasarea de sus. Dacă aplicația era în fundal, foaia se deschide după ce revine, nu se pierde apăsarea.

Datele stau pe telefon. Fără reclame pe ecranele cu bani. Fără plată în magazin în versiunea asta — catalogul Casa / Familia se activează după testarea închisă.

Nu plătește facturi, nu dă credite și nu ține loc de consultant.
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
- Capturi: Astăzi (cifra, intrat/ieșit, săptămâna, trei mișcări, +), Notează (iconițe), Plan (bară cheltuit/limită), Mișcări (săptămâna), Obligații, Analiză (unde au mers banii). Widgetul nu e captură din app: pe telefon, fără sume.
- Shot list detaliat: [`PLAY_LISTING.md`](./PLAY_LISTING.md).

## Ce NU s-a atins

`family-crypto.ts`, `realtime-sync.ts`, `firestore.rules` — protocolul de familie rămâne identic. Play Billing nu e pornit (`BILLING_LIVE = false`).
