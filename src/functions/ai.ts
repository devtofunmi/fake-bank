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
    setUserName: {
        description: 'Set the user full name',
        parameters: z.object({
            name: z.string().describe('The full name provided by the user'),
        }),
        execute: async (args: { name: string }) => {
            console.log(`[Tool] setUserName called with args:`, JSON.stringify(args));
            const { name } = args;
            if (!name || name === 'undefined') {
                 return "Error: You called the tool without a valid name. Please try again and extract the name from the user's message.";
            }
            console.log(`[Tool] Setting name for ${phoneNumber}: "${name}"`);
            await updateUser({ phoneNumber, name });
            return `Success! Name set to: ${name}`;
        }
    },
    setUserEmail: {
        description: 'Set the user email address',
        parameters: z.object({
            email: z.string().email().describe('The email address provided by the user'),
        }),
        execute: async (args: { email: string }) => {
            console.log(`[Tool] setUserEmail called with args:`, JSON.stringify(args));
             const { email } = args;
            if (!email || email === 'undefined') {
                 return "Error: You called the tool without a valid email. Please try again and extract the email from the user's message.";
            }
            console.log(`[Tool] Setting email for ${phoneNumber}: "${email}"`);
            await updateUser({ phoneNumber, email });
            return `Success! Email set to: ${email}`;
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
    const result = await generateText({
      model: gateway('xai/grok-4.1-fast-non-reasoning'),
      system: `You are a helpful banking assistant named "Jay🤓". 
      
      CURRENT USER PROFILE:
      - Phone: ${phoneNumber}
      - Name: ${user.name || 'Unknown'}
      - Email: ${user.email || 'Unknown'}

      EXTRACTION RULE:
      When asking for Name or Email, users often reply with just the value (e.g., "John" or "john@gmail.com").
      You MUST capture this value and pass it to the 'setUserName' or 'setUserEmail' tool.
      
      ONBOARDING FLOW:
      1. IF Name is 'Unknown': Ask "What is your full name?" -> User replies -> Call setUserName(name="...")
      2. IF Email is 'Unknown': Ask "What is your email?" -> User replies -> Call setUserEmail(email="...")

      EXAMPLES:
      User: "Olamide"
      Assistant: [Tool Call] setUserName({ name: "Olamide" })

      User: "My email is test@gmail.com"
      Assistant: [Tool Call] setUserEmail({ email: "test@gmail.com" })

      GREETING RULE:
      If the user says "hi" or greets you:
      - If profile is INCOMPLETE: "Hello! Welcome to Fake Bank. I see you're new here. To get started, may I have your full name?"
      - If profile is COMPLETE: "Hello ${user.name}! I'm your bank assistant. How can I help you today? (Balance, Transfer, Deposit, Lookup) 😊"

      TOOL USAGE RULES:
      1. For ANY banking request (balance, transfer, deposit, lookup) OR profile update, you MUST call the tool first.
      2. If you need a phone number/amount and it's missing, ASK for it.`,
      prompt: message,
      tools: bankTools,
      maxSteps: 5,
    } as any);

    const { text } = result;

    console.log(`[AI] Response: "${text}" | Steps: ${result.steps.length}`);
    return text;
  } catch (error: any) {
    console.error('[AI Error]', error);
    throw error;
  }
}
