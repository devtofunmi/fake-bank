import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { transferMoney, getBalance, depositMoney } from './wallet';
import { lookupUser } from './user';
import dotenv from 'dotenv';

dotenv.config();


/**
 * Processes incoming messages using an AI model to determine intent.
 */
export async function processAiMessage(phoneNumber: string, message: string) {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is missing in environmental variables');
  }

  const result = await generateText({
    model: google('xai/grok-4.1-fast-non-reasoning'),
    system: `You are a helpful bank assistant. The user's phone number is ${phoneNumber}. 
    You can help with transfers, checking balance, and depositing money. 
    Always confirm details before performing actions if they are ambiguous.
    Money is handled as naira/kobo, but users talk in naira.`,
    prompt: message,
    tools: {
      getBalance: {
        description: 'Get the user balance',
        parameters: z.object({}),
        execute: async () => {
          const res = await getBalance({ phoneNumber });
          return JSON.stringify(res);
        },
      } as any,
      transfer: {
        description: 'Transfer money to another user by phone number',
        parameters: z.object({
          receiverPhone: z.string().describe('The phone number of the receiver'),
          amount: z.number().describe('The amount in naira to transfer'),
        }),
        execute: async ({ receiverPhone, amount }: { receiverPhone: string; amount: number }) => {
          try {
            const res = await transferMoney({ senderPhone: phoneNumber, receiverPhone, amount });
            return JSON.stringify(res);
          } catch (error: any) {
            return JSON.stringify({ error: error.message });
          }
        },
      } as any,
      deposit: {
        description: 'Deposit money into the user account',
        parameters: z.object({
          amount: z.number().describe('The amount in naira to deposit'),
        }),
        execute: async ({ amount }: { amount: number }) => {
          const res = await depositMoney({ phoneNumber, amount });
          return JSON.stringify(res);
        },
      } as any,
      lookupUser: {
        description: 'Lookup a user by phone number',
        parameters: z.object({
          phone: z.string(),
        }),
        execute: async ({ phone }: { phone: string }) => {
          const user = await lookupUser({ phoneNumber: phone });
          return user ? JSON.stringify({ found: true, name: user.name }) : JSON.stringify({ found: false });
        },
      } as any,
    },
    maxSteps: 5,
  } as any);

  return result.text;
}