import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, Signal, WritableSignal, inject, signal } from '@angular/core';
import { TimeoutError, timeout } from 'rxjs';
import { API_BASE_URL } from '../../core/api';
import { ActivityService } from '../../core/activity.service';
import {
  CODE_EXTENSIONS,
  MAX_CODE_BYTES,
  Review,
  ReviewJob,
  ReviewResponse,
  StartError,
  extensionOf,
  languageOf,
} from './review.models';

/** Flask waits up to 60 s for the review service; leave room for storing and embedding. */
const REVIEW_TIMEOUT_MS = 5 * 60_000;
/** Used when a 429 comes without Retry-After. */
const DEFAULT_RETRY_S = 60;

export type Loaded =
  | { state: 'loading' }
  | { state: 'ready'; review: Review }
  | { state: 'missing' }
  | { state: 'error'; message: string };

/**
 * Starts reviews and loads stored ones. Jobs live here, not in the page, so a review
 * keeps going if you open Document Q&A meanwhile, and survives the /review/<job> to
 * /review/<review_id> navigation when it finishes.
 */
@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly activity = inject(ActivityService);

  private readonly jobs = new Map<string, WritableSignal<ReviewJob>>();
  private readonly loaded = new Map<string, WritableSignal<Loaded>>();
  /** The last file kept per job, so "Run the review again" can resend it. */
  private readonly files = new Map<string, File>();

  /** Why the last review could not start; the start screen shows it. */
  readonly startError = signal<StartError | null>(null);

  /** Checks a file before uploading. Returns the problem, or null when it can be reviewed. */
  check(file: File): StartError | null {
    const ext = extensionOf(file.name);
    if (!CODE_EXTENSIONS.includes(ext)) {
      return {
        kind: 'unsupported',
        title: ext ? `Lens can't check ${ext} files yet` : `Lens can't tell what kind of file ${file.name} is`,
        body: 'Reviews work for Python, JavaScript, TypeScript and Java files (.py, .js, .jsx, .ts, .tsx, .java).',
      };
    }
    if (file.size > MAX_CODE_BYTES) {
      return {
        kind: 'too-large',
        title: `${file.name} is too big to review`,
        body: `The review service checks files up to 1 MB, and this one is ${megabytes(file.size)}. Split it into smaller files, or review just the part you changed.`,
      };
    }
    if (file.size === 0) {
      return { kind: 'empty', title: `${file.name} is empty`, body: 'Choose a file that has some code in it.' };
    }
    return null;
  }

  /** Starts a review and returns the job id to navigate to. */
  async start(file: File): Promise<string> {
    const id = crypto.randomUUID();
    const job = signal<ReviewJob>({
      id,
      filename: file.name,
      language: languageOf(file.name),
      code: await file.text(),
      startedAt: Date.now(),
      status: 'running',
      stopped: false,
    });
    this.jobs.set(id, job);
    this.files.set(id, file);
    this.startError.set(null);

    const body = new FormData();
    body.append('file', file, file.name);
    this.http
      .post<ReviewResponse>(`${this.baseUrl}/review`, body, { observe: 'body' })
      .pipe(timeout(REVIEW_TIMEOUT_MS))
      .subscribe({
        next: (res) => {
          const review = normalize(res);
          this.loaded.set(review.review_id, signal<Loaded>({ state: 'ready', review }));
          job.update((j) => ({ ...j, status: 'done', review }));
          this.activity.changed(); // the review shows up in History and Recent
        },
        error: (err) => job.update((j) => ({ ...j, status: 'failed', error: startErrorFrom(err, file.name) })),
      });
    return id;
  }

  job(id: string): Signal<ReviewJob> | null {
    return this.jobs.get(id)?.asReadonly() ?? null;
  }

  /** "Stop waiting": the request keeps running, the page just stops showing progress. */
  stop(id: string): void {
    this.jobs.get(id)?.update((j) => ({ ...j, stopped: true, stoppedAt: Date.now() }));
  }

  /** The file a job was started with, if this tab still has it. */
  fileFor(reviewOrJobId: string): File | null {
    for (const [jobId, job] of this.jobs) {
      if (jobId === reviewOrJobId || job().review?.review_id === reviewOrJobId) return this.files.get(jobId) ?? null;
    }
    return null;
  }

  /** Drops a deleted review, so opening it again asks the server (and finds it gone). */
  forget(reviewId: string): void {
    this.loaded.delete(reviewId);
  }

  /** A stored review, fetched once per tab. */
  load(reviewId: string): Signal<Loaded> {
    let entry = this.loaded.get(reviewId);
    if (entry?.().state === 'error') entry = undefined; // try again
    if (entry) return entry.asReadonly();

    const result = signal<Loaded>({ state: 'loading' });
    this.loaded.set(reviewId, result);
    this.http.get<ReviewResponse>(`${this.baseUrl}/review/${encodeURIComponent(reviewId)}`).subscribe({
      next: (res) => {
        result.set({ state: 'ready', review: normalize(res) });
      },
      error: (err) =>
        result.set(
          err instanceof HttpErrorResponse && err.status === 404
            ? { state: 'missing' }
            : { state: 'error', message: errorDetail(err) ?? "Can't reach the chat server on :5001." },
        ),
    });
    return result.asReadonly();
  }
}

/** Fills the fields older llm-chatbot versions leave out. */
function normalize(res: ReviewResponse): Review {
  return {
    review_id: res.review_id,
    session_id: res.session_id ?? null,
    filename: res.filename ?? 'Code',
    language: res.language ?? null,
    code: res.code ?? '',
    findings: (res.findings ?? []).map((f) => ({ ...f, line: Number(f.line) || 0 })),
    warnings: res.warnings ?? [],
    summary: res.summary ?? '',
    ...(res.warning ? { warning: res.warning } : {}),
  };
}

export function startErrorFrom(err: unknown, filename: string): StartError {
  if (err instanceof TimeoutError) {
    return {
      kind: 'failed',
      title: 'The review took too long',
      body: 'Lens stopped waiting after 5 minutes. Check that the review service is running, then try again.',
    };
  }
  if (!(err instanceof HttpErrorResponse) || err.status === 0) {
    return {
      kind: 'unreachable',
      title: "Lens can't reach the chat server",
      body: 'Start llm-chatbot on :5001 (python main.py in its folder), then try again.',
    };
  }
  if (err.status === 429) {
    const seconds = retryAfter(err) ?? DEFAULT_RETRY_S;
    return {
      kind: 'rate-limited',
      title: 'Too many reviews in a short time',
      body: 'The review service limits how many reviews can start in a while.',
      retryAt: Date.now() + seconds * 1000,
    };
  }
  if (err.status === 413) {
    return {
      kind: 'too-large',
      title: `${filename} is too big to review`,
      body: 'The review service checks files up to 1 MB. Split it into smaller files, or review just the part you changed.',
    };
  }
  return {
    kind: 'refused',
    title: `Lens couldn't review ${filename}`,
    body: errorDetail(err) ?? `The chat server returned an error (${err.status}).`,
  };
}

function retryAfter(err: HttpErrorResponse): number | null {
  const fromBody = (err.error as { retry_after?: unknown } | null)?.retry_after;
  const raw = typeof fromBody === 'number' ? fromBody : Number(err.headers?.get('Retry-After'));
  return Number.isFinite(raw) && raw >= 0 ? raw : null;
}

function errorDetail(err: unknown): string | null {
  if (!(err instanceof HttpErrorResponse)) return null;
  const detail = (err.error as { error?: unknown } | null)?.error;
  return typeof detail === 'string' && detail.trim() ? detail.trim() : null;
}

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}