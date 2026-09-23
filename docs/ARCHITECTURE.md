# Arhitectură

Aplicația e locală. Registrul stă pe telefon (`AppData` în [client/src/lib/finance-data.ts](../client/src/lib/finance-data.ts)). Sincronizarea de familie criptează pachetul înainte de Firestore; ID-ul camerei rămâne SHA-256 al parolei, ca să nu se piardă camerele deja deschise.

## Ecrane

[Home.tsx](../client/src/pages/Home.tsx) e singurul scriitor: persistă, ține undo și sync. Astăzi e în primul ecran. Obligații, Plan, Analiză, formularul de mișcare și restul se încarcă la cerere, fiecare în fișierul lui. „Mai mult” își încarcă Setările, Sync și bonurile doar când se deschid.

Cifra mare, textul de sub ea și banda de zile vin din același rezumat ([today-summary.ts](../client/src/lib/today-summary.ts)). Banda urmează tranșa de 7 zile a plicului, nu săptămâna de luni.

## Zile

Datele din registru sunt civile (`YYYY-MM-DD`). „Azi” e ziua telefonului. Distanța dintre două date civile se socotește la amiază UTC ([calendar-budget.ts](../client/src/lib/calendar-budget.ts)), ca ora de vară să nu scadă o zi din tranșă.

## Ce nu se sincronizează

Pozele de bon, regulile de magazin învățate, șabloanele rapide și cursul valutar rămân pe telefon. Ecranul de Sync spune asta explicit.
