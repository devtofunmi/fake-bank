import { generateText } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { z } from 'zod';
import { transferMoney, getBalance, depositMoney } from './wallet';
import { lookupUser } from './user';
import dotenv from 'dotenv';

dotenv.config();

/**
 * AI AGENT SERVICE
 */
export async function processAiMessage(phoneNumber: string, message: string) {
  console.log(`[AI] Processing message for ${phoneNumber}: "${message}"`);

  // Define tools as a plain object cast to any
  const bankTools: any = {
    checkBalance: {
      description: 'Get the user current balance',
      parameters: z.object({}),
      execute: async () => {
        console.log(`[Tool] Checking balance for ${phoneNumber}`);
        try {
          const res = await getBalance({ phoneNumber });
          return `Your balance is ₦${res.balance.toLocaleString()}.`;
        } catch (error: any) {
          return `Error: ${error.message}`;
        }
      },
    },
    transferMoney: {
      description: 'Transfer money to another user',
      parameters: z.object({
        targetPhone: z.string().describe('The phone number of the recipient'),
        amount: z.number().describe('The amount in naira'),
      }),
      execute: async ({ targetPhone, amount }: { targetPhone: string; amount: number }) => {
        console.log(`[Tool] Transferring ₦${amount} from ${phoneNumber} to ${targetPhone}`);
        try {
          const res = await transferMoney({ senderPhone: phoneNumber, receiverPhone: targetPhone, amount });
          return `Success! ₦${amount} sent to ${targetPhone}. New balance: ₦${res.newBalance}`;
        } catch (error: any) {
          return `Error Transferring: ${error.message}`;
        }
      },
    },
    depositFunds: {
      description: 'Deposit money',
      parameters: z.object({
        amount: z.number().describe('Amount in naira'),
      }),
      execute: async ({ amount }: { amount: number }) => {
        console.log(`[Tool] Depositing ₦${amount} for ${phoneNumber}`);
        try {
          const res = await depositMoney({ phoneNumber, amount });
          return `Success! Deposited ₦${amount}. New balance: ₦${res.newBalance}`;
        } catch (error: any) {
          return `Error Depositing: ${error.message}`;
        }
      },
    },
    searchUser: {
      description: 'Look up a user by phone number',
      parameters: z.object({
        targetPhone: z.string().describe('Phone number to check'),
      }),
      execute: async ({ targetPhone }: { targetPhone: string }) => {
        console.log(`[Tool] Looking up user ${targetPhone}`);
        try {
          const user = await lookupUser({ phoneNumber: targetPhone });
          return user ? `User ${user.name || 'Found'} exists.` : `User not found.`;
        } catch (error: any) {
          return `Error: ${error.message}`;
        }
      },
    },
  };

  try {
    const { text } = await generateText({
      model: gateway('xai/grok-4.1-fast-non-reasoning'),
      system: `You are a helpful banking assistant named "Jay🤓". 
      The user's phone number is ${phoneNumber}.

      GREETING RULE:
      If the user greets you or says "hi", you MUST respond with:
      "Hello! I'm your bank assistant. How can I help you today? You can ask me to check your balance, transfer money, deposit funds, or look up another user by phone number. What would you like to do? 😊"

      TOOL USAGE RULES:
      1. For ANY banking request (balance, transfer, deposit, lookup), you MUST call the tool first.
      2. If you need a phone number and the user didn't provide it, ASK for it.
      3. Summarize tool results in a friendly way.`,
      prompt: message,
      tools: bankTools,
      maxSteps: 5,
    } as any);

    console.log(`[AI] Response: "${text}"`);
    return text;
  } catch (error: any) {
    console.error('[AI Error]', error);
    throw error;
  }
}
