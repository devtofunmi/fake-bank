/**
 * SHARED TYPES
 */

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface UserProfile {
  phoneNumber: string;
  name: string | null;
  email: string | null;
  balance: number;
}
