# Changelog

## 1.1.140

Planificare (Mai mult → Planificare), patru unelte noi:
- **Planul pe 12 luni**: lună cu lună, de la banii de azi — venitul din plan, traiul obișnuit (media ultimelor luni, fără facturi și rate), facturile care se repetă (lunar, trimestrial, anual, fiecare în luna ei), ratele cu dobândă până la ultima, obiectivele până se ating și evenimentele din calendar. Grafic cu barele lunii și linia banilor; luna în care banii nu mai ajung, scrisă sus. Scenarii „ce-ar fi dacă”: pierd un venit (câteva luni), o cheltuială lunară nouă, o cheltuială mare o dată, un credit nou — cu linia de dinainte, punctată, pentru comparație. Fiecare lună se desface pe venit, trai, facturi, rate, obiective, evenimente și scenarii.
- **Averea familiei**: banii din toate sursele plus bunurile trecute de mână (locuință, mașină, investiții), minus datoriile. Istoricul pe 12 luni e refăcut din mișcările deja notate, cu „+X față de acum un an”. Bunurile se sincronizează cu familia.
- **Ieșirea din datorii**: suma în plus pe lună, avalanșa față de bulgărele de zăpadă, data în care sunteți liberi, luni câștigate și dobânda economisită față de „doar rata”, ordinea datoriilor și calendarul plăților pe 6 luni.
- **Raportul lunii**: la început de lună (și card pe Astăzi în primele 7 zile), luna trecută — intrat, ieșit, rămas, rata de economisire, categoriile față de media celor 3 luni dinainte, ce a mers, ce e de urmărit și cel mult trei recomandări cu sume (o limită realistă, cât să mutați în fondul de urgență, un plic de coborât, abonamentele). „Închide luna” îl trece în istoric. Luni urmărite doar parțial sunt marcate ca orientative.
- „Ce e nou” arată planificarea.

## 1.1.139

Mai profesional:
- Astăzi, „Ultimele mișcări”: cheltuielile sunt negre, nu roșii — ca în Mișcări. Roșul rămâne doar pentru ce e depășit.
- Antetele de pagină (de ex. „Mai mult”) nu mai au cercul decorativ albăstrui; Obligații nu mai are o pată roșiatică în colț.
- Jos în Mai mult: versiunea aplicației, Confidențialitate, Termeni și Suport, ca în aplicațiile serioase.
- Versiunea internă (`APP_VERSION_CODE`) rămăsese la 124; acum e la zi, iar un test nou verifică la fiecare versiune că aplicația, package.json și build.gradle spun același lucru.
- Bulele zilelor din Astăzi arată sumele în formatul aplicației.

## 1.1.138

Mai frumos, fără funcții noi:
- Bara de sus în tema Alb: căutarea, meniul și asistentul sunt pictograme curate, fără chenar și umbră, ca în tema Întunecat.
- Astăzi: dispare golul de sub cifra zilei (rămăsese locul butonului „Notează”, care pe telefon stă în bara de jos).
- Toate linkurile („Detalii”, „Adaugă notiță…”, „Toate mișcările”) sunt în verdele aplicației, nu în albastru; „+ Adaugă notiță” stă pe un singur rând.
- Plicuri: „Fixe / Variabile / Economii” sunt etichete mici, ca restul titlurilor de secțiune, nu titluri mari gri.
- Mișcări: „Toate / Comune / Personale” are același stil liniștit ca „Toate / Ieșiri / Intrări”.
- Alertele de plic („Se termină înainte de salariu”) și „Provocarea lunii” au titlul mic și colorat, cum fusese gândit (o regulă globală pentru paragrafe le mărea).
- „Îmi permit…?” nu mai are săgeata de meniu; săgeata rămâne doar la butoanele care chiar se desfac.

## 1.1.137

Verificare generală după valurile 1.1.132–1.1.136:
- Viteză: asistentul de sfârșit de lună (și fișierul lui) se încarcă doar în ultimele 5 zile dinainte de salariu. Pornirea până la cifra zilei, pe un telefon lent simulat (CPU ×4): ~0,95 s, cât era înainte de valuri (~0,98 s). Pachetul principal: +8,5 KB față de 1.1.131.
- Notează în vacanță: o plată din șablon (chiria, rata) nu mai intră din oficiu în bugetul vacanței.
- Fondul de urgență nu mai ia drept fond un obiectiv cu „rezervare” în nume.
- Intrarea animată de pe Astăzi apare o dată pe zi, nu la fiecare repornire a aplicației.
- Butoane mai ușor de atins: „Ascunde alerta” pe ecrane înguste și sumele recente din Notează pe ecran lat.
- Toate ecranele verificate la 320, 390, 768 și 1280 px, în temele Alb, Întunecat și Navy, în română și engleză.

## 1.1.136

- Astăzi, pornire nouă: „Bună dimineața, Andrei” (după oră și pe numele de pe telefon) și fraza zilei, aleasă din ce contează azi — salariul de azi, vacanța în curs, ultimele zile dinainte de salariu, seria de notat, cum a fost ieri față de o zi obișnuită; altfel, un sfat scurt care se schimbă zilnic.
- La prima deschidere din zi, cardurile intră pe rând și cifra zilei urcă de la 0 (fără animație cu „mișcare redusă”).
- Scrisoare pentru viitor: în formularul obiectivului, un mesaj pentru voi, care rămâne ascuns până când atingeți ținta și apare atunci în felicitare.
- „Ce e nou” arată noutățile, cu scrisoarea și salutul în față.
- Plafonul CSS: 951 KB (+1 KB, salutul și intrarea animată).

## 1.1.135

- „Îmi permit…?” (pe Astăzi, lângă cifra zilei): scrii suma și răspunsul se schimbă pe loc — verde „Da”, galben „încape, dar strâmt”, roșu „nu acum, ar lipsi X”. Poți alege plicul (se socotește tranșa săptămânii) sau banii liberi; arată și câte săptămâni de economii pentru primul obiectiv ar însemna suma. „Am cumpărat — notează” deschide Notează.
- Viitorul banilor (Obiective): un glisor „cât puneți deoparte pe lună” și curba economiilor pe 3 ani, cu steaguri în luna în care se atinge fiecare obiectiv (întâi cele cu termen) și cât mai devreme ați ajunge cu 100 de lei în plus.
- „Ce e nou” arată noutățile ultimelor trei versiuni.

## 1.1.134

- Banii mărunți (Analiză): sumele mici care se repetă (cafeaua, covrigii) din ultimele 30 de zile, de câte ori și cât fac pe un an, cu cât ar însemna jumătate pentru primul obiectiv.
- Obiectiv atins: când un obiectiv de economisire ajunge la țintă, apare o felicitare cu confetti (fără animație dacă telefonul cere mișcare redusă) și „Spune familiei”. O singură dată pe obiectiv; obiectivele deja atinse la actualizare nu sunt felicitate din nou.
- Notificare cu 5 zile înainte de salariu, seara: ce mai e de plătit și unde pot merge banii care rămân (se oprește din Setări, la „Rezumate”).
- În Mișcări, cheltuielile din vacanță au „✈ numele vacanței” lângă categorie.
- Familia exemplu are câteva cafele și covrigi, ca „Banii mărunți” să se vadă din prima.

## 1.1.133

- Mod vacanță (Mai mult → Vacanță): o călătorie cu bugetul ei, cu prima și ultima zi și, opțional, o monedă (EUR, BGN…) în care se arată ce a rămas. Cât ține, Notează pune cheltuielile în bugetul vacanței, nu în plicurile lunii (chipul „Din bugetul vacanței” le poate scoate). Pe Astăzi: cât mai e și pe zi; la final, rezumatul. Se sincronizează cu familia.
- Coșul estimat: lista de cumpărături arată cât va costa, după prețurile de pe bonurile voastre din ultimele 120 de zile, unde a fost mai ieftin fiecare produs și magazinul în care tot coșul iese mai ieftin.
- Fond de urgență (Obligații): câte luni ați rezista fără venit, ținta de 3 luni de cheltuieli și cât să puneți deoparte lunar; „Începe fondul de urgență” creează obiectivul.
- Asistentul de sfârșit de lună: cu 5 zile înainte de salariu, Astăzi arată ce mai e de plătit, cât mai e în plicuri și pe zi și propune ca jumătate din ce va rămâne să meargă în fondul de urgență sau în primul obiectiv.
- Familia exemplu are acum bonuri cu produse și o listă de cumpărături. Butoanele bonurilor fără fotografie au nume pentru cititoarele de ecran; două texte din Prețuri sunt traduse în engleză.

## 1.1.132

- Scurtături pe iconiță: ții apăsat pe iconița aplicației → „Notează o cheltuială”, „Spune ce ai cumpărat”, „Lista de cumpărături”.
- Harta lunii în Mișcări: fiecare zi a lunii colorată după cât s-a cheltuit; atingi o zi și vezi doar mișcările ei.
- Textul mărit din setările telefonului se vede și în aplicație (între 85% și 130%, ca nimic să nu iasă din ecran). Butoanele mici (obiective, catalog) au acum cel puțin 40 px.
- „Ce e nou” arată noutățile ultimelor versiuni: voce, lista de cumpărături, widget, abonamente, PDF, pușculița copilului.

## 1.1.131

- Abonamente (Obligații): cât costă pe lună și pe an toate plățile care se repetă, ce s-a scumpit și abonamentele găsite în mișcări, cu „Adaugă” sau „Nu e abonament”.
- Raportul lunar PDF refăcut: cu diacritice, în limba aplicației, cu intrat / ieșit / rămas, inelul categoriilor față de luna trecută, plicurile ciclului, abonamentele și mișcările lunii. Exportul CSV are antetul în limba aplicației.
- Pușculița copilului: pe telefonul copilului, un obiectiv cu desen, un borcan care se umple și „+5 / +10 / +20 lei”.

## 1.1.130

- Verificare înainte de lansare: toate ecranele și instrumentele, în română și engleză, cu familia exemplu și fără date, pe telefoane mici, normale și tablete — fără erori și fără ecrane care ies din lățime.
- În engleză: Aspectul (teme și fundaluri), familia exemplu și câteva nume de categorii rămăseseră în română; acum sunt traduse.
- `docs/TEST-PE-TELEFON.md`: lista de verificat pe un telefon real (voce, widgeturi, notificări, lista de cumpărături pe două telefoane).

## 1.1.129

- Lista de cumpărături a familiei (Mai mult → Cumpărături, și pe Astăzi când are produse): mai multe deodată, prin virgulă; bifă în magazin; „Am terminat — notează plata” scoate ce s-a luat și deschide Notează pe Alimente. Se sincronizează cu partenerul.
- Tabletă și ecran lat (de la 900 px): pe Astăzi, cifra zilei stă în stânga, iar alertele, plicurile și mișcările în dreapta.
- Capturi Play noi (telefon RO/EN, tabletă RO): notarea din voce, lista de cumpărături, „Anul vostru”, pulsul lunii în Mișcări.

## 1.1.128

- Obligații: sus, cât e de plătit în următoarele 30 de zile și o bandă cu scadențele (întârzierile marcate); la fiecare datorie, luna în care scapi de ea; obiectivele au un cerc de progres; ghidul a coborât la final.
- Notificări pe tipuri, din Setări → Mementouri: scadențe, plicuri și ritm, venit, obiective, bilanțuri, amintirea de seară — fiecare se poate opri. Ora amintirii de seară se alege (18–22). Cu o serie de 3+ zile notate, amintirea spune „Nu pierde seria”.
- Setări: căutare („backup”, „card”, „notificări”) și grupuri cu o descriere scurtă; limba, modul simplu și doar offline stau într-un grup.

## 1.1.127

- Notare din voce: în Notează, „Spune ce ai cumpărat” — „cincizeci de lei la Lidl” completează suma, magazinul, categoria și plicul; omul verifică și apasă Gata. Pe Android prin recunoașterea vocală a telefonului, fără permisiunea microfonului.
- „Anul vostru”: retrospectiva anului ca poveste (zile notate, seria, unde s-au dus banii, magazinul de bază, cea mai bună lună, zile fără cheltuieli) și o imagine de trimis, implicit fără sume. În Analiză → Gospodărie și, din decembrie până în ianuarie, pe Astăzi.
- Mișcări: pulsul lunii (cât a ieșit, bară pe categorii, față de luna trecută până azi); categoriile filtrează lista; zilele se citesc „Ieri”, „Miercuri, 30 septembrie”.
- Notează: plicul și o bară cu ce rămâne după plată stau imediat sub categorie; categoriile proprii folosite recent intră în șirul de butoane.
- CSS: selectorii temei retrase „ink” simplificați (fără schimbare vizuală).

## 1.1.126

- Plicuri, refăcute: sus, o bară colorată cu împărțirea banilor pe plicuri și primele patru procente; fiecare plic are inelul lui de progres cu iconița categoriei; importul de plan a coborât sub listă.
- Analiză: diagrama cu categoriile e prima; controlul de perioadă stă pe două coloane pe telefon.
- Mod demo la prima pornire: „Vezi întâi cu o familie exemplu” umple aplicația cu familia Popescu (date relative la azi). Cât ține exemplul, sincronizarea e oprită; „Încep cu datele mele” golește tot și deschide pornirea.
- Abonamentul Familia: textele și documentele de billing aliniate cu codul (Casa: plicuri nelimitate, 2 persoane, un telefon; probă 30 de zile).
- Widget Android nou, „Plicurile mele”: cele mai folosite trei plicuri, cu bară și cât a rămas, plus buton de notare. Ascuns cu blocarea aplicației sau în modul membru.
- CSS mai mic: reguli pentru clase care nu mai există, scoase (933 KB, 3241 `!important`).

## 1.1.125

- Astăzi, refăcut: cifra zilei e prima, avertizările vin sub ea; eticheta stă pe rândul datei; un rând mereu vizibil cu zilele până la salariu, intrat și ieșit.
- „Plicurile tale” pe Astăzi: carduri care derulează, cu inel de progres în culoarea categoriei și cât a rămas.
- „Față de săptămâna trecută” și „Obiectiv și unde stau banii” sunt pastile mici, nu butoane pe toată lățimea.
- Provocarea lunii: în primele 10 zile, o țintă propusă pentru categoria flexibilă cea mai mare de luna trecută; acceptată, arată progresul și unde ajunge luna.
- „Notat” arată seria de la 3 zile la rând; Astăzi numără zilele fără cheltuieli din lună.
- Notificare pe 1 ale lunii, la 10: imaginea lunii trecute.
- Pagina de prezentare `despre.html` (GitHub Pages) și textele de lansare (`docs/lansare-texte.md`).

## 1.1.124

Aspect nou, cu culoare, și o buclă de creștere. Cercetarea din spate: [`cercetare-concurenta-2026-10.md`](cercetare-concurenta-2026-10.md).

- Fiecare categorie are culoarea ei (aceeași ca în diagrama din Analiză): iconițele din Mișcări, Astăzi și căutare, punctul și bara fiecărui plic.
- Notează: categoriile sunt la vedere, sub magazin, ca butoane colorate; înainte stăteau sub „Gata”, unde nu ajungea nimeni.
- Imaginea lunii (Analiză → Gospodărie, și pe Astăzi în primele 7 zile ale lunii): o poză 4:5 cu ce a rămas și unde s-au dus banii, de trimis pe WhatsApp sau Instagram. Implicit doar procente; sumele doar la cerere. Se face pe telefon.
- Tema Alb e mai luminoasă (carduri albe), iar cardul „Poți folosi azi” are o lumină verde discretă.
- Mai mult: iconițele stau pe plăcuțe colorate, pe secțiuni; dungile colorate din stânga au ieșit.
- Primul ecran: o frază clară și trei promisiuni — fără parola băncii, fără reclame, datele stau pe telefon.
- Recenzia din Play se cere și după a zecea zi cu cheltuieli notate sau după ce trimiți imaginea lunii (tot o singură dată, după o săptămână).
- Linia dintre mișcări pe Navy nu mai pică verificarea de contrast.
- Capturile din magazin refăcute (RO, EN, tabletă), cu imaginea lunii pe locul 3; datele lor (`seed.mjs`) sunt acum în repo.

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
- „Ce plătim lunar” (Plan): veniturile familiei cu ziua lor și cheltuielile știute, cu interval (300–400) și alegerea cât se rezervă (maximul, media sau minimul), lunar sau pe săptămână, din orice venit sau doar din al unuia. Când intră un salariu, Astăzi propune repartizarea: obligațiile întâi, apoi restul; mâncarea = suma pe săptămână × săptămânile reale ale ciclului (4 sau 5, fără virgule); ce nu încape așteaptă al doilea salariu, care completează doar ce lipsește. Tichetele de masă nu intră. „Aplică repartizarea” creează plicurile și se poate anula.
- Cheltuiala ajunge în plicul ei după ce scrii: „taxi”, „grădiniță”, „Enel” → Lumină, „Apa Nova” → Apă, „Bolt” → Taxi, „TBI” → Rate fără dobândă — și când plicurile au aceeași categorie. Merge la notare și la importul de extras.
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
