# Familie conectată — specificație de sincronizare

## Ce oferă această variantă

Fiecare telefon al familiei folosește același repo GitHub privat de date și aceeași parolă de criptare. Pachetul salvat acolo rămâne AES-GCM criptat; repo-ul public al aplicației nu conține datele familiei. Când un membru activează sesiunea de familie, aplicația verifică pachetul remote la intervale scurte și poate trimite modificările locale fără reintroducerea tokenului în acea sesiune.

> Aceasta este sincronizare apropiată de timp real prin verificare periodică, nu un canal WebSocket permanent. Viteza depinde de conexiunea dispozitivului și de disponibilitatea API-ului GitHub.

| Decizie | Protecție |
|---|---|
| Token GitHub | Rămâne doar în memoria tabului/aplicației. După închidere, conectarea se face din nou. Fiecare membru poate avea propriul token limitat la repo-ul privat. |
| Parola familiei | Nu se trimite la GitHub și nu se persistă în aplicație. Este folosită numai local pentru derivarea cheii AES-GCM. |
| Modificări locale | Intrările au identificatori stabili; la actualizare se face merge defensiv pe ID, nu simplă suprascriere. |
| Conflicte | Dacă aceeași intrare este modificată pe două dispozitive, aplicația oprește încărcarea și cere reîncărcare/revizuire, nu alege tăcut o versiune. |
| Imagini bon | Rămân locale pentru a evita pachete mari și ca fotografiile să nu fie încărcate automat în repo. |
| Alertă automată | Sesiunea indică starea, ultima verificare și eventualul conflict. Nu promite actualizare instantanee când aplicația este închisă. |

## Cum se conectează o familie

Administratorul creează repo-ul privat `buget-familie-date`, generează câte un fine-grained token GitHub cu **Contents: Read and write** doar pe acel repo și stabilește o parolă lungă, comunicată în afara aplicației. Pe fiecare telefon, membrul deschide **Mai mult → Sincronizare**, introduce propriul token și aceeași parolă, descarcă copia inițială, apoi activează sesiunea de familie. Nici tokenul, nici parola nu trebuie trimise în mesaje sau capturi de ecran.

## Baza tehnică verificată

GitHub Contents API actualizează un fișier existent numai cu SHA-ul curent; un SHA vechi produce conflict (409/422), deci aplicația îl folosește ca blocaj optimist pentru a evita suprascrierea tăcută. GitHub recomandă tokenuri fine-grained, care pot fi limitate la un singur proprietar, repo selectat și permisiunea `Contents`. [1] [2]

[1]: https://docs.github.com/en/rest/repos/contents "GitHub Docs — Repository Contents API"
[2]: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens "GitHub Docs — Managing personal access tokens"
