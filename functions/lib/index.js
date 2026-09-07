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
const GROQ_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
const systemInstruction = `Ești Copilotul Financiar al aplicației Buget Familie. Ești un ghid calm, empatic și foarte practic, care rămâne activ pe tot parcursul folosirii aplicației. Nu răspunde generic și nu redirecționa utilizatorul către meniuri fără explicație.

Rolul tău este să conduci conversația financiară în pași mici: (1) venituri și frecvența lor, (2) solduri disponibile, (3) datorii și rate, (4) cheltuieli fixe, (5) obiective, (6) repartizarea banilor în categorii, (7) urmărirea lunii. După configurare, verifică periodic situația, observă schimbări, pune întrebări de clarificare și propune următorul pas. Dacă utilizatorul spune o cheltuială sau un venit, extrage datele și cere confirmarea înainte de a salva. Dacă lipsește o informație, întreabă un singur lucru concret.

Răspunde în română, natural, ca un asistent care își amintește conversația. Nu folosi markdown: fără **, # sau liste cu asteriscuri. Răspunsuri scurte, maximum 4-5 propoziții. Dacă enumeri, scrie 1. 2. 3. pe rânduri separate. Nu inventa sume. Nu pretinde că ai acces la conturi bancare. Nu oferi recomandări de investiții, creditare sau decizii financiare riscante ca certitudini. Explică întotdeauna ce ai înțeles și ce urmează.

Răspunsul trebuie să fie JSON cu: reply (textul către utilizator), intent (question|income|expense|debt|allocation|summary|next_step), needsConfirmation (boolean) și extracted (obiect opțional cu amount, title, category, debtName, monthlyPayment doar dacă au fost spuse clar).`;
const responseSchema = {
    type: "OBJECT",
    properties: {
        reply: { type: "STRING" },
        intent: {
            type: "STRING",
            enum: ["question", "income", "expense", "debt", "allocation", "summary", "next_step"],
        },
        needsConfirmation: { type: "BOOLEAN" },
        extracted: {
            type: "OBJECT",
            properties: {
                amount: { type: "NUMBER" },
                title: { type: "STRING" },
                category: { type: "STRING" },
                debtName: { type: "STRING" },
                monthlyPayment: { type: "NUMBER" },
            },
        },
    },
    required: ["reply", "intent", "needsConfirmation"],
};
class GuideCallError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.status = status;
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
        if (!text)
            continue;
        const role = message.role === "assistant" ? "model" : "user";
        const last = contents[contents.length - 1];
        if (last && last.role === role) {
            last.parts[0].text += `\n${text}`;
        }
        else {
            contents.push({ role, parts: [{ text }] });
        }
    }
    const contextText = `Context financiar controlat (nu divulga datele ca listă decât dacă utilizatorul cere): ${JSON.stringify(context)}`;
    if (!contents.length) {
        contents.push({ role: "user", parts: [{ text: contextText }] });
    }
    else if (contents[0].role === "user") {
        contents[0].parts[0].text = `${contextText}\n\n${contents[0].parts[0].text}`;
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
async function callGemini(apiKey, contents) {
    let lastStatus = 0;
    let lastDetail = "";
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
                    return parseGuideAnswer(raw);
                }
                lastDetail = await apiResponse.text();
                console.error("Gemini error", model, structured ? "schema" : "text", apiResponse.status, lastDetail.slice(0, 400));
                if (isInvalidKey(lastDetail)) {
                    throw new GuideCallError("INVALID_API_KEY", apiResponse.status);
                }
                if (apiResponse.status === 404)
                    break;
                if (apiResponse.status === 429 || apiResponse.status === 503) {
                    if (attempt === 0) {
                        await sleep(800);
                        continue;
                    }
                    break;
                }
                break;
            }
        }
    }
    throw new GuideCallError(lastDetail.slice(0, 300) || "GEMINI_UPSTREAM_ERROR", lastStatus);
}
async function callGroq(apiKey, contents) {
    let lastStatus = 0;
    let lastDetail = "";
    const messages = [
        { role: "system", content: systemInstruction },
        ...contents.map((item) => ({
            role: item.role === "model" ? "assistant" : "user",
            content: item.parts.map((part) => part.text).join("\n"),
        })),
    ];
    for (const model of GROQ_MODELS) {
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
                    response_format: { type: "json_object" },
                }),
            });
            lastStatus = apiResponse.status;
            if (apiResponse.ok) {
                const body = (await apiResponse.json());
                return parseGuideAnswer(body.choices?.[0]?.message?.content || "{}");
            }
            lastDetail = await apiResponse.text();
            console.error("Groq error", model, apiResponse.status, lastDetail.slice(0, 400));
            if (isInvalidKey(lastDetail)) {
                throw new GuideCallError("INVALID_GROQ_KEY", apiResponse.status);
            }
            if (apiResponse.status === 404)
                break;
            if (apiResponse.status === 429 || apiResponse.status === 503) {
                await sleep(700 * (attempt + 1));
                continue;
            }
            break;
        }
    }
    throw new GuideCallError(lastDetail.slice(0, 300) || "GROQ_UPSTREAM_ERROR", lastStatus);
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
        const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
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
            const answer = await generateGuide(buildContents(messages, context), geminiKey, groqKey);
            response.json(answer);
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
            response.status(502).json({
                error: "Copilotul AI nu a putut răspunde acum.",
                code: "guide_upstream",
                upstreamStatus: err.status,
            });
        }
    });
});
