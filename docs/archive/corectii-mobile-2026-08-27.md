# Corecții mobile observate în utilizare

## Probleme confirmate

| Zonă | Problemă vizibilă | Efect asupra utilizatorului | Corecție aplicată în această iterație |
|---|---|---|---|
| Plan | Trei totaluri mari erau așezate într-un singur rând și depășeau ecranul de aproximativ 360 px. | Valoarea era tăiată și nu putea fi verificată. | Totalurile devin fișe verticale sau o bandă orizontală cu snap; fiecare sumă păstrează o lățime proprie, trunchiere sigură și acces la valoarea completă. |
| Instrumente | Filele și grila albastră concurau pentru atenție; o parte a meniului ieșea din ecran fără un indiciu tactil. | Utilizatorul nu înțelegea ce se poate derula și ce este acțiune. | Filele devin o bandă cu swipe lateral, `scroll-snap`, gradient de capăt și indicator de poziție; rezumatul devine o listă, nu o grilă de carduri. |
| Înregistrare | Formularul complet cere prea mult timp pentru o cheltuială cotidiană. | Mișcările mici pot rămâne neînregistrate. | O foaie de introducere rapidă cere doar sumă, categorie, sursă și confirmare; restul este precompletat și poate fi corectat în Jurnal. |
| Navigație | Comutarea între ecrane era instantanee și nu oferea continuitate, iar bara de jos putea concura cu conținutul. | Utilizatorul pierde contextul când trece între Plan și Analiză. | Tranziție discretă, doar de opacitate/translație, sub 220 ms; zona de conținut păstrează spațiu sigur deasupra barei. |

## Limite de produs respectate

Corecțiile nu modifică modelul financiar, plicurile, ratele, sursele, membrii, datele locale sau sincronizarea criptată. Introducerea rapidă va crea aceeași tranzacție reală ca formularul complet; ea nu inițiază plăți și nu presupune conexiune bancară.

## Criterii pentru finalizarea iterației

Nicio valoare monetară nu trebuie tăiată la 360 px. O bandă cu categorii orizontale trebuie să permită swipe, să afișeze începutul/opțiunile următoare și să permită selectarea prin atingere. O cheltuială rapidă trebuie să poată fi salvată fără câmpuri obligatorii suplimentare față de sumă, categorie și sursă. Toate tranzițiile trebuie oprite pentru `prefers-reduced-motion`.

## Repere pentru auditul următor

Principiul de afișare graduală păstrează funcțiile esențiale în ecranul principal și deschide opțiunile avansate numai la cerere; sursa subliniază că aceasta reduce aglomerarea și erorile, însă acțiunile frecvente nu trebuie ascunse în meniuri adânci [1]. Pentru mobil, W3C evidențiază reflow, dimensiunea minimă a țintelor, gesturile cu un singur indicator și navigația consecventă ca aspecte relevante ale WCAG 2.2 [2].

Pentru următoarea dezvoltare, prioritățile funcționale propuse sunt un câmp opțional de șablon pentru cheltuieli repetate, căutare locală în jurnal și o recapitulare săptămânală calculată exclusiv din datele introduse. Acestea sunt propuneri de produs, nu funcții încă active.

## Referințe

[1] [Interaction Design Foundation — Progressive Disclosure](https://ixdf.org/literature/topics/progressive-disclosure)

[2] [W3C — Guidance on Applying WCAG 2.2 to Mobile Applications](https://www.w3.org/TR/wcag2mobile-22/)

## Reauditare pe scenarii reale

| Perspectivă | Traseu verificat | Rezultat după corecții | Următoarea îmbunătățire propusă |
|---|---|---|---|
| Persoană singură | Adaugă o cheltuială zilnică din Astăzi. | Foaia rapidă cere sumă, categorie, sursă și confirmare; tranzacția salvată rămâne aceeași intrare reală din Jurnal. | Șabloane locale pentru cafenea, taxi sau cumpărături frecvente. |
| Familie | Verifică sursa la înregistrarea rapidă și deschide Planul. | Sursele sunt filtrate pentru membrul selectat; plicurile și datele planului rămân în fluxul complet. | Recapitulare săptămânală pe membru și familie, fără transferuri bancare. |
| Utilizator grăbit | Deschide Instrumente și caută o categorie rară. | Banda cu file are swipe lateral, semnal explicit și păstrează atingerea ca alternativă. | Căutare locală pentru mișcări și instrumente. |
| Verificare de cifre | Compară totalurile Planului pe telefon. | Cele trei valori sunt așezate pe rânduri separate, cu sumă întreagă și etichetă scurtă. | Indicator de prag săptămânal într-o recapitulare compactă. |
| Contrast ridicat | Utilizează tema întunecată și acțiunile principale. | Stările active și acțiunile au suprafețe ferme, iar controalele frecvente au minimum 40–44 px în spațiul mobil. | Preferință separată pentru contrast mărit, peste temele actuale. |

Verificarea actuală a confirmat lipsa depășirii orizontale pe pagina principală, accesul la fila de Instrumente prin gest lateral și încărcarea pe module pentru Plan, Analiză, asistent, scadențe și exportul PDF. Testele automate financiare au rămas verzi: **25 din 25**. Bundle-ul principal este încă aproximativ 675 KB minificat; deși componentele grele sunt separate, următoarea optimizare tehnică trebuie să extragă modulele utilitare rămase din ecranul principal.
