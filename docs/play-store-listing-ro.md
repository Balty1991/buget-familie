# Listare Google Play — Buget Familie

Text gata de lipit în Play Console. **Fără prețuri IAP** cât `BILLING_LIVE = false`. Plățile (Play Billing) se activează separat, după closed testing stabil.

**Versiune listing (sept 2026):** `versionName` **1.1.96** / `versionCode` **98**.

Sursă de poziționare: [`PLAY_LISTING.md`](./PLAY_LISTING.md). Data safety detaliat: [`PLAY_CONSOLE_DATA_SAFETY.md`](./PLAY_CONSOLE_DATA_SAFETY.md).

## Identitate

| Câmp | Valoare |
|---|---|
| Nume (max 30) | Buget Familie |
| Pachet | `ro.balty1991.bugetfamilie` |
| versionName | `1.1.96` |
| versionCode | `98` |
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

Scrii o dată ce plătiți
• „Ce plătim lunar”: veniturile (cu ziua lor) și cheltuielile știute — rate, facturi, grădiniță, mâncare pe săptămână — cu intervale (lumina 300–400).
• Când notezi salariul, aplicația propune singură cât merge în fiecare plic: obligațiile întâi, apoi traiul, apoi plățile rare. Al doilea salariu completează doar ce lipsește. Orice repartizare se poate anula.
• Plăți rare: RCA, impozite, Crăciun — se strâng puțin din fiecare salariu, ca luna lor să nu fie o lovitură.
• Neprevăzute: un plic mic pentru farmacie sau reparații, umplut doar din ce rămâne liber.
• Cine plătește: dacă o factură o plătește celălalt, aplicația îți spune cât să-i trimiți.

Pe Astăzi
• Un singur număr: cât poți folosi azi.
• Săptămâna care merge prea repede: „450 din 600, mai sunt 4 zile — cel mult 37 pe zi”.
• Cu trei zile înainte de salariu: ce plicuri au ajuns, ce a rămas și cât poți pune deoparte fără grijă.

Plicuri
• Fiecare plic arată câte zile mai sunt până la salariu și cât iese pe zi.
• Mâncarea pe săptămână are exact suma ei în fiecare săptămână, fără virgule. Ce rămâne poate trece în săptămâna următoare.
• Data salariului poate varia cu câteva zile; plicurile ajung și dacă întârzie.

Casă
• Până la 6 persoane, fără conturi separate. Sync opțional, criptat; serverul nu vede sumele.
• Bilanțul săptămânii, gata de trimis pe WhatsApp.
• Ghidul răspunde la „cât mai am la mâncare?” din datele de pe telefon.
• Bonuri citite pe telefon. Pozele nu pleacă. Un extras (CSV sau Excel) intră doar după ce confirmi; salariul din extras e recunoscut.

Din afara aplicației
• Widget rapid: Cheltuială, Bon și până la 3 obiceiuri — fără sume pe ecranul de start.
• Widget opțional „Poți cheltui azi”, pentru cine vrea cifra zilei pe ecranul principal.
• Dală în Setări rapide: o cheltuială din trasarea de sus.

Datele stau pe telefon. Fără reclame. Fără plată în magazin în versiunea asta.

Nu plătește facturi, nu dă credite și nu ține loc de consultant.
```

## Ce e nou în 1.1.96 (≤500 caractere, pentru „Note de lansare”)

```
• „Ce plătim lunar”: scrii o dată cheltuielile, iar la fiecare salariu primești repartizarea pe plicuri.
• Plăți rare (RCA, impozite, Crăciun) strânse lunar și plic de neprevăzute.
• Mâncarea pe săptămână fără virgule; toate săptămânile pe plic.
• Câte zile mai sunt până la salariu și cât iese pe zi.
• Avertizare când săptămâna merge prea repede și raport înainte de salariu.
• Bilanț pe WhatsApp și widget „Poți cheltui azi”.
```

## Feature bullets

1. **Repartizare automată la salariu** din „Ce plătim lunar” (două salarii, zile diferite, tichetele separat)
2. Plicuri pe **ciclul vostru de salariu** (nu doar luna calendar), cu săptămâni exacte și zile până la salariu
3. Plăți rare strânse lunar + plic de neprevăzute
4. Fără login bancar — date pe telefon; sync familie opțional, AES-GCM
5. Un număr clar pe Astăzi + avertizare când săptămâna merge repede
6. El și ea: până la 6 membri, cine plătește ce, transferuri propuse
7. Bon → De verificat → registru (poze doar pe telefon; OCR local); import extras CSV/Excel
8. Widgeturi (rapid fără sume, opțional cu cifra zilei), dală, PIN local, backup

> **Nu** lipi prețuri IAP (19,99 / 149 etc.) în store cât `BILLING_LIVE=false`. Vezi `BILLING_PLAY_PREP.md`.

## Data safety (rezumat)

Răspunsuri complete, mapate pe categorii Play: [`PLAY_CONSOLE_DATA_SAFETY.md`](./PLAY_CONSOLE_DATA_SAFETY.md).

- Date financiare: da, colectate de aplicație, stocate pe dispozitiv.
- Sincronizare: da, opțională; AES-GCM; dezvoltatorul nu poate citi plaintext.
- Cont utilizator: nu (core use).
- Publicitate / sharing / vânzare: nu.
- Analytics: niciun SDK de analytics sau reclame.
- Backup sistem Android: nu (`allowBackup=false`).
- Ștergere: in-app Resetare + pagina publică de ștergere.
- AI: opțional, întrebarea + ultimele mesaje + rezumatul bugetului către Google Gemini (Groq ca rezervă); niciodată jurnalul de mișcări sau pozele.
- Bonuri: IndexedDB local, nu sync.
- Bilanțul trimis pe WhatsApp: pleacă doar când omul apasă, prin aplicația lui de mesaje; dezvoltatorul nu primește nimic.

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
