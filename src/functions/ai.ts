import { generateText } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { z } from 'zod';
import { transferMoney, getBalance, depositMoney } from './wallet';
import { updateUser, lookupUser } from './user';
import dotenv from 'dotenv';

dotenv.config();

/**
 * AI AGENT SERVICE
 */
export async function processAiMessage(phoneNumber: string, message: string) {
  console.log(`[AI] Processing message for ${phoneNumber}: "${message}"`);
  
  // Fetch current user state to inform the AI
  const user = await lookupUser({ phoneNumber });
  if (!user) throw new Error('User context missing');

  // Define tools as a plain object cast to any
  const bankTools: any = {
    updateProfile: {
        description: 'Update the user name or email',
        parameters: z.object({
            name: z.string().optional(),
            email: z.string().email().optional(),
        }),
        execute: async ({ name, email }: { name?: string, email?: string }) => {
            console.log(`[Tool] Updating profile for ${phoneNumber}: Name="${name}", Email="${email}"`);
            try {
                await updateUser({ phoneNumber, name, email });
                return `Success! Profile updated. Name: ${name || user.name}, Email: ${email || user.email}`;
            } catch (error: any) {
                return `Error updating profile: ${error.message}`;
            }
        }
    },
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
      
      CURRENT USER PROFILE:
      - Phone: ${phoneNumber}
      - Name: ${user.name || 'Unknown'}
      - Email: ${user.email || 'Unknown'}

      ONBOARDING RULE (CRITICAL):
      If the user's Name or Email is 'Unknown', you MUST ask them for these details before processing other banking requests.
      - If they provide their name, use the 'updateProfile' tool to save it.
      - If they provide their email, use the 'updateProfile' tool to save it.
      - Be polite but firm: "I need to set up your profile first."

      GREETING RULE:
      If the user says "hi" or greets you:
      - If profile is INCOMPLETE: "Hello! Welcome to Fake Bank. I see you're new here. To get started, may I have your full name?"
      - If profile is COMPLETE: "Hello ${user.name}! I'm your bank assistant. How can I help you today? (Balance, Transfer, Deposit, Lookup) 😊"

      TOOL USAGE RULES:
      1. For ANY banking request (balance, transfer, deposit, lookup) OR profile update, you MUST call the tool first.
      2. If you need a phone number/amount and it's missing, ASK for it.
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
