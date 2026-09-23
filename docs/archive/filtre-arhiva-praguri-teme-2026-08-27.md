# Filtre salvate, arhivă, praguri și teme

## Reguli locale de date

| Element | Persistență | Efect asupra registrelor |
|---|---|---|
| Filtru salvat | Preferință locală, cu nume și criterii de căutare/date. | Nu schimbă și nu sincronizează tranzacții. |
| Arhivă șabloane | Copie locală a unui șablon, etichetată cu luna arhivării. | Nu afectează mișcări, plicuri sau familia. |
| Prag plic | Număr între 50% și 95% pe plic; 100% rămâne depășire. | Schimbă doar momentul semnalului vizual. |

## Direcții tematice

Temele păstrează aceeași semantică financiară: **verde** pentru disponibil/progres, **miere** pentru alocare/revizuire și **coral** pentru atenție/datorii. Ele diferă prin material, lumină și contrast, nu prin sensul banilor.

| Temă | Direcție modernă | Material dominant |
|---|---|---|
| Ivory Ledger | hârtie minerală luminoasă și verde petrol | suprafețe lapte, linii reci |
| Forest Night | verde ardezie adânc, cu accent mentă | panouri nocturne mate |
| Black–Blue | bleumarin de observator și cyan electric moderat | suprafețe grafit cu muchii albastre |
| Ink–Copper | cerneală brună și cupru cald | suprafețe cărbune cu reflexe discrete |

Nicio temă nu folosește text luminos pe fundal luminos sau acțiuni care depind numai de culoare. Controalele active au suprafață opacă, contrast ridicat și indicator de stare.

## Implementare și verificare

Filtrele se păstrează strict local, cu maximum opt intrări și validare pentru intervalul de date. Arhiva acceptă maximum 60 de șabloane, este grupată după luna marcajului `archivedAt`, iar restaurarea înlocuiește în mod predictibil un șablon activ cu același nume. Pragurile sunt normalizate în intervalul 50%–95%, cu 80% ca valoare implicită; calculul de depășire rămâne independent la 100%.

Validarea a inclus verificarea TypeScript, 29 de teste Vitest, buildul de producție, controlul `git diff --check` și parcurgerea mobilă a Jurnalului, Planului și temei întunecate. Testele acoperă migrarea filtrelor și arhivei, pragurile implicite și limitate, plus semnalarea la un prag personalizat de 70%.
