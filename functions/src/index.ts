import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import cors from "cors";

const geminiApiKey = defineSecret("GEMINI_API_KEY");
const groqApiKey = defineSecret("GROQ_API_KEY");
function originAllowed(origin: string | undefined) {
  if (!origin) return true;
  let host = "";
  try { host = new URL(origin).hostname; } catch { return false; }
  return origin === "https://balty1991.github.io"
    || origin === "capacitor://localhost"
    || origin === "ionic://localhost"
    || host === "localhost"
    || host === "127.0.0.1";
}

const allowCors = cors({
  origin(origin, callback) {
    callback(null, originAllowed(origin));
  },
});

type ChatAttachment = { name?: string; mimeType: string; data: string };
type ChatMessage = { role: "user" | "assistant"; text: string; attachments?: ChatAttachment[] };
type RequestBody = { messages?: ChatMessage[]; context?: Record<string, unknown> };
type GeminiPart = { text?: string; inline_data?: { mime_type: string; data: string } };
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };
type GroqContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
type GroqMessage = { role: "system" | "user" | "assistant"; content: string | GroqContentPart[] };
/**
 * Ce citește modelul dintr-un mesaj, în aceeași formă pe care o produce și
 * parserul de pe telefon. Aplicația o validează câmp cu câmp înainte să o
 * folosească; ce nu trece se aruncă, iar mesajul cade pe citirea locală.
 */
type ModelReading =
  | { kind: "expense"; amount: number; category: string; title?: string; date?: string }
  | { kind: "income"; amount: number; title?: string; date?: string }
  | { kind: "envelope"; label: string; amount: number; category?: string; weeklyLimit?: number; weeklyPace?: boolean; amountIsWeekly?: boolean }
  | { kind: "debt"; name: string; remaining: number; monthly?: number }
  | { kind: "recurring"; name: string; amount: number; dueDay: number; category?: string }
  | { kind: "goal"; name: string; target: number; current?: number; dueDate?: string }
  | { kind: "payday"; date: string; flexDays?: number }
  | { kind: "transfer"; from: string; to: string; amount: number }
  | { kind: "event-contribution"; name: string; amount: number; date?: string }
  | { kind: "due-paid"; name: string; date?: string }
  | { kind: "transaction-delete"; title?: string; amount?: number; date?: string; last?: boolean }
  | { kind: "transaction-amend"; amount: number; title?: string; was?: number; date?: string; last?: boolean }
  | { kind: "merchant-rule"; match: string; category?: string; envelope?: string }
  | { kind: "salary-rule"; envelope: string; mode: "percent" | "fixed"; value: number }
  | { kind: "open"; screen: string };

type GuideAnswer = {
  reply: string;
  intent: "question" | "income" | "expense" | "debt" | "allocation" | "summary" | "next_step";
  /**
   * Câmpul care contează de acum. `intent` și `extracted` rămân pentru versiunile
   * de aplicație deja instalate pe telefoane, care nu știu de el.
   */
  readings?: ModelReading[];
  needsConfirmation: boolean;
  extracted?: {
    amount?: number;
    title?: string;
    category?: string;
    debtName?: string;
    monthlyPayment?: number;
    items?: Array<{ amount?: number; title?: string }>;
    vendor?: string;
    date?: string;
    receiptLines?: Array<{ name?: string; quantity?: number; amount?: number }>;
    totalLabel?: string;
    confidence?: "high" | "medium" | "low";
  };
};
type Quota = { remaining: number | null; limit: number | null; resetAt: string | null };
type ProviderResult = { answer: GuideAnswer; source: "gemini" | "groq"; quota: Quota };

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-flash-latest"];
const GROQ_MODELS = ["openai/gpt-oss-120b", "qwen/qwen3.6-27b", "openai/gpt-oss-20b"];

const systemInstruction = `Ești Copilotul Financiar al aplicației Buget Familie. Ești un ghid calm, empatic și foarte practic, care rămâne activ pe tot parcursul folosirii aplicației. Nu răspunde generic și nu redirecționa utilizatorul către meniuri fără explicație.

Totul e despre aplicație. Omul nu vorbește cu un asistent general: scrie în ghidul aplicației lui de buget, cu registrul lui în față. Orice îți spune este despre banii, plicurile, scadențele, evenimentele și planul din aplicație, chiar când nu numește niciun ecran. „Mai am ceva pentru benzină?” întreabă de plicul de transport, nu de prețul carburantului. „Pune 300 deoparte pentru Crăciun” cere o punere deoparte la evenimentul din calendar, nu un sfat despre economisire. Nu răspunde niciodată cu sfaturi generale de finanțe personale când cererea se poate face în aplicație: fă-o, cu readings.

Ce poți face, adică ce ajunge efectiv în aplicație, sunt elementele din readings de mai jos: mișcări (cheltuială, venit), ștergerea sau corectarea unei mișcări deja trecute, plicuri (creare, ajustare cu delta, ștergere), mutare între plicuri, banii pe care îi are (funds), ziua salariului, scadențe recurente și marcarea uneia ca plătită, datorii, obiective, evenimente din calendar și bani puși deoparte pentru ele, reguli de magazin, repartizarea automată a venitului și deschiderea unui ecran. Dacă cererea e una dintre astea, trimite readings — nu descrie ce ar trebui să facă omul. Dacă cererea e altceva din aplicație și nu ai un reading pentru ea (un bon fotografiat, membri noi, export/backup, sincronizarea între telefoane, teme), spune scurt din ce ecran se face: Mișcări, Plan, Bonuri, Mai mult → Evenimente viitoare, Mai mult → Sincronizare, Mai mult → Backup. Nu inventa ecrane și nu trimite omul la meniuri fără să-i spui ce găsește acolo.

Contextul îți dă numele exacte pe care le are familia: sources (unde stau banii, cu sold), categories (categoriile acceptate), envelopes (plicurile, cu sumă și rest), recurring și dues (scadențele), goals (obiectivele), debts, events (evenimentele din calendar) și today (ziua de azi). Când omul numește un plic, o scadență sau un eveniment, folosește numele din context, nu o variantă a ta: aplicația leagă readingul de lucrul real după nume, iar un nume inventat face cererea să cadă. La category alege dintre categories; dacă niciuna nu se potrivește, lasă categoria pe care o spune omul, dar nu inventa un nume de plic care nu e în envelopes.

 Rolul tău este să conduci conversația financiară în pași mici: (1) venituri și frecvența lor, (2) solduri disponibile, (3) datorii și rate, (4) cheltuieli fixe, (5) obiective, (6) repartizarea banilor în categorii, (7) urmărirea lunii. După configurare, verifică periodic situația, observă schimbări, pune întrebări de clarificare și propune următorul pas. Regula de prioritate: dacă mesajul conține credit, împrumut, datorie, sold restant, rată lunară sau scadență, intenția este debt, nu expense; suma mare este soldul rămas, rata este monthlyPayment, iar ziua scadenței este dueDay ca număr între 1 și 31. Nu crea o cheltuială pentru soldul creditului și nu cere alegerea unui plic. Dacă utilizatorul oferă clar numele creditului și valorile sale, tratează mesajul ca pe o comandă de înregistrare: returnează intent debt, extracted complet și needsConfirmation false; răspunde că ai înregistrat datele, fără să ceri „Da”. Dacă utilizatorul spune că a plătit efectiv rata, abia atunci înregistrează plata ca expense separat, cu suma ratei. Dacă utilizatorul spune o cheltuială sau un venit, extrage TOATE sumele în extracted. Păstrează întotdeauna zecimalele exacte: 15,50 lei înseamnă 15.50, nu 16; nu rotunji niciodată sumele de pe bon. Pentru două salarii, pune items: [{amount, title}, {amount, title}] și amount = totalul. Nu primești imagini sau PDF-uri de bon: atașamentele sunt ignorate, bonul se citește pe telefon. Dacă omul vorbește despre un bon, spune-i să îl noteze din Mișcări sau De verificat și nu pretinde că ai văzut o poză. needsConfirmation este true doar la prima propunere de cheltuială ambiguă. Pentru datorii, venituri și repartizări pe care utilizatorul le-a formulat clar, needsConfirmation trebuie să fie false. După ce utilizatorul zice da, adaugă, creează sau înregistrează, needsConfirmation trebuie să fie false. Nu spune niciodată că ai salvat dacă needsConfirmation este true — salvarea o face aplicația, nu tu.

Repartizarea banilor se face de azi înainte, nu pe zilele care au trecut. Contextul îți dă period cu: start, end (data venitului), today, daysTotal, daysLeft, free (banii nerepartizați), paceWeekly (ritmul pe săptămână întreagă pe care îl susțin banii liberi pe zilele rămase), pacePerDay și startedWeek (index, daysLeft, share) când săptămâna curentă e deja începută. Folosește aceste cifre, nu împărți tu venitul la 4 săptămâni.

Reguli de ritm: o perioadă are rareori un număr rotund de săptămâni, iar dacă planul se face joi, zilele de luni până miercuri nu mai pot primi bani. Când utilizatorul cere un ritm („vreau 600 pe săptămână”, „cam 150 pe zi”), suma de care are nevoie este ritmul înmulțit cu zilele rămase, nu cu zilele întregi ale perioadei: 600 pe săptămână cu daysLeft 23 înseamnă 600 × 23 / 7. Pune atunci amount = ritmul săptămânal și amountIsWeekly = true, iar aplicația calculează totalul pe zilele rămase — nu calcula tu totalul. Dacă utilizatorul spune o sumă totală („plic Alimente 1800”), lasă amountIsWeekly nesetat.

Când ritmul cerut cere mai mulți bani decât period.free, spune-o direct, cu diferența în lei, și oferă două ieșiri: fie completează suma, fie coboară la period.paceWeekly. Nu propune un plic care trece peste banii liberi fără să avertizezi.

Săptămâna începută primește doar partea zilelor rămase: din period.startedWeek ai share, adică suma care revine celor daysLeft zile. Aplicația mută singură restul în săptămânile următoare când creează plicul, deci nu cere utilizatorului să facă mutarea manual; poți să-i spui că se întâmplă. Ecranul Plan oferă și două variante la crearea unui plic — „De azi, egal pe zile” (ritm egal pe toate zilele rămase) și „Săptămâna începută rămâne întreagă” (tranșa curentă păstrează bugetul ei plin, mai lejer acum și mai strâns până la venit) — plus un comutator „Alocă de azi, nu și pe zilele trecute”, pornit implicit când perioada e începută. Trimite-l acolo cu numele astea, nu cu descrieri inventate.

Fraza cea mai des scrisă în aplicație sună așa: „am 1800 de lei pe care îi împart în plicuri săptămânale până pe 9 octombrie, când iau salariul”. Ea conține două lucruri, nu unul: data venitului (reading payday) și împărțirea sumei. Nu răspunde doar cu data — asta lasă omul cu impresia că nu l-ai ascultat. Dacă a spus și categoriile, întoarce câte un reading envelope pentru fiecare, iar suma lor să nu depășească suma spusă. Dacă nu le-a spus, confirmă scurt data, apoi întreabă în ce plicuri merg cei 1800 și propune o împărțire concretă pe categoriile pe care le vezi în context (plicurile existente, scadențele, cheltuielile lunii) — cu cifre, nu cu generalități. Nu inventa plicuri pe care familia nu le are și nu cere de două ori aceeași informație.

Când omul enumeră plicurile într-o singură frază — „împarte-l pe săptămâni, alimente 800, transport 300, restul diverse”, „repartizează 1500: 800 alimente, 400 transport” — fiecare nume cu suma lui este un reading envelope separat, în ordinea în care le-a spus. Nu face un singur plic cu numele lipite. „Restul”, „ce rămâne” sau „diferența” înseamnă banii care rămân din period.free după plicurile cu sumă spusă: calculează-i și pune-i în plicul numit acolo; dacă nu rămâne nimic, spune-o în loc să trimiți un plic de zero. „Pe săptămâni” din aceeași frază dă weeklyPace true tuturor, iar sumele rămân totaluri de perioadă (amountIsWeekly nesetat).

Când omul cere o limită „pe săptămână”, „împărțită la perioada rămasă” sau „pe câte zile mai sunt”, aceea este exact regula de ritm de mai sus: pune amount = ritmul săptămânal și amountIsWeekly = true, iar aplicația face împărțirea pe zilele rămase. Nu calcula tu tranșele și nu cere omului să le socotească.

Evenimentele viitoare sunt cheltuielile anunțate de calendar: Crăciun, Revelion, Paște, aniversări, începutul școlii, o vacanță. Contextul îți dă events cu perMonth (cât cere fondul pe lună, pentru tot ce urmează), estimate, saved, remaining și next — o listă cu name, date, daysLeft, estimate, saved, remaining, perMonth și passed. Folosește cifrele astea când omul întreabă ce urmează, cât să pună deoparte sau dacă își permite ceva: o sumă liberă azi nu e liberă dacă peste trei săptămâni vine Crăciunul nefinanțat. Când events lipsește din context, familia nu a notat încă niciun eveniment — poți propune să noteze unul, dar nu inventa nici sărbători, nici costuri.

Banii puși deoparte pentru un eveniment sunt o socoteală de planificare, nu un transfer: nu pleacă din surse, nu intră în registru și nu scad soldul. Spune asta ca atare și nu promite că muți bani. Un eveniment cu passed true are ediția trecută și încă neînchisă: banii strânși sunt ai ediției care a trecut, nu ai celei viitoare, iar omul o închide din ecranul „Evenimente viitoare” (Mai mult → Evenimente viitoare). Când omul cere să noteze un eveniment („pune-mi Crăciun 1200”, „ziua Anei pe 18 octombrie, vreo 400 de lei”), returnează un reading de fel planned-event. Nu confunda cu goal: obiectivul de economisire e o sumă de strâns fără dată de sărbătoare, evenimentul e o zi din calendar care va cere bani. Costul poate lipsi dacă nu s-a spus — lasă estimate necompletat, nu ghici cât costă Crăciunul unei familii.

O frază poate purta trei lucruri deodată, iar cea mai des scrisă le poartă pe toate: „am un buget de 1800, îl pui în plic alimente și în părți pe săptămâni până iau salariul pe 9 octombrie” înseamnă (1) funds 1800 — banii pe care îi are, (2) envelope Alimente 1800 cu weeklyPace true — „pe săptămâni” cere ritm săptămânal, dar suma rămâne totalul perioadei, nu o limită pe săptămână, deci amountIsWeekly rămâne nesetat, și (3) payday 9 octombrie. Nu întoarce doar una dintre ele. Dacă omul spune o sumă pe care o are și tot el o pune într-un plic, aceeași sumă merge în ambele readings: fără funds, plicul stă peste surse goale și aplicația arată „peste limita planului”.

Întrebarea nu se înregistrează. „Cum să împart 2000 până pe 10 octombrie?” și „cât ar trebui să pun deoparte ca să am 3000 până în decembrie?” cer un sfat cu cifre, deci readings rămâne gol și răspunsul e calculul: cât pe lună, cât pe săptămână, din ce sumă. Abia când omul spune „fă-le” sau „da, împarte-i așa” trimiți plicurile ca readings.

Răspunde în română, natural, ca un asistent care își amintește conversația. Nu folosi markdown: fără **, # sau liste cu asteriscuri. Răspunsuri scurte, maximum 4-5 propoziții. Dacă enumeri, scrie 1. 2. 3. pe rânduri separate. Nu inventa sume. Nu pretinde că ai acces la conturi bancare. Contextul primit este un rezumat controlat (plicuri rămase, scadențe, datorii, totalul lunii), nu jurnalul de mișcări: nu inventa magazine, date sau sume care nu sunt în rezumat. Dacă utilizatorul întreabă de o mișcare anume pe care nu o vezi, spune că o poate căuta în Mișcări. Nu oferi recomandări de investiții, creditare sau decizii financiare riscante ca certitudini. Explică întotdeauna ce ai înțeles și ce urmează.

Răspunsul trebuie să fie JSON cu: reply (textul către utilizator), readings (lista de mai jos), intent (question|income|expense|debt|allocation|summary|next_step), needsConfirmation (boolean) și extracted (obiect opțional cu amount, title, category, debtName, monthlyPayment doar dacă au fost spuse clar).

readings este partea care ajunge efectiv în registrul omului, deci contează cel mai mult. Pune în ea, ca listă, TOT ce ai înțeles că trebuie înregistrat din mesaj — un mesaj poate conține mai multe lucruri deodată („fă-mi plic Alimente 2400 și salariul vine pe 7 octombrie” înseamnă două intrări). Fiecare element are un câmp kind și doar câmpurile felului său:
- expense: amount (număr, în lei), category (text), title (text scurt), date (AAAA-LL-ZZ)
- income: amount, title, date
- envelope: label, amount, category, weeklyLimit (dacă s-a spus o limită săptămânală), weeklyPace (boolean), amountIsWeekly (boolean: true doar dacă suma din amount este un ritm pe săptămână, nu totalul perioadei)
- envelope, cu delta: când omul cere o ajustare („mărește plicul de alimente cu 200”, „mai pune 200 la alimente”, „scade 100 din transport”), pune amount = cât se adaugă sau se scade și delta = "increase" sau "decrease". Fără delta, amount înlocuiește suma plicului — deci o ajustare trimisă fără delta taie banii din plic. La delta nu se trimit weeklyLimit și amountIsWeekly.
- debt: name, remaining (soldul rămas), monthly (rata lunară, dacă se știe)
- recurring: name, amount, dueDay (1-31), category
- goal: name, target, current (dacă s-a spus cât s-a strâns), dueDate
- planned-event: name, date (AAAA-LL-ZZ, ziua din calendar), estimate (costul estimat, dacă s-a spus), repeat ("yearly" pentru o sărbătoare care revine, "once" pentru ceva singular)
- envelope-delete: label (numele plicului de șters). Doar când omul cere limpede ștergerea („șterge plicul de transport”, „nu mai vreau plicul X”). Banii nu se pierd: suma plicului se întoarce în nerepartizat. Fără nume de plic, nu trimite nimic.
- funds: amount (banii pe care omul spune că îi ARE acum: „am un buget de 1800”, „am 1800 în card”), sourceHint opțional ("card", "cash" sau "meal"). Nu e o cheltuială și nu e un salariu anume: e cât are omul acum. Aplicația scrie în Mișcări diferența dintre cât spune el și cât vede ea, ca intrare de bani cu ziua de azi, așa că soldul ajunge exact la suma spusă. Fără el, un plic creat peste surse goale scoate aplicația pe minus și omul vede „peste limita planului”. Spune-i că banii intră în Mișcări, nu că „am pus soldul”.
- transfer: from (numele plicului din care ies banii), to (numele plicului în care intră), amount. Doar între plicuri care există în context. Banii nu se mișcă între carduri: se schimbă doar cât are voie fiecare plic. Fără un plic pe nume, nu trimite nimic.
- event-contribution: name (numele evenimentului din context), amount, date opțional. „Pune 300 deoparte pentru Crăciun.” E o socoteală de planificare: nu scade soldul și nu intră în registru. Dacă evenimentul nu există încă, trimite întâi un reading planned-event și spune-i omului că îl notezi, apoi punerea deoparte.
- due-paid: name (numele scadenței din context), date opțional. „Am plătit chiria.” Suma o știe aplicația din scadență — nu o trimite tu și nu o ghici. Dacă omul spune și o sumă diferită de cea din context, atunci e o cheltuială obișnuită, nu o scadență plătită.
- transaction-delete: ștergerea unei mișcări deja trecute. Spune după ce se recunoaște, în cuvintele omului: title (ce scrie pe ea), amount, date, sau last: true pentru „ultima mișcare”. Nu primești jurnalul și nu ai nevoie de el — registrul rămâne pe telefon, iar aplicația caută rândul acolo și îl arată înainte de ștergere. Dacă omul n-a spus nimic după care se poate recunoaște, întreabă.
- transaction-amend: corectarea sumei unei mișcări trecute. amount = suma corectă, iar was, title, date sau last: true spun despre care e vorba. „Am trecut 50, de fapt era 60” înseamnă amount 60 și was 50.
- merchant-rule: match (textul care se caută în titlu), plus category sau envelope (numele unui plic din context). „De fiecare dată când scriu Lidl, pune-l pe Alimente.” Regula nu scrie nimic singură: la următoarea cheltuială propune, iar omul confirmă.
- salary-rule: envelope (numele unui plic din context), mode ("percent" sau "fixed"), value. „Din fiecare salariu pune 20% la economii.” Se aplică la venitul următor, nu la banii de acum — spune-i asta.
- open: screen, unul dintre today, journal, plan, obligations, goals, habits, calendar, insights, utilities. Doar când omul cere să ajungă undeva („deschide-mi planul”). Nu-l folosi ca să scapi de o cerere pe care o poți face tu.
- payday: date, flexDays (0-5)

Reguli pentru readings: pune un element DOAR dacă utilizatorul chiar a cerut să se înregistreze ceva. La o întrebare („cât am cheltuit luna asta?”, „îmi permit 300 de lei?”), la o mulțumire sau la o discuție, readings rămâne listă goală. Nu inventa câmpuri care nu s-au spus: mai bine lipsește decât să fie ghicit. Sumele sunt numere, nu text, cu zecimale exacte. Datele sunt scrise AAAA-LL-ZZ și trebuie să existe în calendar; dacă utilizatorul nu a spus o zi, lasă date necompletat, nu pune ziua de azi de la tine. Aplicația verifică fiecare element și îl aruncă dacă e incomplet sau imposibil, apoi cere confirmarea omului înainte să salveze ceva — deci nu scrie în reply că ai salvat.`;

const responseSchema = {
  type: "OBJECT",
  properties: {
    reply: { type: "STRING" },
    intent: {
      type: "STRING",
      enum: ["question", "income", "expense", "debt", "allocation", "summary", "next_step"],
    },
    needsConfirmation: { type: "BOOLEAN" },
    readings: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          kind: { type: "STRING", enum: ["expense", "income", "envelope", "envelope-delete", "funds", "transfer", "event-contribution", "due-paid", "transaction-delete", "transaction-amend", "merchant-rule", "salary-rule", "open", "debt", "recurring", "goal", "planned-event", "payday"] },
          amount: { type: "NUMBER" },
          category: { type: "STRING" },
          title: { type: "STRING" },
          date: { type: "STRING" },
          label: { type: "STRING" },
          weeklyLimit: { type: "NUMBER" },
          weeklyPace: { type: "BOOLEAN" },
          amountIsWeekly: { type: "BOOLEAN" },
          delta: { type: "STRING", enum: ["increase", "decrease"] },
          name: { type: "STRING" },
          remaining: { type: "NUMBER" },
          monthly: { type: "NUMBER" },
          dueDay: { type: "NUMBER" },
          target: { type: "NUMBER" },
          current: { type: "NUMBER" },
          dueDate: { type: "STRING" },
          estimate: { type: "NUMBER" },
          repeat: { type: "STRING", enum: ["once", "yearly"] },
          sourceHint: { type: "STRING", enum: ["card", "cash", "meal"] },
          flexDays: { type: "NUMBER" },
          from: { type: "STRING" },
          to: { type: "STRING" },
          was: { type: "NUMBER" },
          last: { type: "BOOLEAN" },
          match: { type: "STRING" },
          envelope: { type: "STRING" },
          mode: { type: "STRING", enum: ["percent", "fixed"] },
          value: { type: "NUMBER" },
          screen: { type: "STRING", enum: ["today", "journal", "plan", "obligations", "goals", "habits", "calendar", "insights", "utilities"] },
        },
        required: ["kind"],
      },
    },
    extracted: {
      type: "OBJECT",
      properties: {
        amount: { type: "NUMBER" },
        title: { type: "STRING" },
        category: { type: "STRING" },
        debtName: { type: "STRING" },
        monthlyPayment: { type: "NUMBER" },
        dueDay: { type: "NUMBER" },
        vendor: { type: "STRING" },
        date: { type: "STRING" },
        totalLabel: { type: "STRING" },
        confidence: { type: "STRING", enum: ["high", "medium", "low"] },
        receiptLines: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING" },
              quantity: { type: "NUMBER" },
              amount: { type: "NUMBER" },
            },
          },
        },
        items: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              amount: { type: "NUMBER" },
              title: { type: "STRING" },
            },
          },
        },
      },
    },
  },
  required: ["reply", "intent", "needsConfirmation"],
};

class GuideCallError extends Error {
  status: number;
  quota: Quota;
  constructor(message: string, status: number, quota: Quota = { remaining: null, limit: null, resetAt: null }) {
    super(message);
    this.status = status;
    this.quota = quota;
  }
}

function sanitizeKey(raw: string) {
  const value = raw.trim().replace(/^['"]+|['"]+$/g, "").replace(/^Bearer\s+/i, "");
  if (!value || value === "pending" || value === "undefined" || value === "null") return "";
  return value;
}

function isInvalidKey(detail: string) {
  return /API[_ ]?key not valid|API_KEY_INVALID|invalid api key|API key expired|PERMISSION_DENIED|invalid_api_key|Incorrect API key/i.test(detail);
}

function buildContents(messages: ChatMessage[], context: Record<string, unknown>): GeminiContent[] {
  const contents: GeminiContent[] = [];
  for (const message of messages) {
    const text = String(message.text || "").slice(0, 2000).trim();
    // Pozele de bon rămân pe telefon (Play Data safety). Ignorăm orice attachments din clienți vechi.
    if (!text) continue;
    const role = message.role === "assistant" ? "model" : "user";
    const parts: GeminiPart[] = [{ text }];
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      const firstText = last.parts.find((part) => part.text);
      if (firstText?.text) firstText.text += `\n${text}`;
      else last.parts.push({ text });
    } else {
      contents.push({ role, parts });
    }
  }

  const contextText = `Context financiar controlat (nu divulga datele ca listă decât dacă utilizatorul cere): ${JSON.stringify(context)}`;
  if (!contents.length) {
    contents.push({ role: "user", parts: [{ text: contextText }] });
  } else if (contents[0].role === "user") {
    const firstText = contents[0].parts.find((part) => part.text);
    if (firstText?.text) firstText.text = `${contextText}\n\n${firstText.text}`;
    else contents[0].parts.unshift({ text: contextText });
  } else {
    contents.unshift({ role: "user", parts: [{ text: contextText }] });
  }
  return contents;
}

function parseGuideAnswer(raw: string): GuideAnswer {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/u, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as Partial<GuideAnswer>;
    if (typeof parsed.reply === "string" && parsed.reply.trim()) {
      return {
        reply: parsed.reply.trim(),
        intent: parsed.intent || "question",
        // Lista trece mai departe așa cum a venit; validarea o face aplicația,
        // fiindcă acolo se știe ce plicuri și ce surse există cu adevărat.
        readings: Array.isArray(parsed.readings) ? parsed.readings.slice(0, 8) : undefined,
        needsConfirmation: Boolean(parsed.needsConfirmation),
        extracted: parsed.extracted,
      };
    }
  } catch {
    /* răspuns liber de la model */
  }
  return {
    reply: cleaned || "Am analizat mesajul. Spune-mi ce vrei să facem în continuare.",
    intent: "question",
    needsConfirmation: false,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseDurationMs(raw: string) {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value) * 1000;
  let ms = 0;
  const hours = value.match(/(\d+(?:\.\d+)?)h/);
  const minutes = value.match(/(\d+(?:\.\d+)?)m(?!s)/);
  const seconds = value.match(/(\d+(?:\.\d+)?)s/);
  if (hours) ms += Number(hours[1]) * 3_600_000;
  if (minutes) ms += Number(minutes[1]) * 60_000;
  if (seconds) ms += Number(seconds[1]) * 1000;
  return ms || null;
}

function nextPacificMidnight() {
  const now = Date.now();
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hourCycle: "h23" }).format(now));
  const minute = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", minute: "numeric" }).format(now));
  const msLeft = Math.max(60_000, ((23 - hour) * 60 + (60 - minute)) * 60_000);
  return new Date(now + msLeft).toISOString();
}

function quotaFrom(headers: Headers, detail = "", exhausted = false): Quota {
  const remainingHeader = Number(headers.get("x-ratelimit-remaining-requests"));
  const limitHeader = Number(headers.get("x-ratelimit-limit-requests"));
  const resetHeader = headers.get("x-ratelimit-reset-requests") || headers.get("retry-after") || "";
  const retryMatch = detail.match(/retry in ([\d.]+)\s*s/i);
  const delayMs = parseDurationMs(resetHeader) || (retryMatch ? Number(retryMatch[1]) * 1000 : null);
  const remaining = Number.isFinite(remainingHeader) ? remainingHeader : exhausted ? 0 : null;
  const shortWindow = delayMs != null && delayMs < 15 * 60 * 1000 && (remaining == null || remaining > 8);
  return {
    remaining,
    limit: Number.isFinite(limitHeader) ? limitHeader : null,
    resetAt: shortWindow ? null : delayMs ? new Date(Date.now() + delayMs).toISOString() : exhausted ? nextPacificMidnight() : null,
  };
}

async function callGemini(apiKey: string, contents: GeminiContent[]) {
  let lastStatus = 0;
  let lastDetail = "";
  let lastQuota: Quota = { remaining: null, limit: null, resetAt: null };

  for (const model of GEMINI_MODELS) {
    for (const structured of [true, false]) {
      const payload = {
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: structured
          ? {
              temperature: 0.6,
              responseMimeType: "application/json",
              responseSchema,
            }
          : { temperature: 0.6 },
      };
      for (let attempt = 0; attempt < 2; attempt++) {
        const apiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        lastStatus = apiResponse.status;
        if (apiResponse.ok) {
          const body = (await apiResponse.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const raw = body.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "{}";
          return { answer: parseGuideAnswer(raw), source: "gemini" as const, quota: quotaFrom(apiResponse.headers) };
        }
        lastDetail = await apiResponse.text();
        lastQuota = quotaFrom(apiResponse.headers, lastDetail, apiResponse.status === 429);
        if (isInvalidKey(lastDetail)) {
          throw new GuideCallError("INVALID_API_KEY", apiResponse.status, quotaFrom(apiResponse.headers, lastDetail));
        }
        if (apiResponse.status === 404) break;
        if (apiResponse.status === 429 || apiResponse.status === 503) {
          const quota = quotaFrom(apiResponse.headers, lastDetail, apiResponse.status === 429);
          if (attempt === 0) {
            await sleep(500);
            continue;
          }
          throw new GuideCallError(lastDetail.slice(0, 300) || "GEMINI_BUSY", apiResponse.status, quota);
        }
        break;
      }
    }
  }

  throw new GuideCallError(lastDetail.slice(0, 300) || "GEMINI_UPSTREAM_ERROR", lastStatus, lastQuota);
}

async function callGroq(apiKey: string, contents: GeminiContent[]) {
  let lastStatus = 0;
  let lastDetail = "";
  let lastQuota: Quota = { remaining: null, limit: null, resetAt: null };
  const messages: GroqMessage[] = [
    { role: "system", content: systemInstruction },
    ...contents.map((item) => ({
      role: item.role === "model" ? "assistant" as const : "user" as const,
      content: item.parts.flatMap((part): GroqContentPart[] => {
        if (part.text) return [{ type: "text", text: part.text }];
        if (part.inline_data?.mime_type.startsWith("image/")) {
          return [{ type: "image_url", image_url: { url: `data:${part.inline_data.mime_type};base64,${part.inline_data.data}` } }];
        }
        if (part.inline_data) return [{ type: "text", text: "[atașament PDF disponibil doar pentru modelul principal]" }];
        return [];
      }),
    })),
  ];

  for (const model of GROQ_MODELS) {
    for (const structured of [true, false]) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const apiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0.6,
            messages,
            ...(structured ? { response_format: { type: "json_object" } } : {}),
          }),
        });
        lastStatus = apiResponse.status;
        if (apiResponse.ok) {
          const body = (await apiResponse.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          return {
            answer: parseGuideAnswer(body.choices?.[0]?.message?.content || "{}"),
            source: "groq" as const,
            quota: quotaFrom(apiResponse.headers),
          };
        }
        lastDetail = await apiResponse.text();
        lastQuota = quotaFrom(apiResponse.headers, lastDetail, apiResponse.status === 429);
        console.error("Groq error", model, structured ? "json" : "text", apiResponse.status, lastDetail.slice(0, 400));
        if (isInvalidKey(lastDetail)) {
          throw new GuideCallError("INVALID_GROQ_KEY", apiResponse.status, quotaFrom(apiResponse.headers, lastDetail));
        }
        if (apiResponse.status === 404) break;
        if (apiResponse.status === 400) break;
        if (apiResponse.status === 429 || apiResponse.status === 503) {
          await sleep(700 * (attempt + 1));
          continue;
        }
        break;
      }
    }
  }

  throw new GuideCallError(lastDetail.slice(0, 300) || "GROQ_UPSTREAM_ERROR", lastStatus, lastQuota);
}

async function generateGuide(contents: GeminiContent[], geminiKey: string, groqKey: string) {
  if (geminiKey) {
    try {
      return await callGemini(geminiKey, contents);
    } catch (error) {
      if (!groqKey) throw error;
      console.error("Gemini unavailable, trying Groq", error instanceof Error ? error.message.slice(0, 200) : "unknown");
    }
  }
  if (groqKey) {
    return await callGroq(groqKey, contents);
  }
  throw new GuideCallError("NO_GUIDE_PROVIDER", 503);
}

export const aiGuide = onRequest(
  {
    region: "europe-central2",
    invoker: "public",
    secrets: [geminiApiKey, groqApiKey],
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 8,
  },
  (request, response) => {
    allowCors(request, response, async () => {
      if (request.method === "OPTIONS") {
        response.status(204).send("");
        return;
      }
      if (request.method !== "POST") {
        response.status(405).json({ error: "Method not allowed" });
        return;
      }

      const origin = request.get("origin");
      if (origin && !originAllowed(origin)) {
        response.status(403).json({ error: "Origin not allowed" });
        return;
      }
      const body = (request.body || {}) as RequestBody;
      const messages = Array.isArray(body.messages) ? body.messages.slice(-12).map((message) => ({
        role: message.role === "assistant" ? "assistant" as const : "user" as const,
        text: String(message.text || "").slice(0, 2000),
      })).filter((message) => message.text.trim()) : [];
      const context = body.context && typeof body.context === "object" ? body.context : {};
      let contextSize = 0;
      try { contextSize = JSON.stringify(context).length; } catch { contextSize = 12001; }
      if (contextSize > 12000) {
        response.status(413).json({ error: "Context too large" });
        return;
      }
      if (!messages.length) {
        response.status(400).json({ error: "Conversation is required" });
        return;
      }

      const geminiKey = sanitizeKey(geminiApiKey.value() || "");
      const groqKey = sanitizeKey(groqApiKey.value() || "");
      if (!geminiKey && !groqKey) {
        response.status(503).json({
          error: "Copilotul AI nu este configurat. Lipsește cheia Gemini sau Groq.",
          code: "guide_key",
        });
        return;
      }

      try {
        const result = await generateGuide(buildContents(messages, context), geminiKey, groqKey);
        response.json({ ...result.answer, source: result.source, quota: result.quota });
      } catch (error) {
        const err = error instanceof GuideCallError ? error : new GuideCallError("unknown", 500);
        console.error("AI guide failure", err.message.slice(0, 500));
        if (err.message === "INVALID_API_KEY" || err.message === "INVALID_GROQ_KEY") {
          response.status(503).json({
            error: "Cheia AI nu este validă. Verifică GEMINI_API_KEY sau GROQ_API_KEY în secrete.",
            code: "guide_key",
            upstreamStatus: err.status,
          });
          return;
        }
        const exhausted = err.status === 429;
        response.status(exhausted ? 429 : 502).json({
          error: exhausted ? "Limita ghidului online s-a epuizat temporar." : "Copilotul AI nu a putut răspunde acum.",
          code: exhausted ? "quota" : "guide_upstream",
          source: "none",
          quota: err.quota?.remaining != null || err.quota?.resetAt ? err.quota : { remaining: exhausted ? 0 : null, limit: null, resetAt: exhausted ? nextPacificMidnight() : null },
          upstreamStatus: err.status,
        });
      }
    });
  },
);
