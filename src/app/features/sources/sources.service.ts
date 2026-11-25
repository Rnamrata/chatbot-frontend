import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, finalize, map } from 'rxjs';
import { API_BASE_URL } from '../../core/api';
import { AddKind, LibrarySource, SourceOverview, SourcesResponse, UploadResponse } from './sources.models';

const UPLOAD_PATH: Record<AddKind, string> = {
  file: '/upload/file',
  youtube: '/upload/youtube',
  web: '/upload/web',
};

/** While something is being added (here or in another tab), refresh the list this often. */
const POLL_MS = 5_000;

/**
 * The source library. Sources are added from a chat (see addToChat); the Sources screen lists
 * them, starts chats with them and deletes them.
 */
@Injectable({ providedIn: 'root' })
export class SourcesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private pollTimer: ReturnType<typeof setTimeout> | undefined;

  readonly sources = signal<LibrarySource[]>([]);
  readonly loadState = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  /** Ids of the sources being deleted. */
  readonly removing = signal<string[]>([]);
  readonly removeError = signal<string | null>(null);
  /** Overview texts opened in the library, by source id. */
  readonly overviews = signal<Record<string, string>>({});

  load(): void {
    if (this.loadState() !== 'ready') this.loadState.set('loading'); // keep the table during refreshes
    this.http.get<SourcesResponse>(`${this.baseUrl}/sources`).subscribe({
      next: (res) => {
        this.sources.set(res.sources ?? []);
        this.loadState.set('ready');
        this.schedulePoll();
      },
      error: () => this.loadState.set('error'),
    });
  }

  /**
   * Adds a file or link from a chat: it joins that chat's sources (and the library). The
   * caller shows the progress and the result; the list refreshes once it is done.
   */
  addToChat(kind: AddKind, payload: File | { url: string }, sessionId: string): Observable<LibrarySource | null> {
    let body: FormData | { url: string; session_id: string };
    if (payload instanceof File) {
      body = new FormData();
      body.append('file', payload, payload.name);
      body.append('session_id', sessionId);
    } else {
      body = { url: payload.url, session_id: sessionId };
    }
    // Flask lists the upload as "processing" once the request arrives.
    setTimeout(() => this.load(), 500);
    return this.http.post<UploadResponse>(`${this.baseUrl}${UPLOAD_PATH[kind]}`, body).pipe(
      map((res) => res.source ?? null),
      finalize(() => this.load()),
    );
  }

  /** Deletes sources, one request each; the uploaded files stay in llm-chatbot's uploads/ folder. */
  remove(ids: string[]): void {
    this.removeError.set(null);
    this.removing.update((list) => [...new Set([...list, ...ids])]);
    for (const id of ids) {
      this.http.delete(`${this.baseUrl}/sources/${encodeURIComponent(id)}`).subscribe({
        next: () => {
          this.removing.update((list) => list.filter((x) => x !== id));
          this.sources.update((list) => list.filter((s) => s.id !== id));
        },
        error: (err) => {
          this.removing.update((list) => list.filter((x) => x !== id));
          const name = this.sources().find((s) => s.id === id)?.name ?? 'that source';
          this.removeError.set(errorText(err, `Lens could not delete ${name}.`));
          this.load();
        },
      });
    }
  }

  /** Loads a source's overview text, for the library to show under its row. */
  openOverview(id: string): void {
    this.http.get<SourceOverview>(`${this.baseUrl}/sources/${encodeURIComponent(id)}/overview`).subscribe({
      next: (res) => {
        if (res.status === 'ready' && res.text) this.overviews.update((all) => ({ ...all, [id]: res.text! }));
        else this.markOverview(id, res.status);
      },
      error: () => undefined, // the row keeps its button; opening it again tries again
    });
  }

  /** Writes (or writes again) a source's overview; the list shows "Summarizing…" until it is done. */
  summarize(id: string): void {
    this.markOverview(id, 'building');
    this.http.post(`${this.baseUrl}/sources/${encodeURIComponent(id)}/overview`, {}).subscribe({
      next: () => this.schedulePoll(),
      error: () => this.markOverview(id, 'failed'),
    });
  }

  private markOverview(id: string, overview: LibrarySource['overview']): void {
    this.sources.update((list) => list.map((s) => (s.id === id ? { ...s, overview } : s)));
  }

  private schedulePoll(): void {
    clearTimeout(this.pollTimer);
    if (this.sources().some((s) => s.status === 'processing' || s.overview === 'building')) {
      this.pollTimer = setTimeout(() => this.load(), POLL_MS);
    }
  }
}

function errorText(err: unknown, fallback: string): string {
  if (!(err instanceof HttpErrorResponse)) return fallback;
  if (err.status === 0) return "Can't reach the chat server. Check that llm-chatbot is running on :5001.";
  const detail = (err.error as { error?: string } | null)?.error;
  return detail ? `${fallback} ${detail}` : fallback;
}
