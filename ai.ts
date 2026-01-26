import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export interface Intent {
    intent: "transfer" | "balance" | "fund" | "unknown";
    amount?: number;
    recipient?: string;
    reason?: string;
}

const SYSTEM_PROMPT = `
You are a banking intent extraction engine. 
Your goal is to parse user messages into structured JSON.
You must follow these rules strictly:
1. ONLY return JSON. No greeting, no explanation.
2. If the user wants to see balance, intent is "balance".
3. If the user wants to send/transfer money, intent is "transfer". Extract "amount" (number) and "recipient" (email or name).
4. If the user wants to fund/deposit, intent is "fund". Extract "amount" (number).
5. DO NOT assume amounts. If the user says "send money to Jay", set intent to "unknown" and reason to "missing amount".
6. DO NOT assume recipients. If the user says "send 5000", set intent to "unknown" and reason to "missing recipient".
7. If you are unsure, set intent to "unknown".

Example Inputs -> Outputs:
"What is my balance?" -> {"intent": "balance"}
"Send 5000 to jay@email.com" -> {"intent": "transfer", "amount": 5000, "recipient": "jay@email.com"}
"I want to fund 1000" -> {"intent": "fund", "amount": 1000}
"Send some cash to Jay" -> {"intent": "unknown", "reason": "amount not specified"}
`;

export async function extractIntent(message: string): Promise<Intent> {
    try {
        const result = await model.generateContent([SYSTEM_PROMPT, message]);
        const response = await result.response;
        const text = response.text().trim();

        // Clean JSON from potential markdown blocks
        const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();

        return JSON.parse(cleanJson) as Intent;
    } catch (error) {
        console.error("AI Extraction Error:", error);
        return { intent: "unknown", reason: "error processing request" };
    }
}