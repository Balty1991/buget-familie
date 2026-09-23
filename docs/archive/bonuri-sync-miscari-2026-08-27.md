# Bonuri, sincronizare și Mișcări — 27 august 2026

## Decizia de stocare

Fotografiile bonurilor nu mai sunt păstrate în `localStorage`. După comprimare și, opțional, citire OCR, acestea sunt convertite în bloburi și scrise local în IndexedDB. În registrul financiar rămân numai cel mult două chei de fotografie. Astfel, sincronizarea familiei și stocarea de date financiare nu sunt încărcate cu imagini mari.

La prima deschidere după actualizare, bonurile vechi cu imagini base64 sunt mutate defensiv. Copia veche se păstrează până la confirmarea scrierii în IndexedDB; la eroare, nu se șterge nimic și aplicația comunică problema în Bonuri. Ștergerea unui bon sau resetarea locală cere și eliminarea bloburilor asociate.

## Sincronizare prudentă

| Situație | Comportament |
|---|---|
| Eroare temporară sau limitare de rată | Aplicația reîncearcă de maximum două ori cu pauză scurtă, numai cât sesiunea este deschisă. |
| Conflict SHA la salvare | Citește versiunea nouă, face merge cu registrul local și încearcă din nou o dată. |
| Conflict repetat | Oprește salvarea și cere verificarea planului înainte de o nouă acțiune manuală. |
| Fotografie bon | Rămâne pe telefon; nici blobul și nici cheia IndexedDB nu sunt criptate ori încărcate în repo-ul privat. |

> Aceasta nu este sincronizare real-time și nu rulează în fundal. Este o copie criptată, periodică, activă numai cât aplicația este deschisă.

## Mișcări pe telefon

Ecranul începe cu data, numărul de mișcări, totalul intrărilor și al ieșirilor zilei. Cronologia grupată este componenta principală. Căutarea rapidă și tipul de mișcare rămân vizibile; intervalul, sursa, membrul, exportul CSV și filtrele salvate se află în foaia „Filtre”. Fără date, ecranul păstrează o foaie liniată de registru și o singură acțiune: adăugarea primei mișcări.
