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

/** A file being added to a chat (picked in the + dialog, or dropped on the chat). */
export interface FileUpload {
  id: string;
  name: string;
  status: 'adding' | 'failed';
  error?: string;
  detail?: string;
}

/** A YouTube or web link sent with a question, added as a source before the question is asked. */
export interface LinkSource {
  kind: 'youtube' | 'web';
  url: string;
  status: 'adding' | 'failed' | 'added';
  /** When adding started, for the elapsed time on long transcriptions. */
  since: number;
  error?: string;
  detail?: string;
}

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
  /** User only: a link in the question that is being added as a source first. */
  link?: LinkSource;
  /** Assistant only: files still being added; the question is asked once they are in. */
  waitingFor?: string[];
  /** Assistant only, while pending: the source whose overview the answer waits for. */
  progress?: { source: string; since: number };
}

/** idle: not loaded yet · missing: Flask doesn't know this session (deleted, or from before it saved chats). */
export type ConversationState = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

// ---------- Flask response shapes ----------

export interface RawSource {
  content: string;
  metadata: Record<string, unknown>;
  full_length: number;
}

/** POST /chat. A failed answer still comes back as HTTP 200 with success: false. */
/** GET /chat/progress/:id — what a pending question waits on. */
export interface ChatProgress {
  stage: 'summarizing' | null;
  source: string | null;
  since: string | null;
}

export interface ChatResponse {
  success: boolean;
  answer: string;
  sources?: RawSource[];
  num_sources?: number;
  session_id: string;
  /** The chat's own sources after this question; [] means every source. */
  source_ids?: string[];
  message_count?: number;
  error?: string;
  /** Not sent by llm-chatbot yet; used as soon as it is. */
  suggested_questions?: string[];
}

/** GET /chat/history/:id. Older llm-chatbot versions send no sources. */
export interface HistoryResponse {
  history: { question: string | null; answer: string; timestamp?: string; sources?: RawSource[] }[];
  length: number;
  message?: string;
  /** The chat's own sources; [] or missing means every source. */
  source_ids?: string[];
}

/** GET /stats */
export interface StatsResponse {
  total_chunks: number;
  total_sessions: number;
  total_reviews: number;
  status: 'ready' | 'empty';
}