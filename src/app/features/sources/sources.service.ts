import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { API_BASE_URL } from '../../core/api';
import { AddKind, Job, LibrarySource, SourcesResponse, UploadResponse } from './sources.models';

const UPLOAD_PATH: Record<AddKind, string> = {
  file: '/upload/file',
  youtube: '/upload/youtube',
  web: '/upload/web',
};

/** While something is being added (here or in another tab), refresh the list this often. */
const POLL_MS = 5_000;

/**
 * The source library. State lives here, not in the page, so an upload keeps going
 * (and its result still shows) if you open a chat while a video is transcribing.
 */
@Injectable({ providedIn: 'root' })
export class SourcesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private pollTimer: ReturnType<typeof setTimeout> | undefined;

  readonly sources = signal<LibrarySource[]>([]);
  readonly loadState = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly jobs = signal<Record<AddKind, Job>>({ file: null, youtube: null, web: null });
  /** The source added last, for the "is ready" banner. */
  readonly lastAdded = signal<LibrarySource | null>(null);
  readonly removing = signal<string | null>(null);
  readonly removeError = signal<string | null>(null);

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

  addFile(file: File): void {
    const body = new FormData();
    body.append('file', file, file.name);
    this.add('file', body);
  }

  addYouTube(url: string): void {
    this.add('youtube', { url });
  }

  addWebPage(url: string): void {
    this.add('web', { url });
  }

  remove(id: string): void {
    this.removing.set(id);
    this.removeError.set(null);
    this.http.delete(`${this.baseUrl}/sources/${encodeURIComponent(id)}`).subscribe({
      next: () => {
        this.removing.set(null);
        this.sources.update((list) => list.filter((s) => s.id !== id));
        if (this.lastAdded()?.id === id) this.lastAdded.set(null);
      },
      error: (err) => {
        this.removing.set(null);
        this.removeError.set(errorText(err, 'Lens could not remove that source.'));
        this.load();
      },
    });
  }

  dismissAdded(): void {
    this.lastAdded.set(null);
  }

  clearError(kind: AddKind): void {
    if (this.jobs()[kind]?.status === 'error') this.setJob(kind, null);
  }

  private add(kind: AddKind, body: FormData | { url: string }): void {
    this.setJob(kind, { status: 'busy' });
    this.lastAdded.set(null);
    // Flask lists the upload as "processing" once the request arrives.
    setTimeout(() => this.load(), 500);

    this.http.post<UploadResponse>(`${this.baseUrl}${UPLOAD_PATH[kind]}`, body).subscribe({
      next: (res) => {
        this.setJob(kind, null);
        this.lastAdded.set(res.source ?? null);
        this.load();
      },
      error: (err) => {
        this.setJob(kind, { status: 'error', message: errorText(err, 'Lens could not add that source.') });
        this.load();
      },
    });
  }

  private setJob(kind: AddKind, job: Job): void {
    this.jobs.update((jobs) => ({ ...jobs, [kind]: job }));
  }

  private schedulePoll(): void {
    clearTimeout(this.pollTimer);
    if (this.sources().some((s) => s.status === 'processing')) {
      this.pollTimer = setTimeout(() => this.load(), POLL_MS);
    }
  }
}

function errorText(err: unknown, fallback: string): string {
  if (!(err instanceof HttpErrorResponse)) return fallback;
  if (err.status === 0) return "Can't reach the chat server. Check that llm-chatbot is running on :5001.";
  if (err.status === 413) return 'That file is larger than the chat server allows (20 MB).';
  const detail = (err.error as { error?: string } | null)?.error;
  // yt-dlp errors can carry terminal colour codes and run long.
  return detail ? `${fallback} ${clean(detail)}` : fallback;
}

function clean(message: string): string {
  const text = message.replace(/\u001b\[[0-9;]*m/g, '').trim();
  return text.length > 240 ? `${text.slice(0, 239)}…` : text;
}