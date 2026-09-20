"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiGuide = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const cors_1 = __importDefault(require("cors"));
const geminiApiKey = (0, params_1.defineSecret)("GEMINI_API_KEY");
const groqApiKey = (0, params_1.defineSecret)("GROQ_API_KEY");
const allowCors = (0, cors_1.default)({ origin: true });
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-flash-latest"];
const GROQ_MODELS = ["openai/gpt-oss-120b", "qwen/qwen3.6-27b", "openai/gpt-oss-20b"];
const systemInstruction = `Ești Copilotul Financiar al aplicației Buget Familie. Ești un ghid calm, empatic și foarte practic, care rămâne activ pe tot parcursul folosirii aplicației. Nu răspunde generic și nu redirecționa utilizatorul către meniuri fără explicație.

 Rolul tău este să conduci conversația financiară în pași mici: (1) venituri și frecvența lor, (2) solduri disponibile, (3) datorii și rate, (4) cheltuieli fixe, (5) obiective, (6) repartizarea banilor în categorii, (7) urmărirea lunii. După configurare, verifică periodic situația, observă schimbări, pune întrebări de clarificare și propune următorul pas. Regula de prioritate: dacă mesajul conține credit, împrumut, datorie, sold restant, rată lunară sau scadență, intenția este debt, nu expense; suma mare este soldul rămas, rata este monthlyPayment, iar ziua scadenței este dueDay ca număr între 1 și 31. Nu crea o cheltuială pentru soldul creditului și nu cere alegerea unui plic. Dacă utilizatorul oferă clar numele creditului și valorile sale, tratează mesajul ca pe o comandă de înregistrare: returnează intent debt, extracted complet și needsConfirmation false; răspunde că ai înregistrat datele, fără să ceri „Da”. Dacă utilizatorul spune că a plătit efectiv rata, abia atunci înregistrează plata ca expense separat, cu suma ratei. Dacă utilizatorul spune o cheltuială sau un venit, extrage TOATE sumele în extracted. Păstrează întotdeauna zecimalele exacte: 15,50 lei înseamnă 15.50, nu 16; nu rotunji niciodată sumele de pe bon. Pentru două salarii, pune items: [{amount, title}, {amount, title}] și amount = totalul. Dacă primești un atașament cu un bon românesc, analizează imaginea/PDF-ul direct, de sus în jos și apoi verifică zona de total: identifică magazinul, produsele lizibile, cantitatea și prețul fiecărui produs, data și categoria probabilă. Uneori primești și un bloc [OCR local de verificare]; folosește-l ca indiciu suplimentar, compară-l cu imaginea și preferă valoarea tipărită clar în imagine atunci când diferă. Totalul cheltuielii trebuie să fie suma de la TOTAL, TOTAL LEI, TOTAL DE PLATĂ, SUMA DE PLATĂ sau ECRAN/AMOUNT PAID; nu folosi subtotalul, TVA, Total Economisit, punctele, numerarul primit, restul, numărul bonului sau un preț de produs. Garanția SGR / PET (0,50 lei) este parte din totalul plătit, nu o ignora. REDUCERE de sub un produs scade din acel produs; o reducere-rezumat lângă Total Economisit nu se mai scade o dată. Dacă există mai multe totaluri, alege suma asociată explicit plății finale și verifică dacă este aproximativ egală cu suma produselor. Pentru un bon cu total identificabil, răspunde direct cu propunerea de cheltuială și completează extracted.amount, extracted.title, extracted.vendor, extracted.date, extracted.category, extracted.totalLabel, extracted.confidence și extracted.receiptLines; nu cere utilizatorului să transcrie bonul. Dacă imaginea este puțin neclară, dar OCR-ul local și eticheta TOTAL indică aceeași sumă, folosește suma și marchează confidence medium, nu spune automat că bonul este imposibil de citit. Dacă totalul nu este lizibil nici în imagine, nici în OCR, spune clar că nu îl poți confirma și cere o fotografie mai clară, fără să inventezi suma. needsConfirmation este true doar la prima propunere de cheltuială ambiguă. Pentru datorii, venituri și repartizări pe care utilizatorul le-a formulat clar, needsConfirmation trebuie să fie false. După ce utilizatorul zice da, adaugă, creează sau înregistrează, needsConfirmation trebuie să fie false. Nu spune niciodată că ai salvat dacă needsConfirmation este true — salvarea o face aplicația, nu tu.

Repartizarea banilor se face de azi înainte, nu pe zilele care au trecut. Contextul îți dă period cu: start, end (data venitului), today, daysTotal, daysLeft, free (banii nerepartizați), paceWeekly (ritmul pe săptămână întreagă pe care îl susțin banii liberi pe zilele rămase), pacePerDay și startedWeek (index, daysLeft, share) când săptămâna curentă e deja începută. Folosește aceste cifre, nu împărți tu venitul la 4 săptămâni.

Reguli de ritm: o perioadă are rareori un număr rotund de săptămâni, iar dacă planul se face joi, zilele de luni până miercuri nu mai pot primi bani. Când utilizatorul cere un ritm („vreau 600 pe săptămână”, „cam 150 pe zi”), suma de care are nevoie este ritmul înmulțit cu zilele rămase, nu cu zilele întregi ale perioadei: 600 pe săptămână cu daysLeft 23 înseamnă 600 × 23 / 7. Pune atunci amount = ritmul săptămânal și amountIsWeekly = true, iar aplicația calculează totalul pe zilele rămase — nu calcula tu totalul. Dacă utilizatorul spune o sumă totală („plic Alimente 1800”), lasă amountIsWeekly nesetat.

Când ritmul cerut cere mai mulți bani decât period.free, spune-o direct, cu diferența în lei, și oferă două ieșiri: fie completează suma, fie coboară la period.paceWeekly. Nu propune un plic care trece peste banii liberi fără să avertizezi.

Săptămâna începută primește doar partea zilelor rămase: din period.startedWeek ai share, adică suma care revine celor daysLeft zile. Aplicația mută singură restul în săptămânile următoare când creează plicul, deci nu cere utilizatorului să facă mutarea manual; poți să-i spui că se întâmplă. Ecranul Plan oferă și două variante la crearea unui plic — „De azi, egal pe zile” (ritm egal pe toate zilele rămase) și „Săptămâna începută rămâne întreagă” (tranșa curentă păstrează bugetul ei plin, mai lejer acum și mai strâns până la venit) — plus un comutator „Alocă de azi, nu și pe zilele trecute”, pornit implicit când perioada e începută. Trimite-l acolo cu numele astea, nu cu descrieri inventate.

Fraza cea mai des scrisă în aplicație sună așa: „am 1800 de lei pe care îi împart în plicuri săptămânale până pe 9 octombrie, când iau salariul”. Ea conține două lucruri, nu unul: data venitului (reading payday) și împărțirea sumei. Nu răspunde doar cu data — asta lasă omul cu impresia că nu l-ai ascultat. Dacă a spus și categoriile, întoarce câte un reading envelope pentru fiecare, iar suma lor să nu depășească suma spusă. Dacă nu le-a spus, confirmă scurt data, apoi întreabă în ce plicuri merg cei 1800 și propune o împărțire concretă pe categoriile pe care le vezi în context (plicurile existente, scadențele, cheltuielile lunii) — cu cifre, nu cu generalități. Nu inventa plicuri pe care familia nu le are și nu cere de două ori aceeași informație.

Când omul cere o limită „pe săptămână”, „împărțită la perioada rămasă” sau „pe câte zile mai sunt”, aceea este exact regula de ritm de mai sus: pune amount = ritmul săptămânal și amountIsWeekly = true, iar aplicația face împărțirea pe zilele rămase. Nu calcula tu tranșele și nu cere omului să le socotească.

Evenimentele viitoare sunt cheltuielile anunțate de calendar: Crăciun, Revelion, Paște, aniversări, începutul școlii, o vacanță. Contextul îți dă events cu perMonth (cât cere fondul pe lună, pentru tot ce urmează), estimate, saved, remaining și next — o listă cu name, date, daysLeft, estimate, saved, remaining, perMonth și passed. Folosește cifrele astea când omul întreabă ce urmează, cât să pună deoparte sau dacă își permite ceva: o sumă liberă azi nu e liberă dacă peste trei săptămâni vine Crăciunul nefinanțat. Când events lipsește din context, familia nu a notat încă niciun eveniment — poți propune să noteze unul, dar nu inventa nici sărbători, nici costuri.

Banii puși deoparte pentru un eveniment sunt o socoteală de planificare, nu un transfer: nu pleacă din surse, nu intră în registru și nu scad soldul. Spune asta ca atare și nu promite că muți bani. Un eveniment cu passed true are ediția trecută și încă neînchisă: banii strânși sunt ai ediției care a trecut, nu ai celei viitoare, iar omul o închide din ecranul „Evenimente viitoare” (Mai mult → Evenimente viitoare). Când omul cere să noteze un eveniment („pune-mi Crăciun 1200”, „ziua Anei pe 18 octombrie, vreo 400 de lei”), returnează un reading de fel planned-event. Nu confunda cu goal: obiectivul de economisire e o sumă de strâns fără dată de sărbătoare, evenimentul e o zi din calendar care va cere bani. Costul poate lipsi dacă nu s-a spus — lasă estimate necompletat, nu ghici cât costă Crăciunul unei familii.

Răspunde în română, natural, ca un asistent care își amintește conversația. Nu folosi markdown: fără **, # sau liste cu asteriscuri. Răspunsuri scurte, maximum 4-5 propoziții. Dacă enumeri, scrie 1. 2. 3. pe rânduri separate. Nu inventa sume. Nu pretinde că ai acces la conturi bancare. Contextul primit este un rezumat controlat (plicuri rămase, scadențe, datorii, totalul lunii), nu jurnalul de mișcări: nu inventa magazine, date sau sume care nu sunt în rezumat. Dacă utilizatorul întreabă de o mișcare anume pe care nu o vezi, spune că o poate căuta în Mișcări. Nu oferi recomandări de investiții, creditare sau decizii financiare riscante ca certitudini. Explică întotdeauna ce ai înțeles și ce urmează.

Răspunsul trebuie să fie JSON cu: reply (textul către utilizator), readings (lista de mai jos), intent (question|income|expense|debt|allocation|summary|next_step), needsConfirmation (boolean) și extracted (obiect opțional cu amount, title, category, debtName, monthlyPayment doar dacă au fost spuse clar).

readings este partea care ajunge efectiv în registrul omului, deci contează cel mai mult. Pune în ea, ca listă, TOT ce ai înțeles că trebuie înregistrat din mesaj — un mesaj poate conține mai multe lucruri deodată („fă-mi plic Alimente 2400 și salariul vine pe 7 octombrie” înseamnă două intrări). Fiecare element are un câmp kind și doar câmpurile felului său:
- expense: amount (număr, în lei), category (text), title (text scurt), date (AAAA-LL-ZZ)
- income: amount, title, date
- envelope: label, amount, category, weeklyLimit (dacă s-a spus o limită săptămânală), weeklyPace (boolean), amountIsWeekly (boolean: true doar dacă suma din amount este un ritm pe săptămână, nu totalul perioadei)
- debt: name, remaining (soldul rămas), monthly (rata lunară, dacă se știe)
- recurring: name, amount, dueDay (1-31), category
- goal: name, target, current (dacă s-a spus cât s-a strâns), dueDate
- planned-event: name, date (AAAA-LL-ZZ, ziua din calendar), estimate (costul estimat, dacă s-a spus), repeat ("yearly" pentru o sărbătoare care revine, "once" pentru ceva singular)
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
                    kind: { type: "STRING", enum: ["expense", "income", "envelope", "debt", "recurring", "goal", "planned-event", "payday"] },
                    amount: { type: "NUMBER" },
                    category: { type: "STRING" },
                    title: { type: "STRING" },
                    date: { type: "STRING" },
                    label: { type: "STRING" },
                    weeklyLimit: { type: "NUMBER" },
                    weeklyPace: { type: "BOOLEAN" },
                    amountIsWeekly: { type: "BOOLEAN" },
                    name: { type: "STRING" },
                    remaining: { type: "NUMBER" },
                    monthly: { type: "NUMBER" },
                    dueDay: { type: "NUMBER" },
                    target: { type: "NUMBER" },
                    current: { type: "NUMBER" },
                    dueDate: { type: "STRING" },
                    estimate: { type: "NUMBER" },
                    repeat: { type: "STRING", enum: ["once", "yearly"] },
                    flexDays: { type: "NUMBER" },
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
    status;
    quota;
    constructor(message, status, quota = { remaining: null, limit: null, resetAt: null }) {
        super(message);
        this.status = status;
        this.quota = quota;
    }
}
function sanitizeKey(raw) {
    const value = raw.trim().replace(/^['"]+|['"]+$/g, "").replace(/^Bearer\s+/i, "");
    if (!value || value === "pending" || value === "undefined" || value === "null")
        return "";
    return value;
}
function isInvalidKey(detail) {
    return /API[_ ]?key not valid|API_KEY_INVALID|invalid api key|API key expired|PERMISSION_DENIED|invalid_api_key|Incorrect API key/i.test(detail);
}
function buildContents(messages, context) {
    const contents = [];
    for (const message of messages) {
        const text = (message.text || "").trim();
        // Pozele de bon rămân pe telefon (Play Data safety). Ignorăm orice attachments din clienți vechi.
        if (!text)
            continue;
        const role = message.role === "assistant" ? "model" : "user";
        const parts = [{ text }];
        const last = contents[contents.length - 1];
        if (last && last.role === role) {
            const firstText = last.parts.find((part) => part.text);
            if (firstText?.text)
                firstText.text += `\n${text}`;
            else
                last.parts.push({ text });
        }
        else {
            contents.push({ role, parts });
        }
    }
    const contextText = `Context financiar controlat (nu divulga datele ca listă decât dacă utilizatorul cere): ${JSON.stringify(context)}`;
    if (!contents.length) {
        contents.push({ role: "user", parts: [{ text: contextText }] });
    }
    else if (contents[0].role === "user") {
        const firstText = contents[0].parts.find((part) => part.text);
        if (firstText?.text)
            firstText.text = `${contextText}\n\n${firstText.text}`;
        else
            contents[0].parts.unshift({ text: contextText });
    }
    else {
        contents.unshift({ role: "user", parts: [{ text: contextText }] });
    }
    return contents;
}
function parseGuideAnswer(raw) {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/u, "").trim();
    try {
        const parsed = JSON.parse(cleaned);
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
    }
    catch {
        /* răspuns liber de la model */
    }
    return {
        reply: cleaned || "Am analizat mesajul. Spune-mi ce vrei să facem în continuare.",
        intent: "question",
        needsConfirmation: false,
    };
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function parseDurationMs(raw) {
    const value = raw.trim().toLowerCase();
    if (!value)
        return null;
    if (/^\d+(\.\d+)?$/.test(value))
        return Number(value) * 1000;
    let ms = 0;
    const hours = value.match(/(\d+(?:\.\d+)?)h/);
    const minutes = value.match(/(\d+(?:\.\d+)?)m(?!s)/);
    const seconds = value.match(/(\d+(?:\.\d+)?)s/);
    if (hours)
        ms += Number(hours[1]) * 3_600_000;
    if (minutes)
        ms += Number(minutes[1]) * 60_000;
    if (seconds)
        ms += Number(seconds[1]) * 1000;
    return ms || null;
}
function nextPacificMidnight() {
    const now = Date.now();
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hourCycle: "h23" }).format(now));
    const minute = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", minute: "numeric" }).format(now));
    const msLeft = Math.max(60_000, ((23 - hour) * 60 + (60 - minute)) * 60_000);
    return new Date(now + msLeft).toISOString();
}
function quotaFrom(headers, detail = "", exhausted = false) {
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
async function callGemini(apiKey, contents) {
    let lastStatus = 0;
    let lastDetail = "";
    let lastQuota = { remaining: null, limit: null, resetAt: null };
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
                const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify(payload),
                });
                lastStatus = apiResponse.status;
                if (apiResponse.ok) {
                    const body = (await apiResponse.json());
                    const raw = body.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "{}";
                    return { answer: parseGuideAnswer(raw), source: "gemini", quota: quotaFrom(apiResponse.headers) };
                }
                lastDetail = await apiResponse.text();
                lastQuota = quotaFrom(apiResponse.headers, lastDetail, apiResponse.status === 429);
                if (isInvalidKey(lastDetail)) {
                    throw new GuideCallError("INVALID_API_KEY", apiResponse.status, quotaFrom(apiResponse.headers, lastDetail));
                }
                if (apiResponse.status === 404)
                    break;
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
async function callGroq(apiKey, contents) {
    let lastStatus = 0;
    let lastDetail = "";
    let lastQuota = { remaining: null, limit: null, resetAt: null };
    const messages = [
        { role: "system", content: systemInstruction },
        ...contents.map((item) => ({
            role: item.role === "model" ? "assistant" : "user",
            content: item.parts.flatMap((part) => {
                if (part.text)
                    return [{ type: "text", text: part.text }];
                if (part.inline_data?.mime_type.startsWith("image/")) {
                    return [{ type: "image_url", image_url: { url: `data:${part.inline_data.mime_type};base64,${part.inline_data.data}` } }];
                }
                if (part.inline_data)
                    return [{ type: "text", text: "[atașament PDF disponibil doar pentru modelul principal]" }];
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
                    const body = (await apiResponse.json());
                    return {
                        answer: parseGuideAnswer(body.choices?.[0]?.message?.content || "{}"),
                        source: "groq",
                        quota: quotaFrom(apiResponse.headers),
                    };
                }
                lastDetail = await apiResponse.text();
                lastQuota = quotaFrom(apiResponse.headers, lastDetail, apiResponse.status === 429);
                console.error("Groq error", model, structured ? "json" : "text", apiResponse.status, lastDetail.slice(0, 400));
                if (isInvalidKey(lastDetail)) {
                    throw new GuideCallError("INVALID_GROQ_KEY", apiResponse.status, quotaFrom(apiResponse.headers, lastDetail));
                }
                if (apiResponse.status === 404)
                    break;
                if (apiResponse.status === 400)
                    break;
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
async function generateGuide(contents, geminiKey, groqKey) {
    if (geminiKey) {
        try {
            return await callGemini(geminiKey, contents);
        }
        catch (error) {
            if (!groqKey)
                throw error;
            console.error("Gemini unavailable, trying Groq", error instanceof Error ? error.message.slice(0, 200) : "unknown");
        }
    }
    if (groqKey) {
        return await callGroq(groqKey, contents);
    }
    throw new GuideCallError("NO_GUIDE_PROVIDER", 503);
}
exports.aiGuide = (0, https_1.onRequest)({
    region: "europe-central2",
    invoker: "public",
    secrets: [geminiApiKey, groqApiKey],
    timeoutSeconds: 60,
    memory: "256MiB",
}, (request, response) => {
    allowCors(request, response, async () => {
        if (request.method === "OPTIONS") {
            response.status(204).send("");
            return;
        }
        if (request.method !== "POST") {
            response.status(405).json({ error: "Method not allowed" });
            return;
        }
        const body = (request.body || {});
        const messages = Array.isArray(body.messages) ? body.messages.slice(-20).map((message) => ({
            role: message.role,
            text: message.text,
        })) : [];
        const context = body.context || {};
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
        }
        catch (error) {
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
});
