import { db } from "./db";
import { whatsappAccounts, users } from "./schema";
import { eq } from "drizzle-orm";
import { getWallet, transferMoney, depositMoney } from "./wallet";
import { extractIntent, Intent } from "./ai";

// 4.6 & 5.9 Combined WhatsApp Flow
export async function handleWhatsAppMessage(from: string, text: string): Promise<string> {
    // 1. Identify User (Deterministic)
    const account = await db.query.whatsappAccounts.findFirst({
        where: eq(whatsappAccounts.phoneNumber, from),
    });

    if (!account) {
        return "Your phone number is not linked to a Bank account. Please log in to the web dashboard to link your WhatsApp.";
    }

    const userId = account.userId;

    // 2. AI Intent Extraction (Probabilistic Translation)
    const aiResponse: Intent = await extractIntent(text);

    // 3. Backend Validation Layer (Deterministic Execution)
    // Here we stay safe by verifying the AI's output

    switch (aiResponse.intent) {
        case "balance": {
            const wallet = await getWallet(userId);
            return `Your current balance is: ₦${wallet?.balance || "0.00"}`;
        }

        case "transfer": {
            const { amount, recipient } = aiResponse;

            // Strict Validations
            if (!amount || amount <= 0) return "Please specify a valid amount to send.";
            if (!recipient) return "Please specify a recipient email to send money to.";

            try {
                // Determine recipient by email (deterministic check)
                const receiver = await db.query.users.findFirst({
                    where: eq(users.email, recipient),
                });

                if (!receiver) return `Error: Recipient with email ${recipient} not found.`;
                if (receiver.id === userId) return "Error: You cannot send money to yourself.";

                // Execute Atomic Transfer (Step 3)
                const result = await transferMoney(userId, receiver.id, amount.toString());
                return `Transfer successful! ₦${amount} sent to ${recipient}. Ref: ${result.reference}`;
            } catch (error: any) {
                return `Transfer failed: ${error.message}`;
            }
        }

        case "fund": {
            const { amount } = aiResponse;
            if (!amount || amount <= 0) return "Please specify a valid amount to fund.";

            const reference = `WA-FUND-${Date.now()}`;
            try {
                await depositMoney(userId, amount.toString(), reference);
                const wallet = await getWallet(userId);
                return `Successfully funded ₦${amount}. New balance: ₦${wallet?.balance}`;
            } catch (error: any) {
                return `Funding failed: ${error.message}`;
            }
        }

        case "unknown":
        default:
            return aiResponse.reason
                ? `I couldn't process that: ${aiResponse.reason}`
                : "Sorry, I didn't understand that. Try saying something like 'What is my balance?' or 'Send 5000 to jay@email.com'.";
    }
}