import { generateText } from "ai";
import { config, buildSystemPrompt } from "./config";
import { createBankingTools, type BankingToolContext } from "./tools";
import type { ChatMessage } from "./types";
import { lookupUser } from "./user";
import {
  getConversation,
  addMessage,
  needsSummarization,
  setSummaryAndTrim,
} from "./memory";

/**
 * AI SDK implementation for generating responses
 */
async function generateAISDKResponse(
  messages: ChatMessage[],
  phoneNumber: string,
  existingSummary?: string | null,
): Promise<string> {
  // Fetch current user state
  const user = await lookupUser({ phoneNumber });
  if (!user) throw new Error("User context missing");

  // Build system prompt with user context and summary
  const systemPrompt = buildSystemPrompt(
    phoneNumber,
    user.name,
    user.email,
    existingSummary,
  );

  const bankingTools = createBankingTools(phoneNumber);

  console.log(`[AI] Sending ${messages.length} messages to model`);

  const result = await generateText({
    model: config.model,
    system: systemPrompt,
    messages: messages,
    tools: bankingTools,
    maxSteps: config.maxSteps,
    experimental_context: { phoneNumber } as BankingToolContext,
  } as any);

  console.log(
    `[AI] Response: "${result.text}" | Steps: ${result.steps.length}`,
  );

  // If response is empty but tools were called, extract tool results for response
  if (!result.text && result.steps.length > 0) {
    const lastStep = result.steps[result.steps.length - 1];
    if (lastStep.toolResults && lastStep.toolResults.length > 0) {
      const toolResultObj = lastStep.toolResults[0] as any;
      const toolResult = toolResultObj.output || toolResultObj.result || "";
      console.log(`[AI] Using tool result as response: "${toolResult}"`);
      // Generate a friendly response based on tool result
      if (typeof toolResult === "string" && toolResult.startsWith("Success!")) {
        // Re-fetch user to get updated info
        const updatedUser = await lookupUser({ phoneNumber });
        if (updatedUser?.name && !updatedUser?.email) {
          return `Great, ${updatedUser.name}! Now, what's your email address?`;
        } else if (updatedUser?.name && updatedUser?.email) {
          return `Perfect! Your profile is complete, ${updatedUser.name}. How can I help you today? (Balance, Transfer, Deposit, Lookup) 😊`;
        }
        return toolResult;
      }
      return String(toolResult);
    }
  }

  return result.text;
}

/**
 * Summarize conversation using AI SDK
 */
async function summarizeConversationAISDK(
  messages: ChatMessage[],
  existingSummary?: string | null,
): Promise<string> {
  // Format messages for summarization
  const conversationText = messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  // Include existing summary if present
  let promptContent = conversationText;
  if (existingSummary) {
    promptContent = `Existing summary to incorporate:\n${existingSummary}\n\nNew conversation to add:\n${conversationText}`;
  }

  const { text } = await generateText({
    model: config.model,
    system: config.summarizationPrompt,
    prompt: promptContent,
  });

  return text;
}

/**
 * Main export - generate AI response for banking assistant
 */
export async function generateAIResponse(
  messages: ChatMessage[],
  phoneNumber: string,
  existingSummary?: string | null,
): Promise<string> {
  console.log(`[AI] Processing message for ${phoneNumber}`);
  return generateAISDKResponse(messages, phoneNumber, existingSummary);
}

/**
 * Summarize a chunk of conversation
 */
export async function summarizeConversation(
  messages: ChatMessage[],
  existingSummary?: string | null,
): Promise<string> {
  return summarizeConversationAISDK(messages, existingSummary);
}

/**
 * Legacy function for backward compatibility
 * Converts single message to ChatMessage array format
 * NOW WITH MEMORY SUPPORT
 */
export async function processAiMessage(
  phoneNumber: string,
  message: string,
): Promise<string> {
  // Get existing conversation from memory
  const { messages: history, summary } = getConversation(phoneNumber);

  // Add the new user message to memory
  addMessage(phoneNumber, "user", message);

  // Build full message history for the AI
  const messages: ChatMessage[] = [
    ...history,
    { role: "user", content: message },
  ];

  // Generate response with conversation context
  const response = await generateAIResponse(messages, phoneNumber, summary);

  // Store assistant response in memory
  if (response) {
    addMessage(phoneNumber, "assistant", response);
  }

  // Check if we need to summarize (too many messages)
  if (needsSummarization(phoneNumber)) {
    console.log(`[AI] Conversation too long, summarizing...`);
    const { messages: currentMessages, summary: currentSummary } =
      getConversation(phoneNumber);
    const newSummary = await summarizeConversation(
      currentMessages,
      currentSummary,
    );
    setSummaryAndTrim(phoneNumber, newSummary);
  }

  return response;
}
