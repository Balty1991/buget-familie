# Changelog

## 1.1.95

- Fiecare telefon are o identitate anonimă Firebase (fără cont, fără date personale). Sincronizarea merge și fără ea; regulile de etapa 2 (`firestore.auth.rules`) o vor cere, după ce toți testerii au 1.1.95. Vezi `docs/ANONYMOUS_AUTH.md`.
- Ghidul online și feedbackul numără cererile pe telefon, nu pe IP-ul rețelei mobile.
- „Spune-ne ce nu merge”: formular în aplicație pentru testarea închisă, cu coadă fără internet.
- CSS: 2.934 de `!important` scoase (8.344 → 5.410), fără nicio schimbare de stil calculat pe 154 de ecrane × teme verificate. Vezi `docs/CSS_IMPORTANT_CLEANUP.md`.
- Politica de confidențialitate, pagina de ștergere și răspunsurile Data safety descriu invitația, identitatea anonimă și feedbackul.

## 1.1.94

Corecturile din testarea cu utilizatori (24.09.2026).

- Ratele la datorii dinainte de salariu se scad din „Poți folosi azi”, din Plan și din răspunsul ghidului.
- Fiecare telefon notează pe membrul lui („Cine ești pe acest telefon?”); sincronizarea se reia singură la redeschidere, iar pe Astăzi apare un semn când e oprită.
- Camera familiei are ID și cheie aleatoare; partenerul intră cu invitație. Camerele vechi, cu parolă, se pot muta pe invitație.
- O singură regulă pentru cifra zilei; după cumpărăturile săptămânii scrie „De mâine: X lei/zi”, nu „0 pe zi”.
- Planul de familie nu mai pornește „peste limită”; plicurile propuse încap în banii scriși.
- Datoriile au dobândă, ordine de plată (avalanșă / minge de zăpadă), data în care scapi de ele și alertă cu 3 zile înainte de rată.
- Venit neregulat: „vreau ca banii să-mi ajungă N zile”; încasări în EUR/USD/GBP.
- Scadențe trimestriale și anuale, sume variabile confirmate la plată; o scadență din categoria unui plic nu mai e rezervată de două ori.
- „Notat · Anulează” după o mișcare nouă; confirmările folosesc dialogul aplicației.
- „Azi” se socotește în fusul orar al familiei; datele se completează cu puncte; sumele „1e5” sau „1,500.50” sunt citite corect.
- Mod simplu oferit în onboarding; text lizibil pe cardul „Scadențe controlate”; „Înapoi” din Scadențe duce în Obligații.
- Abonamentul Familia: cumpărare, verificare pe server, restaurare și notificări Play — pregătite, pornite când `BILLING_LIVE = true`.

## 1.1.93

- Importul nefolosit care oprea publicarea (1.1.91 și 1.1.92) a ieșit, deci site-ul poate pleca de pe 1.1.90.
- Ghidul, la „cât pot cheltui azi”, spune cifra mare de pe Astăzi. „Nerepartizat” e aceeași sumă ca în Plan, nu o prognoză de ritm.

## 1.1.92

- Zilele unei tranșe nu se mai scurtează cu o zi când perioada trece peste ora de vară (Auckland, și România la sfârșit de octombrie).
- CI rulează testele și pe fusul `Pacific/Auckland`.
- Numărul de `!important` nu mai are voie să crească peste 8.344.
- Pluginurile de șablon Manus au ieșit din `vite.config.ts`.
- Notele vechi de cercetare stau în [archive/](archive/).

## 1.1.91

- Cele șase texte „Pregătim…” au traducere, deci publicarea pe site nu se mai oprește.
- Banda de zile urmează tranșa (de exemplu miercuri–marți), iar textul spune ziua reală de sfârșit.
- Cifrele de pe Astăzi păstrează banii, nu se mai rotunjesc la leu.

## 1.1.90

- Pe Android, aplicația nu mai ține o a doua copie în cache-ul WebView. Registrul, pozele de bon și sincronizarea rămân.

## 1.1.89

- „Mai mult” nu mai descarcă Setările și Sync până nu le deschizi.
