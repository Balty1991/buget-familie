# Buget Familie: code review de dezvoltator senior (26.09.2026)

Commit `1935b14` · v1.1.96 (versionCode 98) · doar citire; sondele sunt în scratchpad (`agenti/dev/`), nu în repo.

## 1. Pe scurt

- Verificări: `tsc --noEmit` 0 erori, `eslint --max-warnings 0` 0 probleme, `vitest` **115 fișiere / 1.104 teste, toate trec**.
- Aproape tot din auditul din 25.09 e reparat corect: rotunjirea plicurilor (`money2` în `allocationSpent`/`allocationStatus`), tombstone-urile pentru plan și setări (`sync-removals.ts`), merge-ul în 3 căi (`SyncBase`), scrierea cu precondiție (`expectedIv`), lanțul de scriere, gzip-ul pachetului, marcajul separat pentru câmpurile simple ale planului (`plan-scalars.ts`), anularea repartizării fără dublă scădere (`revertedAt`), Undo cu `updatedAt = now`, widgetul după miezul nopții și RTDN cu OIDC.
- Problemele care au rămas stau aproape toate în **stratul de sincronizare dintre hook și merge**. Pe acolo se pierd date fără niciun semn:
  1. **O cheltuială notată chiar înainte să sosească pachetul partenerului nu mai pleacă deloc** spre familie. Am reprodus pe emulator (P0/P1).
  2. **Conflictele de plic nu își țin promisiunea „niciodată LWW tăcut”.** Telefonul care a detectat conflictul își impune valoarea peste tot. Celălalt primește conflictul cu „local” și „partener” inversate, iar după rezolvare conflictul reapare (reprodus).
  3. Există **scrieri fără precondiție** (la intrare sau reluare și la mutarea camerei), iar **importul unui backup vechi pe un telefon conectat** derulează înapoi sumele întregii familii. Ambele sunt reproduse cu `mergeFamilyData`.
- Mai sunt câteva scăpări mai mici la tombstone-uri (categorii recreate, contribuții la evenimente) și un cost CPU mare al PBKDF2 la fiecare editare.

**Notă globală (dev): 7/10.** Domeniul financiar e solid și bine testat. Sync-ul a făcut un salt mare față de ieri, dar orchestrarea din `useFamilySync.ts` nu are niciun test și are bug-uri reale de pierdere de date.

---

## 2. Constatări

### D1. P0/P1: pachetul primit de la partener anulează push-ul local care aștepta (cheltuiala nu mai pleacă)
- **Ce se întâmplă:** în `useFamilySync.ts`, efectul de push (l. 444–505) programează trimiterea la 800 ms și își curăță timer-ul la fiecare schimbare a lui `data`. Dacă între timp sosește un snapshot de la partener, `syncHandleRemoteEnvelope` face `syncLastPortableRef.current = mergedPortable` (l. 223). Rezultatul unirii **conține și schimbarea locală netrimisă**. Urmează `setData(merged)`, efectul rulează din nou, cleanup-ul oprește timer-ul, iar `currentPortable === syncLastPortableRef.current`, deci **nu se mai programează nimic**. Schimbarea locală rămâne doar pe telefon până la următoarea editare locală. Același lucru se întâmplă după un push eșuat: primul snapshot care vine o marchează drept „trimisă”.
- **Reprodus pe emulator** (`agenti/dev/race.e2e.mjs`, rulat cu `firebase emulators:exec --config firebase.e2e.json`): Ioana notează 38 lei, iar la ~150 ms ajunge pachetul lui Radu (111 lei). După 12 s camera are `[111]`, iar Ioana are local `[38, 111]`. Cei 38 de lei pleacă abia când Ioana mai notează ceva (camera devine `[5, 38, 111]`). În viața reală, cheltuiala dispare pentru partener ore sau zile întregi, iar cifrele „pe zi” diferă între telefoane.
- **Reparare:** despărțiți „ultimul pachet trimis” de „ultimul pachet primit”. În `syncHandleRemoteEnvelope`, puneți ref-ul pe portabilul pachetului *remote* (sau pe `merged` doar când `merged` e egal cu remote). Altfel lăsați ref-ul neschimbat ca efectul să programeze push-ul. Adăugați și un flag `dirty` cu reîncercare (backoff 5 s / 30 s / 2 min) după un push eșuat, plus un scenariu în `e2e/sync.e2e.mjs` bazat pe sonda de mai sus.
- **Efort:** S (fix) + S (test e2e).

### D2. P1: conflictul de plic se rezolvă de fapt tăcut, în favoarea telefonului care l-a detectat, iar la celălalt apare inversat
- **Cauza** (`family-crypto.ts:254–300` + `useFamilySync.ts:210`): după ce B detectează conflictul (păstrează local 700, cameră 650), baza lui B devine pachetul remote (650). La următorul push al lui B, `before === remote` pe l. 274, deci câștigă local (700) **fără conflict**, iar 700 pleacă în cameră. A primește 700 cu baza 650: `before === local` pe l. 273, deci **A trece tăcut pe 700**. În plus, conflictul lui B vine în pachet, iar `openPrevious` (l. 296) îl preia la A exact cum e, adică cu `localAmount` = valoarea lui B. Pe A, „Păstrează ce am eu” aplică de fapt valoarea partenerului.
- **Reprodus** (`agenti/dev/probe/sync.test.ts`, testul 2): A vede conflictul `{local: 700, remote: 650}`, deși propria lui valoare era 650, iar suma lui a fost deja schimbată în 700.
- **Reparare:** conflictul trebuie să poarte valorile după `deviceId` (`values: {[deviceId]: amount}`), nu „local/remote”. Cât timp un conflict e deschis, pe baza lui trebuie păstrată valoarea de dinainte (sau conflictul să blocheze LWW-ul pe acel id), ca push-ul să nu rezolve singur.
- **Efort:** M.

### D3. P1: un conflict rezolvat reapare după ce partenerul trimite
- `applyAllocationConflictChoice` marchează conflictul `resolvedChoice`. La unire, `openPrevious` (l. 296) păstrează doar conflictele **nerezolvate** din ambele copii, iar conflictul rămas deschis pe telefonul partenerului (același id `conflict-<plic>`) **îl înlocuiește** pe cel rezolvat. La fel se întâmplă cu `mergeTransactionsWithConflicts` (l. 379–384). Stub-ul de „Anulează rezolvarea” se pierde la prima unire.
- **Reprodus** (sondă, testul 1): după ce A rezolvă și primește pachetul lui B, A are din nou 1 conflict activ.
- **Reparare:** unire pe `id` cu LWW pe `resolvedAt`/`detectedAt`, adică o rezolvare mai nouă decât detectarea închide conflictul pe toate telefoanele. Alternativ, un tombstone `conflicts:<id>`.
- **Efort:** S.

### D4. P1: scrieri fără precondiție la intrare, reluare și mutare întorc editările partenerului
- `syncOpenRoom` apelează `pushFamilyEnvelope(roomId, envelope, undefined, …)` (`useFamilySync.ts:284`), iar `syncMoveToInvite` face la fel (l. 405). Cu `expectedIv === undefined`, tranzacția nu verifică nimic (`realtime-sync.ts:163`). Între fetch și push stau două derivări PBKDF2 și partea de recuperare, adică o fereastră de ordinul secundelor. Dacă partenerul scrie în acest interval, scrierea lui e suprascrisă. Pe telefonul lui, baza = propria scriere, deci la snapshot `before === local` și câștigă camera: **editarea lui de sumă se pierde fără conflict**.
- **Reprodus** logic cu `mergeFamilyData` (sondă, testul 4): B are 700, baza 700, camera e suprascrisă cu 600, iar B trece pe 600 cu 0 conflicte.
- **Reparare:** în `syncOpenRoom`, aceeași buclă ca în efectul de push (`expectedIv = remoteEnvelope?.iv ?? null`, 3 reîncercări cu refetch și remerge). Merită extrasă o funcție comună `pushWithRetry(roomId, secret)`.
- **Efort:** S.

### D5. P1: importul unui backup vechi pe un telefon conectat derulează înapoi toată familia
- `confirmBackupImport` (`SettingsPanel.tsx:341`) face `onChange(backup.data)`, care trece prin `applyData`, deci prin `recordRemovals`. La push, baza e ultima cameră, iar valorile din backup arată drept „editări locale” și câștigă.
- **Reprodus** (`agenti/dev/probe/backup.test.ts`): camera are plicul `m`=700 și plicul nou `n`. După importul unui backup cu `m`=600, în cameră pleacă `m`=600 (fără conflict), iar `n` primește tombstone și **dispare de pe toate telefoanele** (≤10 dispariții nu sunt oprite de plasa `MAX_REMOVED`). Mișcarea editată ajunge în conflict.
- **Reparare:** când sync-ul e activ, importul trebuie fie (a) să întrebe „Înlocuiești datele familiei sau doar ale acestui telefon?” și, pentru varianta locală, să deconecteze sesiunea, fie (b) să reseteze baza (`writeSyncBase` cu backup-ul însuși) și să nu înregistreze tombstone-uri pentru import (`setData` direct, nu prin `applyData`).
- **Efort:** S/M.

### D6. P2: o categorie ștearsă și creată din nou dispare la prima unire
- `recordRemovals` ridică piatra local la re-creare (`sync-removals.ts:45`). Partenerul însă o are încă, iar reuniunea din `mergeFamilyData:405–413` o readuce. `alive("categories", name)` nu are marcaj de timp (l. 428), deci categoria e scoasă din nou, pe ambele telefoane, cât timp piatra trăiește (180 de zile).
- **Reprodus** (sondă, testul 3).
- **Reparare:** la re-adăugare, păstrați piatra dar treceți un „revive” datat, de exemplu `customCategoryStamps: {[name]: updatedAt}`. Sau transformați categoriile în obiecte `{name, updatedAt}`.
- **Efort:** S.

### D7. P2: contribuțiile scoase la anularea unei repartizări revin de pe celălalt telefon
- `revertSalaryAllocationApplication` (`finance-data.ts:~760`) scoate contribuțiile `event:` din `plannedEvents[].contributions`. `mergePlannedEvents` (`family-crypto.ts:476`) unește însă contribuțiile prin reuniune (`mergeById`), fără tombstone. Același lucru se întâmplă cu orice contribuție ștearsă manual.
- **Reprodus** (sondă, testul 5): după anulare contribuțiile sunt `undefined`, iar după unirea cu partenerul revine `[{c1, 200}]`. Fondul de Crăciun arată astfel 200 lei „puși deoparte” care s-au întors de fapt în plic.
- **Reparare:** marcați contribuția `removedAt` în loc să o scoateți (același model ca `revertedAt`) sau adăugați entitatea `eventContributions` în `TOMBSTONE_ENTITIES`.
- **Efort:** S.

### D8. P2: PBKDF2 (250k iterații) rulează la fiecare criptare și decriptare
- `encryptFamilyData` generează o sare nouă la fiecare scriere (l. 80), deci fiecare decriptare derivă cheia de la zero (l. 132). Un ciclu de editare înseamnă: fetch și decriptare (1 derivare), criptare (1), ecoul propriei scrieri prin `onSnapshot` (1, uneori 2, din cauza `includeMetadataChanges: true` și fără deduplicare pe `iv`). Am măsurat 40 ms/derivare pe desktop, deci **≈ 0,6–1,2 s CPU pe un Android mediu la fiecare cheltuială notată**, plus baterie.
- **Reparare:** cache `Map<salt, CryptoKey>` pentru decriptare. La criptare, reutilizați o sare per sesiune (IV-ul rămâne unic, deci AES-GCM rămâne sigur). În `subscribeFamilyRoom`, ignorați snapshot-urile cu același `envelope.iv` ca ultimul procesat.
- **Efort:** S.

### D9. P2: snapshot-urile sunt procesate concurent și fără ordine
- `syncHandleRemoteEnvelope` e async (decriptarea durează), iar două snapshot-uri apropiate rulează în paralel. Fiecare face `setData(merged)` **nefuncțional**, peste `syncDataRef.current`. Dacă cel vechi termină ultimul, starea regresează la pachetul vechi, iar din cauza D1 nu se mai trimite nimic. Tot aici, orice `setData(fn)` al utilizatorului încă nerandat se pierde, pentru că ref-ul se actualizează doar la randare.
- **Reparare:** coadă serială (promise chain) pentru snapshot-uri și push-uri, `setData((current) => merge(current, remote))` funcțional și ignorarea pachetelor mai vechi decât ultimul `iv` sau `createdAt` văzut.
- **Efort:** S/M.

### D10. P2: câmpurile de setări neenumerate câștigă mereu local
- `settings: { ...remote.settings, ...local.settings, … }` (`family-crypto.ts:508`). Pentru câmpurile fără regulă proprie câștigă mereu telefonul local, deci schimbarea partenerului nu ajunge niciodată. Concret: `familyName: local || remote` (l. 511), adică redenumirea familiei nu se propagă, iar `familyCode` la fel. Orice câmp nou adăugat în `FamilySettings` moștenește tăcut acest comportament.
- **Reparare:** o listă explicită `SYNCED_SETTINGS` cu marcaj de timp (ca `familyTimeZoneSetAt`) și un test care eșuează când apare un câmp nou neclasificat („doar local” sau „sincronizat”).
- **Efort:** S.

### D11. P3: tombstone-urile sunt tăiate la 500 în 8 locuri, deși plafonul e 2.000
- `.slice(-500)` în `Home.tsx:344, 526, 548, 607, 611, 614, 617`, `undo-delete.ts:86` și `RecurringPanel.tsx:226`. Între timp `pruneTombstones` păstrează 2.000 pe 180 de zile. O familie care importă un extras și apoi îl șterge pierde local pietrele mai vechi. De obicei le readuce partenerul, dar nu dacă amândoi au tăiat.
- **Reparare:** un singur helper `addTombstones(data, entries)` care apelează `pruneTombstones`.
- **Efort:** S.

### D12. P3: efectul `adoptOutsideExpenses` din `Home.tsx:205–208` rulează după fiecare randare
- `applyData` e recreat la fiecare randare, iar efectul are cheile `[storageReady, applyData]`. Nu mai e bug de date (acum respectă `outsideChosen` și pune `updatedAt`), dar parcurge toate mișcările la fiecare randare a Home. Pe mișcările primite de la partener, fiecare telefon le adoptă independent în plicul găsit de el, cu `updatedAt = now`, ceea ce poate produce conflicte de mișcare dacă planurile diferă o clipă.
- **Reparare:** `applyData` stabil (`useCallback` sau ref) și rulare doar la schimbarea planului sau a numărului de mișcări.
- **Efort:** S.

### D13. P3: aceeași cifră „pe zi” are încă reguli de rotunjire diferite (constatare veche, încă prezentă)
- `allowance.ts:97` (`round2`, poate promite cu un ban mai mult), `household-insights.ts:517` (`floor` la leu), `:532` și `:724` (`floor` la ban), `calendar-budget.ts:95` (`roundMoney`) și `analyst.ts:408` (`round`).
- **Reparare:** un singur `perDay(remaining, days)` cu `floor` la ban în `money-format` sau `finance-core`.
- **Efort:** S.

### D14. P3: Functions, disponibilitatea ghidului AI
- `aiGuide` folosește un contor global `"anonymous-pool"` (30/oră) și `"global-day"` (`index.ts:636–638`), amândouă cu `failOpen: false`. Oricine poate epuiza pool-ul anonim, iar contorul zilnic e **un singur document scris în tranzacție la fiecare cerere**: Firestore acceptă aproximativ o scriere pe secundă susținut pe un document, deci la vârf tranzacțiile eșuează și ghidul refuză pe toată lumea. În `allowPerCaller` (l. 576), cota pe uid se consumă chiar dacă cea pe IP refuză.
- **Reparare:** contor distribuit (N shard-uri) pentru `global-day` și verificarea IP-ului înaintea uid-ului.
- **Efort:** S.

### D15. P2: build, CI și tipuri (verificat acum)
- `tsconfig.json` exclude încă `**/*.test.ts`. Cu testele incluse, **21 de erori de tip** (8 în `finance-data.test.ts`, 3 în `suggestions.test.ts` etc.): testele construiesc date pe care produsul nu le-ar accepta.
- `build-android-apk.yml:27` rulează doar `finance-data.test.ts`. `release-android-aab.yml` rulează testele, dar nu `check` și nici `lint`.
- `firebase-tools@latest` e nefixat în `deploy-firebase-functions.yml:130` și `deploy-firestore-rules.yml:77`.
- `react-hooks/exhaustive-deps: off`: D1, D9 și D12 sunt exact tipul de bug pe care regula l-ar fi semnalat.
- `minifyEnabled false` în release. `express` e în `dependencies`, iar `server/index.ts` nu are niciun rol în Pages sau Capacitor.
- **Reparare:** includeți testele în type-check (un `tsconfig.test.json` + `pnpm check`), același job de verificare în toate workflow-urile, versiune fixă pentru `firebase-tools` și `exhaustive-deps: warn` doar pe `hooks/`.
- **Efort:** S/M.

### D16. P3: fișiere prea mari și cod de curățat
- `finance-data.ts` are 2.028 de linii, iar l. 614 (`normalizeAppData`) e o singură linie de ~9 KB. `Home.tsx` (657 de linii), `PlanStudio.tsx` și `finance-data.ts` au împreună 19 linii de peste 1.000 de caractere. Propun spargerea în `lib/finance/normalize.ts`, `envelopes.ts`, `salary-rules.ts` și `nlp.ts`.
- CSS: 80 de fișiere, 2.295 de `!important` (erau 3.448), deci progresul e real.
- În rădăcină sunt încă `ideas.md`, `todo.md`, `RESTORE_HOME.md`, `REDESIGN_DIRECTION.md`, plus `firestore-debug.log` pe disc.
- **Teste lipsă pe zona cu risc:** `useFamilySync.ts` (611 linii) nu are niciun test unitar. Logica de programare a push-ului, reluarea și snapshot-urile ar trebui extrase într-un modul pur (`sync-engine.ts`: `onLocalChange`, `onRemote`, `onPushResult`), testabil fără React. Scenariile D1–D5 pot deveni teste de regresie aproape identice cu sondele mele.
- **Efort:** M/L.

---

## 3. Idei de dezvoltare (prioritizate)

1. **Motor de sync pur și testat** (`sync-engine.ts`): coadă serială, `dirty` + backoff, precondiție la fiecare scriere, deduplicare pe `iv`. Rezolvă D1, D4, D8 și D9 dintr-o singură mutare. (M)
2. **Conflicte „pe telefon”**, cu valori pe `deviceId`, rezolvare sincronizată și istoric „cine a ales ce”. (M)
3. **Import de backup conștient de sync:** „doar acest telefon” sau „toată familia”, cu previzualizarea diferențelor (câte plicuri și sume se schimbă). (S/M)
4. **Test de proprietate pentru merge** (fast-check): pentru orice ordine de livrare a pachetelor, telefoanele converg și nicio editare necontestată nu se pierde. (M)
5. **Indicator „netrimis”** în bara de sync (numărul de schimbări locale încă netrimise), ca omul să vadă când telefonul e în urmă. (S)
6. **Arhivarea anilor încheiați** într-un document separat pe an, ca pachetul principal să nu se apropie niciodată de 900 KB. (L)

## 4. Ce e deja foarte bine

- Reparațiile după auditul precedent sunt corecte și au teste dedicate (`sync-deep.test.ts`, `write-chain.test.ts`, `plan-scalars.test.ts`, `money-rounding.test.ts`, `undo-delete.test.ts`).
- Anularea repartizării e gândită atent: `afterAmount` distinge plicul neatins de cel editat, există `previousCycle` și `revertedAt` ca urmă sincronizabilă.
- Lanțul de scriere HMAC plus regulile publicate după testul pe emulator sunt un design foarte bun pentru o aplicație cu criptare end-to-end.
- CI-ul de Pages rulează type-check, lint și testele de două ori (inclusiv pe `Pacific/Auckland`), iar sync-ul e testat cap-coadă pe emulator.
- Widgetul folosește acum fusul familiei și se reîmprospătează la 30 de minute. Separarea „doar local” / „sincronizat” la criptare e clar documentată.

---
Sonde (în afara repo-ului): `scratchpad/agenti/dev/probe/sync.test.ts`, `probe/backup.test.ts` (rulare: `vitest run --config agenti/dev/vitest.probe.config.mjs`) și `agenti/dev/race.e2e.mjs` (pe emulator).
