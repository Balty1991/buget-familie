import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import cors from "cors";

const geminiApiKey = defineSecret("GEMINI_API_KEY");
const groqApiKey = defineSecret("GROQ_API_KEY");
const allowCors = cors({ origin: true });

type ChatAttachment = { name?: string; mimeType: string; data: string };
type ChatMessage = { role: "user" | "assistant"; text: string; attachments?: ChatAttachment[] };
type RequestBody = { messages?: ChatMessage[]; context?: Record<string, unknown> };
type GeminiPart = { text?: string; inline_data?: { mime_type: string; data: string } };
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };
type GuideAnswer = {
  reply: string;
  intent: "question" | "income" | "expense" | "debt" | "allocation" | "summary" | "next_step";
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

Rolul tău este să conduci conversația financiară în pași mici: (1) venituri și frecvența lor, (2) solduri disponibile, (3) datorii și rate, (4) cheltuieli fixe, (5) obiective, (6) repartizarea banilor în categorii, (7) urmărirea lunii. După configurare, verifică periodic situația, observă schimbări, pune întrebări de clarificare și propune următorul pas. Dacă utilizatorul spune o cheltuială sau un venit, extrage TOATE sumele în extracted. Pentru două salarii, pune items: [{amount, title}, {amount, title}] și amount = totalul. Dacă primești un atașament cu un bon românesc, analizează imaginea/PDF-ul direct, de sus în jos și apoi verifică zona de total: identifică magazinul, produsele lizibile, cantitatea și prețul fiecărui produs, data și categoria probabilă. Totalul cheltuielii trebuie să fie suma de la TOTAL, TOTAL DE PLATĂ, SUMA DE PLATĂ sau ECRAN/AMOUNT PAID; nu folosi subtotalul, TVA, economiile, numerarul primit, restul, numărul bonului sau un preț de produs. Dacă există mai multe totaluri, alege suma asociată explicit plății finale și verifică dacă este aproximativ egală cu suma produselor. Pentru un bon cu total identificabil, răspunde direct cu propunerea de cheltuială și completează extracted.amount, extracted.title, extracted.vendor, extracted.date, extracted.category, extracted.totalLabel, extracted.confidence și extracted.receiptLines; nu cere utilizatorului să transcrie bonul. Dacă totalul nu este lizibil, spune clar că nu îl poți confirma și cere o fotografie mai clară, fără să inventezi suma. needsConfirmation este true doar la prima propunere. După ce utilizatorul zice da, adaugă, creează sau înregistrează, needsConfirmation trebuie să fie false. Nu spune niciodată că ai salvat dacă needsConfirmation este true — salvarea o face aplicația, nu tu.

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
    const text = (message.text || "").trim();
    const attachments = Array.isArray(message.attachments) ? message.attachments.slice(0, 2) : [];
    if (!text && !attachments.length) continue;
    const role = message.role === "assistant" ? "model" : "user";
    const parts: GeminiPart[] = [];
    if (text) parts.push({ text });
    for (const attachment of attachments) {
      if (!attachment?.data || !/^data:|^[A-Za-z0-9+/=]+$/.test(attachment.data)) continue;
      const data = attachment.data.replace(/^data:[^;]+;base64,/, "");
      if (data.length > 8_000_000 || !/^image\/(jpeg|png|webp|heic|heif)$|^application\/pdf$/i.test(attachment.mimeType)) continue;
      parts.push({ inline_data: { mime_type: attachment.mimeType, data } });
    }
    if (!parts.length) continue;
    const last = contents[contents.length - 1];
    if (last && last.role === role && !attachments.length) {
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
  const messages = [
    { role: "system", content: systemInstruction },
    ...contents.map((item) => ({
      role: item.role === "model" ? "assistant" : "user",
      content: item.parts.map((part) => part.text || (part.inline_data ? "[atașament imagine/PDF]" : "")).join("\n"),
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

      const body = (request.body || {}) as RequestBody;
      const messages = Array.isArray(body.messages) ? body.messages.slice(-20).map((message) => ({
        ...message,
        attachments: Array.isArray(message.attachments) ? message.attachments.slice(0, 2) : undefined,
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
