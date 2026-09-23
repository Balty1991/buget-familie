# Control șabloane, interval Jurnal și alerte de plic

## Reguli de funcționare

| Funcție | Comportament | Efect asupra datelor financiare |
|---|---|---|
| Editare șablon | Refolosește câmpurile de captură rapidă pentru nume, sumă, categorie, membru și sursă. | Schimbă numai preferința locală; nu schimbă tranzacțiile istorice. |
| Ștergere șablon | Cere confirmare și elimină numai șablonul identificat. | Nu șterge mișcări, plicuri sau informații ale familiei. |
| Interval Jurnal | Filtrează local după datele de început și final, cumulativ cu filtrele existente. | Nu mută, nu modifică și nu exportă intrările. |
| Alertă plic | Este o bandă vizuală permanentă cât timp plicul rămâne la 80% sau este depășit. | Nu trimite bani, nu schimbă limita și nu rulează în fundal. |

## Limite asumate

Șabloanele sunt deliberate preferințe **strict locale**: nu intră în pachetul de familie criptat. Alertele sunt în aplicație, nu notificări de sistem; astfel funcționează fără solicitarea permisiunii telefonului și fără pretenția de execuție când aplicația este închisă. Filtrul de date compară datele ISO ale registrului și permite golirea separată a oricărui filtru.
