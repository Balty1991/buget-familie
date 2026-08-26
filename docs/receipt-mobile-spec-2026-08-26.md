# Bonuri mobile — specificație funcțională

Un bon poate avea **maximum două imagini**. Fiecare fișier brut poate avea până la 12 MB înainte de procesare; aplicația îl redimensionează în browser la cel mult 1.600 px și îl encodează JPEG pentru a păstra aproximativ 600 KB per imagine. Dacă dispozitivul nu poate procesa imaginea, aceasta nu este salvată și utilizatorul primește un mesaj clar.

| Cerință | Decizie |
|---|---|
| Bon lung | Două fotografii, cu previzualizare și posibilitate de eliminare înainte de salvare. |
| Spațiu local | Imaginile rămân locale și sunt excluse din copia criptată GitHub; datele și liniile bonului se sincronizează. |
| Mai multe categorii | Un bon poate avea una sau mai multe linii categorie–sumă. Totalul liniilor trebuie să fie egal cu totalul bonului înainte de salvare. |
| Registru financiar | Fiecare linie creează o cheltuială reală, toate legate stabil de același bon. |
| Citire imagine | OCR local, la cererea utilizatorului; propune total, dată și text, dar utilizatorul confirmă/corectează înainte de salvare. |
| Confidențialitate | Nu se trimite automat poza bonului către un serviciu extern. |

OCR nu va pretinde recunoaștere perfectă. Un total, o dată sau produse extrase incorect sunt propuneri editabile, iar salvarea rămâne condiționată de validarea totalului repartizat.
