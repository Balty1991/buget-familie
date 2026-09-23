# OCR pe produse și temă întunecată

## OCR local, cu confirmare umană

Procesarea rămâne în browser, prin Tesseract.js. Pentru fiecare linie recunoscută cu un preț final, aplicația va propune un produs, un preț și o categorie sugerată. Propunerile nu se salvează automat: familia poate modifica sau elimina orice linie, iar suma liniilor trebuie să fie egală cu totalul bonului. Liniile cu cuvinte precum `TOTAL`, `TVA`, `REST`, `CARD`, `NUMERAR` sau fără descriere de produs sunt excluse din repartizarea automată.

Bonurile pot avea formate comerciale diferite; astfel, OCR-ul este un ajutor de introducere, nu o dovadă contabilă. Dacă totalul citit sau suma liniilor diferă, aplicația va păstra formularul editabil și va cere corectare explicită înainte de salvare.

## Accesibilitate dark mode

În tema întunecată, toate cardurile de instrumente trebuie să aibă fundal verde închis distinct de fundalul paginii, text principal aproape alb și text secundar verde-gri deschis, cu contrast vizibil. Bara de instrumente rămâne scrollabilă pe orizontală, iar conținutul începe sub bara sticky, fără titluri acoperite. Cardurile păstrează accentele galbene doar pentru semnale și pictograme; acestea nu sunt folosite ca text cu contrast scăzut.
