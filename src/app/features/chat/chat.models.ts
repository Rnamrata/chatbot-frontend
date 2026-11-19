export type SourceKind = 'file' | 'youtube' | 'web' | 'other';

/** One retrieved chunk, numbered in the order Flask returned it. */
export interface Source {
  n: number;
  name: string;
  kind: SourceKind;
  /** Link for web pages and videos; null for uploaded files. */
  url: string | null;
  /** Flask sends only the first 200 characters of the chunk. */
  passage: string;
  truncated: boolean;
}

export type MessageStatus = 'done' | 'pending' | 'error';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: Date | null;
  status: MessageStatus;
  /** Assistant only: the question it answers, so a failed answer can be retried. */
  question?: string;
  sources: Source[];
  suggestions: string[];
  error?: string;
}

/** idle: not loaded yet · missing: Flask doesn't know this session (it keeps sessions in memory). */
export type ConversationState = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

// ---------- Flask response shapes ----------

export interface RawSource {
  content: string;
  metadata: Record<string, unknown>;
  full_length: number;
}

/** POST /chat. A failed answer still comes back as HTTP 200 with success: false. */
export interface ChatResponse {
  success: boolean;
  answer: string;
  sources?: RawSource[];
  num_sources?: number;
  session_id: string;
  message_count?: number;
  error?: string;
  /** Not sent by llm-chatbot yet; used as soon as it is. */
  suggested_questions?: string[];
}

/** GET /chat/history/:id. Pairs only: sources are not stored. */
export interface HistoryResponse {
  history: { question: string | null; answer: string; timestamp?: string }[];
  length: number;
  message?: string;
}

/** GET /stats */
export interface StatsResponse {
  total_chunks: number;
  total_sessions: number;
  total_reviews: number;
  status: 'ready' | 'empty';
}