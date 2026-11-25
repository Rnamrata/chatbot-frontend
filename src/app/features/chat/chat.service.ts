import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, Signal, WritableSignal, inject, signal } from '@angular/core';
import { Subject, Subscription, TimeoutError, timeout } from 'rxjs';
import { API_BASE_URL } from '../../core/api';
import { ActivityService } from '../../core/activity.service';
import { explainAddError } from '../sources/add-errors';
import { SourcesService } from '../sources/sources.service';
import {
  ChatProgress,
  ChatResponse,
  ConversationState,
  FileUpload,
  HistoryResponse,
  LinkSource,
  Message,
  RawSource,
  Source,
  SourceKind,
  StatsResponse,
} from './chat.models';

export interface Conversation {
  readonly messages: Signal<Message[]>;
  readonly state: Signal<ConversationState>;
  /** The chat's own sources (ids from /sources); empty means it answers from every source. */
  readonly sourceIds: Signal<string[]>;
  /** Why the last change to the chat's sources didn't save, if it didn't. */
  readonly sourcesError: Signal<string | null>;
  /** Files being added to this chat, and ones that failed (until dismissed). */
  readonly uploads: Signal<FileUpload[]>;
}

interface Entry {
  messages: WritableSignal<Message[]>;
  state: WritableSignal<ConversationState>;
  sourceIds: WritableSignal<string[]>;
  sourcesError: WritableSignal<string | null>;
  uploads: WritableSignal<FileUpload[]>;
  view: Conversation;
  reviewId?: string;
  /** Questions sent while files were still being added: asked once none is. */
  waiting: { messageId: string; question: string }[];
}

export interface SendOptions {
  reviewId?: string;
  /** A link in the message to add as a source before the question is asked. */
  link?: { kind: LinkSource['kind']; url: string };
}

/** Ollama on a laptop can be slow, especially on the first question while the model loads. */
const ANSWER_TIMEOUT_MS = 180_000;
/** While a document answer is pending, how soon and how often to ask what it waits on. */
const PROGRESS_FIRST_MS = 1_500;
const PROGRESS_EVERY_MS = 2_000;

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * Conversations live here rather than in the page, so a question asked on /chat
   * survives the navigation to /chat/:sessionId while its answer is on the way.
   */
  private readonly entries = new Map<string, Entry>();
  private readonly activity = inject(ActivityService);
  private readonly library = inject(SourcesService);
  
  /** From GET /stats: false when the vector store is empty, null while unknown. */
  readonly hasSources = signal<boolean | null>(null);

  conversation(sessionId: string): Conversation {
    return this.entry(sessionId).view;
  }

  /**
   * A chat made here before it has a question (to choose its sources, or to add a file to it):
   * Lens knows it is new, so it doesn't ask the server for a history that isn't there yet.
   */
  start(sessionId: string): void {
    const c = this.entry(sessionId);
    if (c.state() === 'idle') c.state.set('ready');
  }

  /** Chooses the sources a chat answers from; [] means every source. Saved on the chat server. */
  setSources(sessionId: string, ids: string[]): void {
    const c = this.entry(sessionId);
    const before = c.sourceIds();
    c.sourceIds.set(ids);
    c.sourcesError.set(null);
    this.http
      .put<{ session?: { source_ids?: string[] } }>(
        `${this.baseUrl}/chat/session/${encodeURIComponent(sessionId)}/sources`,
        { source_ids: ids },
      )
      .subscribe({
        next: (res) => {
          c.sourceIds.set(res.session?.source_ids ?? ids);
          this.activity.changed();
        },
        error: (err) => {
          c.sourceIds.set(before);
          c.sourcesError.set(
            err instanceof HttpErrorResponse && err.status === 0
              ? "Can't reach the chat server, so the chat's sources didn't change."
              : "The chat's sources couldn't be changed. Try again.",
          );
        },
      });
  }

  /** Uploads a file to the chat: it joins the chat's sources once Lens has read it. */
  addFile(sessionId: string, file: File): void {
    const c = this.entry(sessionId);
    const upload: FileUpload = { id: crypto.randomUUID(), name: file.name, status: 'adding' };
    c.uploads.update((list) => [...list, upload]);
    this.library.addToChat('file', file, sessionId).subscribe({
      next: (source) => {
        c.uploads.update((list) => list.filter((u) => u.id !== upload.id));
        if (source) this.joined(sessionId, source.id);
        this.activity.changed();
        this.askWaiting(c, sessionId);
      },
      error: (err) => {
        const why = explainAddError('file', err);
        c.uploads.update((list) =>
          list.map((u) => (u.id === upload.id ? { ...u, status: 'failed', error: why.message, detail: why.detail } : u)),
        );
        this.askWaiting(c, sessionId);
      },
    });
  }

  /** Hides a failed upload's message. */
  dismissUpload(sessionId: string, uploadId: string): void {
    this.entry(sessionId).uploads.update((list) => list.filter((u) => u.id !== uploadId));
  }

  /** A source added from the chat (a file, or a link sent with a question) joins its sources. */
  joined(sessionId: string, sourceId: string): void {
    const c = this.entry(sessionId);
    if (!c.sourceIds().includes(sourceId)) c.sourceIds.update((ids) => [...ids, sourceId]);
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
            c.sourceIds.set(res.source_ids ?? []);
            c.state.set('ready');
          }
        },
        error: () => c.state.set('error'),
      });
  }

  /**
   * Asks a question. With a link, the link is added as a source first (joining this chat's
   * sources), and the question is asked once it is ready; a link sent on its own is only added.
   */
  send(sessionId: string, question: string, options: SendOptions = {}): void {
    const c = this.entry(sessionId);
    if (options.reviewId) c.reviewId = options.reviewId;
    c.state.set('ready');

    if (options.link) {
      const link: LinkSource = { ...options.link, status: 'adding', since: Date.now() };
      const asked = message('user', question, { at: new Date(), link });
      c.messages.update((list) => [...list, asked]);
      this.addLink(c, sessionId, asked.id);
      return;
    }

    const adding = c.uploads().filter((u) => u.status === 'adding').map((u) => u.name);
    const answer = message('assistant', '', { status: 'pending', question, ...(adding.length ? { waitingFor: adding } : {}) });
    c.messages.update((list) => [...list, message('user', question, { at: new Date() }), answer]);
    if (adding.length) {
      // A file added just before ("summarize this") must be in the chat before the question is asked
      c.waiting.push({ messageId: answer.id, question });
      return;
    }
    this.ask(c, sessionId, answer.id, question);
  }

  /** Asks the questions that waited for files, once no file is still being added. */
  private askWaiting(c: Entry, sessionId: string): void {
    const adding = c.uploads().filter((u) => u.status === 'adding').map((u) => u.name);
    if (adding.length) {
      for (const w of c.waiting) patch(c, w.messageId, { waitingFor: adding });
      return;
    }
    const waiting = c.waiting.splice(0);
    for (const w of waiting) {
      patch(c, w.messageId, { waitingFor: undefined });
      this.ask(c, sessionId, w.messageId, w.question);
    }
  }

  /** Tries again to add a link that failed, then asks its question. */
  retryLink(sessionId: string, messageId: string): void {
    const c = this.entry(sessionId);
    const asked = c.messages().find((m) => m.id === messageId);
    if (asked?.link?.status !== 'failed') return;
    patch(c, messageId, { link: { ...asked.link, status: 'adding', since: Date.now(), error: undefined, detail: undefined } });
    this.addLink(c, sessionId, messageId);
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

  /** Drops a deleted chat, so opening it again asks the server. */
  forget(sessionId: string): void {
    this.entries.delete(sessionId);
  }

  private addLink(c: Entry, sessionId: string, messageId: string): void {
    const link = c.messages().find((m) => m.id === messageId)?.link;
    if (!link) return;
    this.library.addToChat(link.kind, { url: link.url }, sessionId).subscribe({
      next: (source) => {
        const asked = c.messages().find((m) => m.id === messageId);
        if (!asked?.link) return;
        patch(c, messageId, { link: { ...asked.link, status: 'added' } });
        if (source) this.joined(sessionId, source.id);
        this.activity.changed();
        if (asked.text) {
          // Asked right after the question, so the answer shows under it
          const answer = message('assistant', '', { status: 'pending', question: asked.text });
          c.messages.update((list) => {
            const at = list.findIndex((m) => m.id === messageId);
            return [...list.slice(0, at + 1), answer, ...list.slice(at + 1)];
          });
          this.ask(c, sessionId, answer.id, asked.text);
        }
      },
      error: (err) => {
        const asked = c.messages().find((m) => m.id === messageId);
        if (!asked?.link) return;
        const why = explainAddError(link.kind, err);
        patch(c, messageId, { link: { ...asked.link, status: 'failed', error: why.message, detail: why.detail } });
      },
    });
  }

  private ask(c: Entry, sessionId: string, messageId: string, question: string): void {
    const settled = new Subject<void>();
    const settle = () => {
      settled.next();
      settled.complete();
    };
    if (!c.reviewId) this.watchProgress(c, sessionId, messageId, settled);
    this.http
      .post<ChatResponse>(`${this.baseUrl}/chat`, {
        question,
        session_id: sessionId,
        ...(c.reviewId ? { review_id: c.reviewId } : {}),
      })
      .pipe(timeout(ANSWER_TIMEOUT_MS))
      .subscribe({
        next: (res) => {
          settle();
          if (!res.success) {
            patch(c, messageId, {
              status: 'error',
              error: res.error ? `The chat server said: ${res.error}` : 'The chat server could not answer.',
            });
            return;
          }
          if (res.source_ids) c.sourceIds.set(res.source_ids);
          patch(c, messageId, {
            status: 'done',
            progress: undefined,
            text: res.answer,
            at: new Date(),
            sources: toSources(res.sources),
            suggestions: res.suggested_questions ?? [],
          });
          this.activity.changed(); // History and Recent show the new chat or its new preview
        },
        error: (err) => {
          settle();
          patch(c, messageId, { status: 'error', error: errorText(err) });
        },
      });
  }

  /**
   * "Summarizing book.pdf · 0:40": asks the server what a pending answer waits on, one request
   * at a time (the next one 2 s after the last answer), until the answer settles.
   */
  private watchProgress(c: Entry, sessionId: string, messageId: string, settled: Subject<void>): void {
    let stopped = false;
    let wait: ReturnType<typeof setTimeout> | undefined;
    let request: Subscription | undefined;
    const next = (ms: number) => {
      wait = setTimeout(() => {
        request = this.http.get<ChatProgress>(`${this.baseUrl}/chat/progress/${sessionId}`).subscribe({
          next: (p) => {
            if (stopped) return;
            const since = p.since ? Date.parse(p.since) : NaN;
            patch(c, messageId, {
              progress: p.stage === 'summarizing' && p.source ? { source: p.source, since: Number.isNaN(since) ? Date.now() : since } : undefined,
            });
            next(PROGRESS_EVERY_MS);
          },
          error: () => {
            if (!stopped) next(PROGRESS_EVERY_MS); // a failed check only means no progress text this time
          },
        });
      }, ms);
    };
    settled.subscribe(() => {
      stopped = true;
      clearTimeout(wait);
      request?.unsubscribe();
    });
    next(PROGRESS_FIRST_MS);
  }

  private entry(sessionId: string): Entry {
    let e = this.entries.get(sessionId);
    if (!e) {
      const messages = signal<Message[]>([]);
      const state = signal<ConversationState>('idle');
      const sourceIds = signal<string[]>([]);
      const sourcesError = signal<string | null>(null);
      const uploads = signal<FileUpload[]>([]);
      e = {
        messages,
        state,
        sourceIds,
        sourcesError,
        uploads,
        waiting: [],
        view: {
          messages: messages.asReadonly(),
          state: state.asReadonly(),
          sourceIds: sourceIds.asReadonly(),
          sourcesError: sourcesError.asReadonly(),
          uploads: uploads.asReadonly(),
        },
      };
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
    const answer = message('assistant', h.answer, { at, question: h.question ?? undefined, sources: toSources(h.sources) });
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