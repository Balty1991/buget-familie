# Export CSV, reguli de venit, grafic și redesign

## Principiul comun

Cele patru extensii folosesc aceeași sursă de adevăr: registrul financiar local. Nici exportul, nici graficul și nici regulile de plicuri nu cer o integrare bancară, nu rulează în fundal și nu creează date demonstrative.

| Funcție | Ce face | Ce nu face |
| --- | --- | --- |
| CSV Jurnal | Descarcă local exact mișcările vizibile după filtrele active, cu antet UTF-8 și delimitare sigură pentru foi de calcul. | Nu trimite date în rețea și nu schimbă registrul. |
| Reguli de venit | Aplică, după previzualizare și confirmare, sume sau procente către plicuri compatibile cu sursa și membrul venitului. | Nu mută bani între carduri/cash și nu creează ori editează tranzacții. |
| Grafic lunar | Arată proporția reală a categoriilor de cheltuieli pentru luna și perspectiva aleasă. | Nu estimează sau completează categorii fără tranzacții. |
| Ledger Flow | Reorganizează ecranele ca suprafețe de decizie, rânduri de registru și navigație mobilă plutitoare. | Nu schimbă calculele financiare sau structura datelor introduse. |

## Controlul regulilor

O regulă devine eligibilă numai când plicul acceptă sursa venitului și, dacă plicul este personal, același membru. Aplicarea se înscrie într-un jurnal de planificare pentru a preveni dublarea. Anularea scade numai limita crescută de acea aplicare și păstrează neschimbate tranzacția, soldul sursei și istoricul financiar.

> O repartizare este o decizie de plan, nu o plată bancară.

## Validare tehnică

Acoperirea automată include exportul cu caractere și ghilimele sigure, agregarea mai multor reguli către același plic, protecția împotriva aplicării duble și anularea exactă a limitelor adăugate. Interfața a fost verificată vizual pe mobil pentru reflow-ul Instrumentelor, ecranul principal și selectorul de teme după redesign.

Verificarea manuală a Jurnalului a afișat butonul de export cu numărul corect de rânduri active și a declanșat descărcarea locală pentru cele patru mișcări vizibile. Nu a fost creată, editată sau ștearsă nicio tranzacție în timpul exportului.

Istoricul de descărcări al browserului a confirmat fișierul `jurnal-toate-prezent.csv`, generat din previzualizarea locală a aplicației.

Analiza lunii august a afișat distribuția din registrul real: Alimente 1.283 RON (87%), Transport 120 RON (8%) și Casă & facturi 75 RON (5%). Selectorul de categorie, inelul de proporții și rândurile cu valori exacte au fost disponibile în aceeași perspectivă, fără estimări sau categorii artificiale.
