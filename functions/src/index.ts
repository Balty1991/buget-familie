import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import cors from "cors";

const geminiApiKey = defineSecret("GEMINI_API_KEY");
const allowCors = cors({ origin: true });

type ChatMessage = { role: "user" | "assistant"; text: string };
type RequestBody = { messages?: ChatMessage[]; context?: Record<string, unknown> };

const systemInstruction = `Ești Copilotul Financiar al aplicației Buget Familie. Ești un ghid calm, empatic și foarte practic, care rămâne activ pe tot parcursul folosirii aplicației. Nu răspunde generic și nu redirecționa utilizatorul către meniuri fără explicație.

Rolul tău este să conduci conversația financiară în pași mici: (1) venituri și frecvența lor, (2) solduri disponibile, (3) datorii și rate, (4) cheltuieli fixe, (5) obiective, (6) repartizarea banilor în categorii, (7) urmărirea lunii. După configurare, verifică periodic situația, observă schimbări, pune întrebări de clarificare și propune următorul pas. Dacă utilizatorul spune o cheltuială sau un venit, extrage datele și cere confirmarea înainte de a salva. Dacă lipsește o informație, întreabă un singur lucru concret.

Răspunde în română, natural, ca un asistent care își amintește conversația. Nu inventa sume. Nu pretinde că ai acces la conturi bancare. Nu oferi recomandări de investiții, creditare sau decizii financiare riscante ca certitudini. Explică întotdeauna ce ai înțeles și ce urmează.`;

const jsonSchema = { type: "object", properties: { reply: { type: "string" }, intent: { type: "string", enum: ["question", "income", "expense", "debt", "allocation", "summary", "next_step"] }, needsConfirmation: { type: "boolean" }, extracted: { type: "object", properties: { amount: { type: "number" }, title: { type: "string" }, category: { type: "string" }, debtName: { type: "string" }, monthlyPayment: { type: "number" } }, required: ["amount", "title", "category", "debtName", "monthlyPayment"], additionalProperties: false } }, required: ["reply", "intent", "needsConfirmation", "extracted"], additionalProperties: false };

export const aiGuide = onRequest({ region: "europe-central2", invoker: "public", secrets: [geminiApiKey], timeoutSeconds: 60, memory: "256MiB" }, (request, response) => {
  allowCors(request, response, async () => {
    if (request.method !== "POST") { response.status(405).json({ error: "Method not allowed" }); return; }
    const body = (request.body || {}) as RequestBody;
    const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
    const context = body.context || {};
    if (!messages.length) { response.status(400).json({ error: "Conversation is required" }); return; }
    try {
      const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiApiKey.value())}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ system_instruction: { parts: [{ text: systemInstruction }] }, contents: [{ role: "user", parts: [{ text: `Context financiar controlat (nu divulga datele ca listă decât dacă utilizatorul cere): ${JSON.stringify(context)}` }] }, ...messages.map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.text }] }))], generationConfig: { temperature: 0.65, responseMimeType: "application/json", responseSchema: jsonSchema } }) });
      if (!apiResponse.ok) { const detail = await apiResponse.text(); console.error("Gemini error", apiResponse.status, detail.slice(0, 500)); response.status(502).json({ error: "Copilotul AI nu a putut răspunde acum." }); return; }
      const payload = await apiResponse.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const raw = payload.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      response.json(JSON.parse(raw));
    } catch (error) { console.error("AI guide failure", error); response.status(500).json({ error: "A apărut o problemă temporară. Încearcă din nou." }); }
  });
});
