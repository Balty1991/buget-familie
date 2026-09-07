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
const allowCors = (0, cors_1.default)({ origin: true });
const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
const systemInstruction = `Ești Copilotul Financiar al aplicației Buget Familie. Ești un ghid calm, empatic și foarte practic, care rămâne activ pe tot parcursul folosirii aplicației. Nu răspunde generic și nu redirecționa utilizatorul către meniuri fără explicație.

Rolul tău este să conduci conversația financiară în pași mici: (1) venituri și frecvența lor, (2) solduri disponibile, (3) datorii și rate, (4) cheltuieli fixe, (5) obiective, (6) repartizarea banilor în categorii, (7) urmărirea lunii. După configurare, verifică periodic situația, observă schimbări, pune întrebări de clarificare și propune următorul pas. Dacă utilizatorul spune o cheltuială sau un venit, extrage datele și cere confirmarea înainte de a salva. Dacă lipsește o informație, întreabă un singur lucru concret.

Răspunde în română, natural, ca un asistent care își amintește conversația. Nu inventa sume. Nu pretinde că ai acces la conturi bancare. Nu oferi recomandări de investiții, creditare sau decizii financiare riscante ca certitudini. Explică întotdeauna ce ai înțeles și ce urmează.

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
class GeminiCallError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}
function sanitizeKey(raw) {
    return raw.trim().replace(/^['"]+|['"]+$/g, "").replace(/^Bearer\s+/i, "");
}
function isInvalidKey(detail) {
    return /API[_ ]?key not valid|API_KEY_INVALID|invalid api key|API key expired|PERMISSION_DENIED/i.test(detail);
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
    for (const model of MODELS) {
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
            for (let attempt = 0; attempt < 3; attempt++) {
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
                console.error("Gemini error", model, structured ? "schema" : "text", apiResponse.status, lastDetail.slice(0, 500));
                if (isInvalidKey(lastDetail)) {
                    throw new GeminiCallError("INVALID_API_KEY", apiResponse.status);
                }
                if (apiResponse.status === 404)
                    break;
                if (apiResponse.status === 429 || apiResponse.status === 503) {
                    const retryAfter = Number(apiResponse.headers.get("retry-after"));
                    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1200 * (attempt + 1);
                    await sleep(Math.min(waitMs, 8000));
                    continue;
                }
                break;
            }
        }
    }
    throw new GeminiCallError(lastDetail.slice(0, 300) || "GEMINI_UPSTREAM_ERROR", lastStatus);
}
exports.aiGuide = (0, https_1.onRequest)({
    region: "europe-central2",
    invoker: "public",
    secrets: [geminiApiKey],
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
        const apiKey = sanitizeKey(geminiApiKey.value() || "");
        if (!apiKey) {
            response.status(503).json({
                error: "Copilotul AI nu este configurat. Lipsește cheia Gemini.",
                code: "gemini_key",
            });
            return;
        }
        try {
            const answer = await callGemini(apiKey, buildContents(messages, context));
            response.json(answer);
        }
        catch (error) {
            const err = error instanceof GeminiCallError ? error : new GeminiCallError("unknown", 500);
            console.error("AI guide failure", err.message.slice(0, 500));
            if (err.message === "INVALID_API_KEY") {
                response.status(503).json({
                    error: "Cheia Gemini nu este validă. Folosește o cheie din Google AI Studio, nu cheia web Firebase.",
                    code: "gemini_key",
                    upstreamStatus: err.status,
                });
                return;
            }
            response.status(502).json({
                error: "Copilotul AI nu a putut răspunde acum.",
                code: "gemini_upstream",
                upstreamStatus: err.status,
            });
        }
    });
});
