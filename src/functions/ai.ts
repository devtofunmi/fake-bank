/**
 * AI INTENT EXTRACTION LAYER
 * 
 * Translates natural language messages into structured API calls.
 * Acts as a bridge between human input and the Banking Engine's logic.
 */
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { transferMoney, getBalance, depositMoney } from './wallet';
import { lookupUser } from './user';

/**
 * Processes incoming messages using an AI model to determine intent.
 */
export async function processAiMessage(phoneNumber: string, message: string) {
  const options: any = {
    // Model selection for processing.
    model: google('gemini-1.5-flash'),
    
    // System prompt defining the AI's role, context, and operational rules.
    system: `You are a helpful bank assistant. The user's phone number is ${phoneNumber}. 
    You can help with transfers, checking balance, and depositing money. 
    Always confirm details before performing actions if they are ambiguous.
    Money is handled as naira/kobo, but users talk in naira.`,
    
    prompt: message,
    
    /**
     * AI TOOLS
     * Set of functions the AI can invoke based on identified intent.
     * Arguments are extracted from the user's message and validated using Zod.
     */
    tools: {
      getBalance: {
        description: 'Get the user balance',
        parameters: z.object({}),
        execute: async () => {
          const res = await getBalance({ phoneNumber });
          return JSON.stringify(res);
        },
      },
      transfer: {
        description: 'Transfer money to another user by phone number',
        parameters: z.object({
          receiverPhone: z.string().describe('The phone number of the receiver'),
          amount: z.number().describe('The amount in naira to transfer'),
        }),
        execute: async ({ receiverPhone, amount }: { receiverPhone: string; amount: number }) => {
          // Extracts amount and recipient phone number to trigger the banking engine.
          try {
            const res = await transferMoney({ senderPhone: phoneNumber, receiverPhone, amount });
            return JSON.stringify(res);
          } catch (error: any) {
            return JSON.stringify({ error: error.message });
          }
        },
      },
      deposit: {
        description: 'Deposit money into the user account',
        parameters: z.object({
          amount: z.number().describe('The amount in naira to deposit'),
        }),
        execute: async ({ amount }: { amount: number }) => {
          const res = await depositMoney({ phoneNumber, amount });
          return JSON.stringify(res);
        },
      },
      lookupUser: {
        description: 'Lookup a user by phone number',
        parameters: z.object({
          phone: z.string(),
        }),
        execute: async ({ phone }: { phone: string }) => {
          const user = await lookupUser({ phoneNumber: phone });
          return user ? JSON.stringify({ found: true, name: user.name }) : JSON.stringify({ found: false });
        },
      },
    },
    // Maximum number of reasoning steps the AI can perform per request.
    maxSteps: 5,
  };

  /**
   * AI execution and multi-step tool invocation.
   */
  const result = await generateText(options);

  // Return generated response text.
  return result.text;
}
