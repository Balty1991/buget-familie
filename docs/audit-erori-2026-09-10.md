# Audit de corectitudine — 10 septembrie 2026

**Domeniu:** registrul financiar, sincronizarea între telefoane, citirea bonurilor și regulile Firestore.
**Metodă:** citirea codului din `client/src/lib` și `client/src/components`, urmată de teste care reproduc fiecare eroare înainte de corecție.
**Stare la pornire:** `pnpm check` fără erori, `pnpm test` cu 73 de teste trecute. Erorile de mai jos nu erau vizibile pentru compilator sau pentru suita existentă.

## Rezumat

Șase erori confirmate, dintre care trei pot pierde sau falsifica date ale utilizatorului. Toate au acum un test de regresie care eșua înainte de corecție.

| # | Efect pentru utilizator | Gravitate | Fișier |
|---|---|---|---|
| 1 | Mișcările adăugate noaptea primesc ziua precedentă | Mare | `lib/finance-data.ts` |
| 2 | Rapoartele lunare pierd ultima zi a lunii | Mare | `components/ReportsPanel.tsx` |
| 3 | Datoriile și obiectivele dispar la sincronizare | Foarte mare | `lib/family-crypto.ts` |
| 4 | O plată recurentă poate fi înregistrată de două ori | Mare | `lib/finance-data.ts` |
| 5 | Bonurile cu produse repetate își pierd tot detaliul | Medie | `lib/receipt-utils.ts` |
| 6 | Datele imposibile din OCR sunt salvate ca atare | Mică | `lib/receipt-utils.ts` |
| 7 | Pachetele criptate ale tuturor familiilor puteau fi listate | Mare (securitate) | `firestore.rules` |

## 1 și 2. Ziua calendaristică era luată din UTC

`isoToday()` era `new Date().toISOString().slice(0, 10)`. `toISOString()` întoarce ziua **UTC**, nu ziua de pe telefon. România este UTC+2 iarna și UTC+3 vara, deci între miezul nopții și ora 03:00 ziua UTC este încă cea de ieri:

```
moment local:      Fri Sep 11 2026 01:30:00 GMT+0300
isoToday() vechi:  2026-09-10   ← ziua greșită
data locală:       2026-09-11
```

O cumpărătură de la ora 01:00 ajungea așadar în ziua anterioară, iar la limita dintre săptămâni sau la începutul unei perioade salariale ajungea în săptămâna sau în ciclul greșit. Fiind data implicită pentru orice mișcare nouă, eroarea atingea captura rapidă, ghidul AI, plățile de rate și scadențele recurente.

Aceeași conversie apărea pe date construite din componente locale, unde efectul era permanent, nu doar nocturn. `monthRange` din rapoarte calcula sfârșitul lunii ca `new Date(year, index, 0).toISOString().slice(0, 10)` — miezul nopții local, adică ziua precedentă în UTC:

```
septembrie 2026 → { start: "2026-09-01", end: "2026-09-29" }
februarie 2026  → { start: "2026-02-01", end: "2026-02-27" }
```

Orice cheltuială făcută pe 30 septembrie lipsea din raportul lunar și din PDF-ul de bilanț. Selectorul „Luna aceasta” din Plan pornea ciclul pe ultima zi a lunii anterioare, iar graficul de 7 zile de pe ecranul Astăzi era decalat cu o zi.

**Corecție.** Un singur ajutor exportat formatează din componentele locale, iar toate locurile care transformă o dată calendaristică în ISO îl folosesc:

```ts
export const isoDate = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
export const isoToday = () => isoDate(new Date());
```

Au fost aliniate `finance-data.ts`, `household-insights.ts`, `ReportsPanel`, `PlanStudio`, `AllocationRecommendationsPanel`, `Home`, `home-secondary` și numele fișierelor exportate.

## 3. Datoriile și obiectivele dispăreau la unirea a două telefoane

`mergeCollection` din `family-crypto.ts` filtra rezultatul așa:

```ts
.filter((item) => (Date.parse(tombstones.get(item.id)?.deletedAt || "") || 0) < timestamp(item))
```

Când nu exista nicio ștergere înregistrată, partea stângă era `0`. `timestamp(item)` este tot `0` pentru un element fără `updatedAt` și fără `createdAt`, iar `0 < 0` este fals — elementul era eliminat.

Dialogul de datorii și obiective (`GoalForm`) salva exact astfel de elemente: nici `updatedAt`, nici `createdAt`. Consecința este pierdere de date fără avertisment: orice datorie sau obiectiv creat din interfața normală dispărea definitiv la prima sincronizare de familie, iar registrul rezultat era apoi scris peste copia locală.

**Corecție.** Absența unei ștergeri înseamnă păstrare, indiferent de marcaj:

```ts
const tombstone = tombstones.get(item.id);
if (!tombstone) return true;
return (Date.parse(tombstone.deletedAt) || 0) < timestamp(item);
```

`GoalForm` pune în plus `updatedAt` la salvare, ca versiunea mai nouă să câștige corect între telefoane. Testul care verifică faptul că o scadență ștearsă nu se întoarce continuă să treacă.

## 4. Plata recurentă putea fi dublată

`confirmRecurringPayment` calcula scadența în așteptare, dar nu se oprea când aceasta lipsea:

```ts
const pending = pendingRecurringInPlan(data).find((item) => item.id === recurringId);
...
if (!item || !source || !member) return undefined;      // `pending` nu era verificat
... date: pending?.dueDate || isoToday(),               // cădea pe ziua curentă
```

După prima confirmare scadența nu mai era în așteptare, dar o a doua apăsare — din Obligații, din Astăzi sau din panoul de scadențe — adăuga o a doua cheltuială, datată azi. Comentariul funcției promitea explicit că acest lucru nu se poate întâmpla.

**Corecție.** Lipsa scadenței în așteptare oprește operațiunea, iar mișcarea primește data scadenței, nu ziua apăsării.

## 5. Bonurile cu produse repetate își pierdeau tot detaliul

`reconcileItems` colapsa liniile identice printr-un `Map` cu cheia `etichetă-sumă`. Două pâini de 3,00 lei pe același bon deveneau una singură, suma liniilor nu mai atingea totalul, iar ramura de reconciliere arunca **întreaga** listă:

```
["PAINE 3,00", "PAINE 3,00", "LAPTE 7,00", "TOTAL 13,00"]  →  items: []
```

Utilizatorul rămânea cu totalul, fără nicio linie de repartizat pe plicuri — exact funcția pe care produsul o consideră prioritară.

Colapsarea exista dintr-un motiv real: aceeași linie citită din două poze suprapuse este o dublură. Cele două cazuri arată identic în text, așa că regula nu poate fi decisă doar din etichetă.

**Corecție.** Totalul bonului arbitrează. Se încearcă întâi lista completă, apoi cea colapsată, și se păstrează varianta care se reconciliază cu totalul. Ambele situații sunt acoperite de teste.

## 6. Datele imposibile din OCR erau acceptate

`inferDate` lua prima potrivire de forma `zi-lună-an` și o rescria fără nicio validare, așa că un cod de bon precum `45/45/2026` devenea `2026-45-45`. Funcția verifică acum că luna este între 1 și 12 și că ziua există în luna citită, altfel trece la următoarea potrivire.

## 7. Regulile Firestore permiteau listarea colecției

Regula era `allow read: if roomId.size() == 64`. În Firestore, `read` acoperă atât `get` (un document) cât și `list` (interogarea colecției). Cum toate camerele au ID de 64 de caractere, condiția era adevărată pentru fiecare document, deci o interogare pe colecția `familySync` reușea și întorcea pachetele criptate ale tuturor familiilor. Ele rămân criptate AES-GCM, dar un atacator le putea descărca în bloc și ataca offline parolele slabe, fără să cunoască vreun ID de cameră.

**Corecție.** `allow get` în loc de `allow read`. Un `get` cere ID-ul camerei, adică deja cunoașterea parolei de familie.

> **Rămâne de decis.** `allow write` permite în continuare oricui cunoaște ID-ul camerei să suprascrie pachetul familiei. Cât timp nu există autentificare, protecția este exclusiv puterea parolei de familie. Două atenuări posibile, în ordinea efortului: impunerea unei lungimi minime a parolei în interfață și App Check obligatoriu (cheia reCAPTCHA este deja prevăzută în `firebase-config.ts`, dar neconfigurată).

## Verificare

- `pnpm check` — fără erori.
- `pnpm test` — 84 de teste trecute, dintre care 11 noi în `client/src/lib/regression-audit.test.ts`.
- `pnpm build` — build complet, fără erori.

Fiecare test nou eșua pe codul dinaintea corecției.

## Observații rămase, fără corecție în această tranșă

- `allocationSpent` numără cheltuielile până la data cea mai târzie a ferestrei de salariu, în timp ce `allocationWeeksStatus` construiește tranșele doar până la data obișnuită. O cheltuială făcută în zilele de flexibilitate scade din totalul plicului, dar nu apare în nicio săptămână. Este posibil să fie intenționat; merită o decizie explicită.
- `normalizeAppData` conține o condiție dublată la filtrarea transferurilor (`typeof item.id === "string"` de două ori). Este inofensivă, dar sugerează o verificare pierdută la scriere.
- `inferVendor` alege primul rând scurt fără cifre; pe bonurile unde antetul legal e format din mai multe rânduri scurte, magazinul propus poate fi greșit. Corectarea manuală există, deci impactul este mic.
