export interface User {
  id: number;
  username: string;
}

export interface Conversation {
  id: number;
  user_id: number;
  title: string;
  summary: string | null;
  summary_trigger_ratio: number;
  context_limit: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface SSEEvent {
  type: "token" | "done" | "error";
  content?: string;
  message?: string;
}
