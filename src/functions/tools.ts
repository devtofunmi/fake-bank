/**
 * BANKING TOOLS
 *
 * Tool definitions for AI agent banking operations
 */
import { tool } from "ai";
import { z } from "zod";
import { transferMoney, getBalance, depositMoney } from "./wallet";
import { updateUser, lookupUser } from "./user";

/**
 * Tool context passed via experimental_context
 */
export interface BankingToolContext {
  phoneNumber: string;
}

/**
 * Create banking tools with the given phone number context
 */
export function createBankingTools(phoneNumber: string) {
  return {
    setUserName: tool({
      description:
        "Set the user's full name. Call this when the user provides their name.",
      inputSchema: z.object({
        name: z
          .string()
          .describe(
            "The full name provided by the user. Must be the exact text the user sent.",
          ),
      }),
      execute: async ({ name }, { experimental_context }) => {
        console.log(`[Tool] setUserName called with name:`, name);

        if (!name || name === "undefined" || name === "") {
          console.log(`[Tool] ERROR: name is empty or invalid`);
          return "Error: You called the tool without a valid name. Please extract the name from the user's last message and try again.";
        }
        console.log(`[Tool] Setting name for ${phoneNumber}: "${name}"`);
        await updateUser({ phoneNumber, name });
        return `Success! Name has been set to: ${name}`;
      },
    }),

    setUserEmail: tool({
      description: "Set the user email address",
      inputSchema: z.object({
        email: z
          .string()
          .email()
          .describe("The email address provided by the user"),
      }),
      execute: async ({ email }) => {
        console.log(`[Tool] setUserEmail called with email:`, email);
        if (!email || email === "undefined") {
          return "Error: You called the tool without a valid email. Please try again and extract the email from the user's message.";
        }
        console.log(`[Tool] Setting email for ${phoneNumber}: "${email}"`);
        await updateUser({ phoneNumber, email });
        return `Success! Email set to: ${email}`;
      },
    }),

    checkBalance: tool({
      description: "Get the user current balance",
      inputSchema: z.object({}),
      execute: async () => {
        console.log(`[Tool] Checking balance for ${phoneNumber}`);
        try {
          const res = await getBalance({ phoneNumber });
          return `Your balance is ₦${res.balance.toLocaleString()}.`;
        } catch (error: any) {
          return `Error: ${error.message}`;
        }
      },
    }),

    transferMoney: tool({
      description: "Transfer money to another user",
      inputSchema: z.object({
        targetPhone: z.string().describe("The phone number of the recipient"),
        amount: z.number().describe("The amount in naira"),
      }),
      execute: async ({ targetPhone, amount }) => {
        console.log(
          `[Tool] Transferring ₦${amount} from ${phoneNumber} to ${targetPhone}`,
        );
        try {
          const res = await transferMoney({
            senderPhone: phoneNumber,
            receiverPhone: targetPhone,
            amount,
          });
          return `Success! ₦${amount} sent to ${targetPhone}. New balance: ₦${res.newBalance}`;
        } catch (error: any) {
          return `Error Transferring: ${error.message}`;
        }
      },
    }),

    depositFunds: tool({
      description: "Deposit money",
      inputSchema: z.object({
        amount: z.number().describe("Amount in naira"),
      }),
      execute: async ({ amount }) => {
        console.log(`[Tool] Depositing ₦${amount} for ${phoneNumber}`);
        try {
          const res = await depositMoney({ phoneNumber, amount });
          return `Success! Deposited ₦${amount}. New balance: ₦${res.newBalance}`;
        } catch (error: any) {
          return `Error Depositing: ${error.message}`;
        }
      },
    }),

    searchUser: tool({
      description: "Look up a user by phone number",
      inputSchema: z.object({
        targetPhone: z.string().describe("Phone number to check"),
      }),
      execute: async ({ targetPhone }) => {
        console.log(`[Tool] Looking up user ${targetPhone}`);
        try {
          const user = await lookupUser({ phoneNumber: targetPhone });
          return user
            ? `User ${user.name || "Found"} exists.`
            : `User not found.`;
        } catch (error: any) {
          return `Error: ${error.message}`;
        }
      },
    }),
  };
}