import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, catchError, map, merge, of, switchMap, timeout, timer } from 'rxjs';
import { API_BASE_URL } from './api';

/** Shape of Flask's GET /health. */
// cspell:ignore ollama
interface HealthResponse {
  status: string;
  llm_model?: string;
  ollama: string; // 'healthy' | 'unhealthy (503)' | 'unreachable: …'
  review_service: { success: boolean; status?: string; error?: string };
}

export type ServiceState = 'checking' | 'up' | 'down' | 'unknown';

export interface Health {
  chatServer: ServiceState;
  ollama: ServiceState;
  reviewService: ServiceState;
  model: string | null;
}

const POLL_MS = 15_000;
const CHECKING: Health = { chatServer: 'checking', ollama: 'checking', reviewService: 'checking', model: null };
// If Flask is down we cannot tell anything about the other two.
const SERVER_DOWN: Health = { chatServer: 'down', ollama: 'unknown', reviewService: 'unknown', model: null };

@Injectable({ providedIn: 'root' })
export class StatusService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly recheck$ = new Subject<void>();

  readonly health = toSignal(
    merge(timer(0, POLL_MS), this.recheck$).pipe(
      switchMap(() =>
        this.http.get<HealthResponse>(`${this.baseUrl}/health`).pipe(
          timeout(5_000),
          map(toHealth),
          catchError(() => of(SERVER_DOWN)),
        ),
      ),
    ),
    { initialValue: CHECKING },
  );

  readonly allUp = computed(() => {
    const h = this.health();
    return h.chatServer === 'up' && h.ollama === 'up' && h.reviewService === 'up';
  });

  readonly checking = computed(() => this.health().chatServer === 'checking');

  /** Used by chat/review screens to pause the composer while Ollama is offline. */
  readonly ollamaUp = computed(() => this.health().ollama === 'up');

  /** "Check again" buttons call this. */
  recheck(): void {
    this.recheck$.next();
  }
}

function toHealth(res: HealthResponse): Health {
  return {
    chatServer: 'up',
    ollama: res.ollama === 'healthy' ? 'up' : 'down',
    reviewService: res.review_service?.success ? 'up' : 'down',
    model: res.llm_model ?? null,
  };
}