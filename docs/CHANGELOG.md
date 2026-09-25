# Changelog

## 1.1.96

- Import de extras mult mai deștept: titlul e numele magazinului („Plata la POS non-BT … LIDL DISCOUNT 0123 BUCURESTI RO” → „Lidl”), categoria e cea aleasă data trecută la același magazin, Raiffeisen și antetul real BT recunoscute, rândurile de detalii ING lipite de mișcare, date cu luna în litere, fișiere Windows-1250 (ș, ț).
- Extrase în Excel (.xlsx) și „.xls” care e de fapt HTML, citite pe telefon fără bibliotecă nouă; .xls vechi primește un mesaj clar.
- Abonamente: scumpirile se văd („Netflix: 49,99 → 59,99 RON”), și la scadențele urmărite („Folosește 59,99 RON”); costul lor pe lună și pe an. Benzina și repetițiile întâmplătoare nu mai par abonamente.
- Raportul lunii pentru familie (Analiză → Gospodărie): luna trecută / luna aceasta, unde s-au dus banii față de luna trecută, „Trimite raportul familiei” (text pentru WhatsApp).
- Aceeași formă a sumelor peste tot: „184,50 RON”, nu rotunjit la leu.
- Luna din Analiză se alege în română; butoanele mici au cel puțin 24 px.
- „Există o versiune nouă a aplicației” cu buton Reîncarcă, pe web.
- Android: mementourile nu mai deschid setarea „Alarme și mementouri” pe Android 14; permisiunea de alarme exacte a fost scoasă (Play nu mai cere declarație pentru ea).
- Accesibilitate: zero probleme axe (WCAG 2.2 AA) pe 16 ecrane × 3 teme — etichete și „RON” mai lizibile, nume pentru câmpuri și butoane.
- Performanță (Lighthouse mobil): 87 → 93; sigla ca WebP de 2,4 KB, încărcată o singură dată.
- Versiunea în engleză nu mai are texte rămase în română; ecranul de eroare e mai liniștitor și ascunde detaliile tehnice.
- Plicul care se termină înainte de salariu: Astăzi și Plan spun ziua în care ajunge la zero și cât poți cheltui pe zi ca să țină.
- Obiectivele de economisire spun cât să pui deoparte pe lună (la timp pentru termen sau, fără termen, când ajungi), cu „Pune deoparte”.
- Widget nou pe Android, „Poți cheltui azi”: cifra zilei și zilele până la salariu, cu „+ Notează”. E separat de widgetul rapid (care rămâne fără sume) și spune când cifra nu mai e de azi.
- Funcțiile Firebase pe firebase-admin 14: zero vulnerabilități cunoscute.
- Teste automate noi: fluxurile de bază cap-coadă (notare, plic, rată, ștergere, ciclu, temă) și verificarea contrastului pe bannere și cu opacitate.

## 1.1.95

- Fiecare telefon are o identitate anonimă Firebase (fără cont, fără date personale). Sincronizarea merge și fără ea; regulile de etapa 2 (`firestore.auth.rules`) o vor cere, după ce toți testerii au 1.1.95. Vezi `docs/ANONYMOUS_AUTH.md`.
- Ghidul online și feedbackul numără cererile pe telefon, nu pe IP-ul rețelei mobile.
- „Spune-ne ce nu merge”: formular în aplicație pentru testarea închisă, cu coadă fără internet.
- CSS: 2.934 de `!important` scoase (8.344 → 5.410), fără nicio schimbare de stil calculat pe 154 de ecrane × teme verificate. Vezi `docs/CSS_IMPORTANT_CLEANUP.md`.
- Politica de confidențialitate, pagina de ștergere și răspunsurile Data safety descriu invitația, identitatea anonimă și feedbackul.
- Mișcări: rândul unei mișcări se vede întreg pe telefon (titlul dispărea, coșul acoperea suma); lista începe din primul ecran.
- Astăzi: când plicul săptămânii e gol, „0,00” are explicație și butonul „Pune bani în plic”; ghidul spune aceeași cifră ca Astăzi.
- Plan și Analiză mai aerisite; texte care se tăiau cu „…” se văd întregi; „Intrat / Ieșit” lizibile pe Întunecat și Navy.
- Analiză: „Ciclu salariu” spune ce lipsește și duce la setarea datei salariului.
- Aspect unitar: aceleași carduri, titluri și etichete pe toate ecranele; 1.685 de reguli CSS moarte scoase (CSS 1.153 → 927 KB).
- Ghidul online nu mai așteaptă un minut după un Gemini lent: trece la rezervă în cel mult ~33 s.
- Aspect: „Comută automat zi/noapte” nu mai e oprit tăcut de butonul „Aplică” (noaptea rămâneai pe Alb); butonul spune ce face, iar tema se schimbă singură la oră și cu aplicația deschisă.
- Test automat nou pentru interfață (11 ecrane × 3 teme × 2 lățimi: layout și contrast).

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
