# Analiză cu agent-utilizator — 11 septembrie 2026

Aplicația a fost parcursă ecran cu ecran într-un browser real (Chromium, 360 și
390px, limba română), de două ori: o dată cu registrul gol, ca un om care tocmai
a instalat-o, și o dată cu date realiste încărcate prin fluxul de import. Peste
acestea, o trecere cu date ostile prin biblioteca de calcul.

Ce urmează sunt doar lucrurile verificate faptic. Ce n-am putut proba este spus
la final, ca atare.

## Erori găsite și corectate

### 1. Butonul de backup raporta succes fără să salveze nimic
*Gravitate: mare. Semnalat de tine pe telefon.*

În WebView-ul Android nu există nici `navigator.share` (Web Share API este o
funcție de Chrome, nu de WebView), nici descărcare prin `<a download>`. Codul
cădea deci pe ancoră, care acolo nu face nimic, și afișa „Backupul a fost salvat
în descărcări”. Fișierul nu exista.

Pe nativ scriem acum fișierul cu `@capacitor/filesystem` și îl oferim prin foaia
de partajare a sistemului cu `@capacitor/share`. Întâi folderul public Documente,
verificat cu `stat` — o scriere poate „reuși” fără ca fișierul să existe pe
stocarea restrânsă a Androidului; dacă nu se poate, cache-ul aplicației, care
merge întotdeauna. `FileProvider`-ul aplicației nu expunea decât cache-ul și
external: fără `files-path`, partajarea ar fi crăpat cu „Failed to find
configured root”.

Mesajele spun acum ce s-a întâmplat: partajat, salvat cu calea reală, anulat de
tine, sau eșuat cu motivul plugin-ului. Nu mai există cale prin care butonul să
raporteze succes fără fișier.

### 2. Un registru gol primea 80 din 100 și eticheta „CALM”
*Gravitate: mare. Este primul lucru pe care îl vede un om nou.*

Trei din patru factori luau notă maximă tocmai pentru că nu exista nimic: „toate
plicurile sunt în limite” și „nicio scadență în 7 zile” sunt adevărate fără să
însemne ceva atunci când nu există nici plicuri, nici scadențe. Nota rămânea apoi
aproape neschimbată pe măsură ce intrau date reale, deci arăta decorativă.

Un factor intră acum în scor doar dacă are pe ce se sprijini, ponderile se împart
între cei rămași, iar sub jumătate din pondere cunoscută scorul este `null`:
cadranul arată „—”, iar panoul spune punct cu punct ce lipsește.

### 3. Alarmă falsă de depășire, în fiecare lună
*Gravitate: mare pentru gospodăriile plătite la mijlocul sau finalul lunii.*

Ecranul Analiză compara luni calendaristice, deși aplicația este construită pe
cicluri de salariu. O casă plătită pe 25 vedea „Cheltuielile au depășit
veniturile” de la 1 până la 24 — o alarmă falsă prin construcție, lună de lună.

Când în luna aleasă nu a intrat niciun venit, dar planul spune că salariul vine
mai târziu, spunem asta calm, cu data așteptată. O depășire adevărată, cu venit
încasat în lună, rămâne o depășire și dă alarma ca înainte.

### 4. Un singur rând stricat pierdea tot importul
*Gravitate: mare. Exact drumul care trebuie să fie de neclintit.*

- `parseRomanianAmount` primea `null` sau `undefined` și arunca o excepție. O
  singură mișcare fără câmpul `amount` oprea deci întreaga recuperare a
  backupului, nu doar linia ei.
- `safeDate` verifica doar forma, nu și calendarul: „2026-13-45” trecea și ajungea
  în registru, unde orice calcul cu ea dădea „Invalid Date”.
- Un `null` în mijlocul unei liste devenea o mișcare fantomă „Mișcare — 0 RON”
  în jurnal.

### 5. Ținte de atins sub minimul Android
Filtrele și comutatoarele coborâseră la 29–33px, sub cei 48dp ceruți de Android.

## Îmbunătățiri făcute

**Primul ecran spune de unde începi.** Cel mai vizibil lucru pentru un om care
deschidea aplicația întâia oară era un „0 RON” scris cu litere mari. Cât timp
registrul e gol, cifra lasă locul celor trei pași care fac cifrele să însemne
ceva, fiecare ducând direct acolo unde se face lucrul.

**Numele fișierului de backup conține și ora**, ca două exporturi din aceeași zi
să nu se suprascrie.

**Import prin text lipit**, ca plasă de siguranță dacă selectorul de fișiere al
telefonului nu se deschide.

## Ce am verificat și era deja în regulă

Merită spus, pentru că era îngrijorarea ta principală: **recuperarea unui backup
făcut de o versiune veche funcționează integral.** Un fișier fără `version`, fără
`sourceId` și `memberId`, cu `balance` în loc de `openingBalance` și cu sume
scrise „5.200,50” se restaurează complet: mișcările se leagă de surse și de
membri după nume, soldurile ies la fantă, plicurile își păstrează consumul.
Există acum șapte teste care păzesc asta.

## Ce rămâne de dezvoltat

Ordonat după cât cred că ar folosi, nu după cât e de greu.

1. **Anularea unei ștergeri.** Există liste de „tombstones” pentru sincronizare,
   deci informația e acolo; lipsește doar gestul de „am șters din greșeală”.
2. **Traducerea în engleză a ecranelor adânci.** Mecanismul e pus și funcționează;
   mai lipsesc intrările din dicționar pentru dialogul ghidat al asistentului,
   manual, Plan Studio în detaliu, rapoarte și panourile premium.
3. **Scorul ca poveste, nu ca notă.** Acum că nu mai minte, pasul următor firesc
   este să arate cum s-a mișcat în ultimele cicluri și ce anume l-a mișcat.
4. **Regula de securitate rămasă deschisă din auditul precedent:** oricine
   cunoaște identificatorul camerei poate suprascrie datele de familie în
   Firestore. Propunerile stau în `docs/audit-erori-2026-09-10.md` — o lungime
   minimă impusă parolei și App Check.

## Ce n-am putut proba aici

- **Foaia de partajare Android reală** (Drive, Gmail, Fișiere) și scrierea
  efectivă în folderul Documente. Logica e acoperită de teste pe ambele ramuri,
  dar comportamentul sistemului se vede abia pe telefon.
- **Notificările native.**
- **Widgetul și tile-ul din Setări rapide** — codul Java nu s-a putut compila
  (fără SDK Android, `dl.google.com` blocat de proxy).

## Cifre

228 de teste, toate trecute. `tsc --noEmit` curat. 43 de teste sunt noi față de
începutul acestei analize: 13 pentru scor și alarma falsă, 23 pentru date ostile,
7 pentru recuperarea backupurilor vechi.
