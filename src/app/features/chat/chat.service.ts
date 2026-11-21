import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, Signal, WritableSignal, inject, signal } from '@angular/core';
import { TimeoutError, timeout } from 'rxjs';
import { API_BASE_URL } from '../../core/api';
import {
  ChatResponse,
  ConversationState,
  HistoryResponse,
  Message,
  RawSource,
  Source,
  SourceKind,
  StatsResponse,
} from './chat.models';

export interface Conversation {
  readonly messages: Signal<Message[]>;
  readonly state: Signal<ConversationState>;
}

interface Entry {
  messages: WritableSignal<Message[]>;
  state: WritableSignal<ConversationState>;
  view: Conversation;
  reviewId?: string;
}

/** Ollama on a laptop can be slow, especially on the first question while the model loads. */
const ANSWER_TIMEOUT_MS = 180_000;

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * Conversations live here rather than in the page, so a question asked on /chat
   * survives the navigation to /chat/:sessionId while its answer is on the way.
   */
  private readonly entries = new Map<string, Entry>();

  /** From GET /stats: false when the vector store is empty, null while unknown. */
  readonly hasSources = signal<boolean | null>(null);

  conversation(sessionId: string): Conversation {
    return this.entry(sessionId).view;
  }

  /** Loads a chat from Flask the first time it is opened. */
  load(sessionId: string): void {
    const c = this.entry(sessionId);
    if (c.state() !== 'idle' && c.state() !== 'error') return;
    if (c.messages().length) {
      c.state.set('ready');
      return;
    }
    c.state.set('loading');
    this.http
      .get<HistoryResponse>(`${this.baseUrl}/chat/history/${encodeURIComponent(sessionId)}`)
      .subscribe({
        next: (res) => {
          if (c.messages().length) {
            c.state.set('ready'); // a question was asked while history was loading
          } else if (res.message === 'Session not found') {
            c.state.set('missing');
          } else {
            c.messages.set(fromHistory(res.history ?? []));
            c.state.set('ready');
          }
        },
        error: () => c.state.set('error'),
      });
  }

  send(sessionId: string, question: string, reviewId?: string): void {
    const c = this.entry(sessionId);
    if (reviewId) c.reviewId = reviewId;
    const answer = message('assistant', '', { status: 'pending', question });
    c.state.set('ready');
    c.messages.update((list) => [...list, message('user', question, { at: new Date() }), answer]);
    this.ask(c, sessionId, answer.id, question);
  }

  retry(sessionId: string, messageId: string): void {
    const c = this.entry(sessionId);
    const failed = c.messages().find((m) => m.id === messageId);
    if (!failed?.question || failed.status !== 'error') return;
    patch(c, messageId, { status: 'pending', error: undefined });
    this.ask(c, sessionId, messageId, failed.question);
  }

  refreshStats(): void {
    this.http.get<StatsResponse>(`${this.baseUrl}/stats`).subscribe({
      next: (res) => this.hasSources.set(res.total_chunks > 0),
      error: () => this.hasSources.set(null),
    });
  }

  private ask(c: Entry, sessionId: string, messageId: string, question: string): void {
    this.http
      .post<ChatResponse>(`${this.baseUrl}/chat`, {
        question,
        session_id: sessionId,
        ...(c.reviewId ? { review_id: c.reviewId } : {}),
      })
      .pipe(timeout(ANSWER_TIMEOUT_MS))
      .subscribe({
        next: (res) =>
          res.success
            ? patch(c, messageId, {
                status: 'done',
                text: res.answer,
                at: new Date(),
                sources: toSources(res.sources),
                suggestions: res.suggested_questions ?? [],
              })
            : patch(c, messageId, {
                status: 'error',
                error: res.error ? `The chat server said: ${res.error}` : 'The chat server could not answer.',
              }),
        error: (err) => patch(c, messageId, { status: 'error', error: errorText(err) }),
      });
  }

  private entry(sessionId: string): Entry {
    let e = this.entries.get(sessionId);
    if (!e) {
      const messages = signal<Message[]>([]);
      const state = signal<ConversationState>('idle');
      e = { messages, state, view: { messages: messages.asReadonly(), state: state.asReadonly() } };
      this.entries.set(sessionId, e);
    }
    return e;
  }
}

// ---------- Mapping Flask data ----------

const KINDS: Record<string, SourceKind> = { file_upload: 'file', youtube: 'youtube', web: 'web' };

export function toSources(raw: RawSource[] = []): Source[] {
  return raw.map((s, i) => {
    const meta = s.metadata ?? {};
    const origin = typeof meta['source'] === 'string' ? meta['source'] : '';
    const title = typeof meta['title'] === 'string' ? meta['title'] : '';
    const isLink = /^https?:\/\//.test(origin);
    const passage = (s.content ?? '').replace(/\.\.\.$/, '').trim();
    return {
      n: i + 1,
      name: title || (isLink ? origin : basename(origin)) || 'Unknown source',
      kind: KINDS[String(meta['type'])] ?? 'other',
      url: isLink ? origin : null,
      passage,
      truncated: (s.full_length ?? 0) > passage.length,
    };
  });
}

function fromHistory(history: HistoryResponse['history']): Message[] {
  return history.flatMap((h) => {
    const at = h.timestamp ? new Date(h.timestamp) : null;
    const answer = message('assistant', h.answer, { at, question: h.question ?? undefined });
    return h.question ? [message('user', h.question, { at }), answer] : [answer];
  });
}

function message(role: Message['role'], text: string, extra: Partial<Message> = {}): Message {
  return { id: crypto.randomUUID(), role, text, at: null, status: 'done', sources: [], suggestions: [], ...extra };
}

function patch(c: Entry, id: string, changes: Partial<Message>): void {
  c.messages.update((list) => list.map((m) => (m.id === id ? { ...m, ...changes } : m)));
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function errorText(err: unknown): string {
  if (err instanceof TimeoutError) {
    return 'Lens took too long to answer. Ollama may still be loading the model, so try again in a moment.';
  }
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return "Can't reach the chat server. Check that llm-chatbot is running on :5001.";
    const detail = (err.error as { error?: string } | null)?.error;
    return detail ? `The chat server said: ${detail}` : `The chat server returned an error (${err.status}).`;
  }
  return 'Something went wrong while asking.';
}