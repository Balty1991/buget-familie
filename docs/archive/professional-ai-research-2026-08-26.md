# Cercetare: analitică profesională și asistent financiar

## Concluzie de produs

Produsele mature de buget familial combină un buget comun, alocări explicite, obiective și sincronizare pe dispozitive; metoda cu plicuri rămâne relevantă deoarece face banii disponibili și scopul fiecărei sume ușor de urmărit.[1] Un asistent util nu este un chat gol: el trebuie să lege cheltuieli, obligații și obiective de o decizie concretă. Experiențele de finanțe conversaționale pun accent pe controlul datelor, întrebări bazate pe context financiar și capacitatea utilizatorului de a întrerupe accesul la date.[2]

## Prioritizare

| Prioritate | Funcție | Implementare actuală | Motiv |
|---|---|---|---|
| P0 | Ritm de cheltuire până la venit | Calcul local din plan, zile rămase și cheltuieli | Oferă răspunsul financiar de zi cu zi |
| P0 | Prognoză de plan | Proiecție explicită din ritmul real, fără promisiuni | Face vizibil riscul înainte de depășire |
| P0 | Decizie următoare | Recomandare explicată + acțiune în aplicație | Reduce efortul de interpretare |
| P1 | Scenarii de impact | Calcul local pentru sumă, categorie și dată | Permite întrebări de tip „dacă plătim acum?” |
| P1 | Reamintiri locale | Datele planului și scadențelor | Menține confidențialitatea și funcționează fără backend |
| P2 | AI conversațional generativ | Backend cu secret, acord și minimizare de date | Nu se introduce în GitHub Pages public fără protecții |

## Garduri de siguranță

Asistentul local poate rezuma datele și calcula scenarii, dar nu oferă consultanță de investiții, credit sau taxe. Orice funcție AI externă trebuie să fie opțională, să dezvăluie exact ce date pleacă din dispozitiv și să permită deconectarea/ștergerea contextului. O cheie de model nu se pune niciodată în clientul public.

## Referințe

[1] [Goodbudget — buget comun și metoda plicurilor](https://goodbudget.com/)

[2] [OpenAI — personal finance experience, controlul datelor și limitele experienței](https://openai.com/index/personal-finance-chatgpt/)
