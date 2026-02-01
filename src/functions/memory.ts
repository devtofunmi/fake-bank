/**
 * CONVERSATION MEMORY
 *
 * Redis-like in-memory storage for chat history.
 * Supports TTL, max message limits, and conversation summarization.
 */
import type { ChatMessage } from "./types";

interface ConversationEntry {
  messages: ChatMessage[];
  summary: string | null;
  createdAt: number;
  lastAccessedAt: number;
  ttl: number; // Time to live in milliseconds
}

// In-memory store (Redis-like)
const conversationStore = new Map<string, ConversationEntry>();

// Configuration
const CONFIG = {
  DEFAULT_TTL: 30 * 60 * 1000, // 30 minutes
  MAX_MESSAGES: 20, // Keep last 20 messages before summarizing
  CLEANUP_INTERVAL: 5 * 60 * 1000, // Cleanup every 5 minutes
};

/**
 * Start periodic cleanup of expired conversations
 */
let cleanupTimer: NodeJS.Timeout | null = null;

export function startMemoryCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of conversationStore.entries()) {
      if (now - entry.lastAccessedAt > entry.ttl) {
        conversationStore.delete(key);
        console.log(`[Memory] Expired conversation for ${key}`);
      }
    }
  }, CONFIG.CLEANUP_INTERVAL);
}

export function stopMemoryCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/**
 * Get conversation history for a phone number
 */
export function getConversation(phoneNumber: string): {
  messages: ChatMessage[];
  summary: string | null;
} {
  const entry = conversationStore.get(phoneNumber);
  if (!entry) {
    return { messages: [], summary: null };
  }

  // Update last accessed time (touch)
  entry.lastAccessedAt = Date.now();
  return { messages: entry.messages, summary: entry.summary };
}

/**
 * Add a message to conversation history
 */
export function addMessage(
  phoneNumber: string,
  role: "user" | "assistant",
  content: string,
): void {
  let entry = conversationStore.get(phoneNumber);

  if (!entry) {
    entry = {
      messages: [],
      summary: null,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      ttl: CONFIG.DEFAULT_TTL,
    };
    conversationStore.set(phoneNumber, entry);
  }

  entry.messages.push({ role, content });
  entry.lastAccessedAt = Date.now();

  console.log(
    `[Memory] Added ${role} message for ${phoneNumber}. Total: ${entry.messages.length}`,
  );
}

/**
 * Check if conversation needs summarization
 */
export function needsSummarization(phoneNumber: string): boolean {
  const entry = conversationStore.get(phoneNumber);
  return entry ? entry.messages.length >= CONFIG.MAX_MESSAGES : false;
}

/**
 * Trim old messages and store summary
 */
export function setSummaryAndTrim(
  phoneNumber: string,
  summary: string,
  keepLastN: number = 4,
): void {
  const entry = conversationStore.get(phoneNumber);
  if (!entry) return;

  // Keep only the last N messages
  entry.messages = entry.messages.slice(-keepLastN);
  entry.summary = summary;
  entry.lastAccessedAt = Date.now();

  console.log(
    `[Memory] Summarized and trimmed conversation for ${phoneNumber}. Kept ${keepLastN} messages.`,
  );
}

/**
 * Clear conversation for a phone number
 */
export function clearConversation(phoneNumber: string): void {
  conversationStore.delete(phoneNumber);
  console.log(`[Memory] Cleared conversation for ${phoneNumber}`);
}

/**
 * Set TTL for a conversation (like Redis EXPIRE)
 */
export function setTTL(phoneNumber: string, ttlMs: number): void {
  const entry = conversationStore.get(phoneNumber);
  if (entry) {
    entry.ttl = ttlMs;
  }
}

/**
 * Get stats (for debugging)
 */
export function getMemoryStats(): {
  totalConversations: number;
  conversations: { phoneNumber: string; messageCount: number; age: number }[];
} {
  const now = Date.now();
  const conversations: {
    phoneNumber: string;
    messageCount: number;
    age: number;
  }[] = [];

  for (const [phoneNumber, entry] of conversationStore.entries()) {
    conversations.push({
      phoneNumber,
      messageCount: entry.messages.length,
      age: Math.round((now - entry.createdAt) / 1000),
    });
  }

  return {
    totalConversations: conversationStore.size,
    conversations,
  };
}

// Start cleanup on module load
startMemoryCleanup();
