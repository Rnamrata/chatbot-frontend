import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Subscription, firstValueFrom } from 'rxjs';
import { ActivityService } from '../../core/activity.service';
import { API_BASE_URL } from '../../core/api';
import { StatusService } from '../../core/status.service';
import { HistoryItem, SessionSummary, SessionsResponse, toItem } from './history.models';

/** How many chats the sidebar's Recent list shows. */
const RECENT_COUNT = 5;
/** "Clear chats older than 24 h". */
export const CLEAR_AFTER_HOURS = 24;

export type HistoryState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Every saved chat and code review, from GET /chat/sessions. One list for the
 * History page and the sidebar's Recent, reloaded when the chat server comes up
 * and whenever a chat or review changes.
 */
@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly status = inject(StatusService);
  private readonly activity = inject(ActivityService);

  private readonly list = signal<HistoryItem[]>([]);
  private request?: Subscription;

  readonly items = this.list.asReadonly();
  readonly state = signal<HistoryState>('idle');
  /** Why the last pin or delete failed, for a message on the History page. */
  readonly problem = signal<string | null>(null);

  /** Pinned first, then the most recently used. */
  readonly recent = computed(() =>
    [...this.list()]
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.at.getTime() - a.at.getTime())
      .slice(0, RECENT_COUNT),
  );

  private readonly serverUp = computed(() => this.status.health().chatServer === 'up');

  constructor() {
    effect(() => {
      this.activity.changes();
      if (this.serverUp()) untracked(() => this.refresh());
    });
  }

  refresh(): void {
    if (this.state() !== 'ready') this.state.set('loading');
    this.request?.unsubscribe();
    this.request = this.http.get<SessionsResponse>(`${this.baseUrl}/chat/sessions`).subscribe({
      next: (res) => {
        this.list.set((res.sessions ?? []).map(toItem));
        this.state.set('ready');
      },
      error: () => {
        // Keep showing what we had; only an empty page needs the error.
        if (this.state() !== 'ready') this.state.set('error');
      },
    });
  }

  async setPinned(id: string, pinned: boolean): Promise<void> {
    const before = this.list();
    this.update(id, { pinned });
    this.problem.set(null);
    try {
      await firstValueFrom(
        this.http.patch<{ session: SessionSummary }>(`${this.baseUrl}/chat/session/${encodeURIComponent(id)}`, { pinned }),
      );
    } catch {
      this.list.set(before);
      this.problem.set(pinned ? "Couldn't pin that chat. Check the chat server, then try again." : "Couldn't unpin that chat.");
    }
  }

  /** Deletes a chat, or a review with its stored code and findings. */
  async remove(id: string): Promise<boolean> {
    this.problem.set(null);
    try {
      await firstValueFrom(this.http.delete(`${this.baseUrl}/chat/clear/${encodeURIComponent(id)}`));
      this.list.update((list) => list.filter((item) => item.id !== id));
      return true;
    } catch {
      this.problem.set("Couldn't delete that chat. Check the chat server, then try again.");
      return false;
    }
  }

  /** The chats "Clear chats older than 24 h" would delete: not used for a day, and not pinned. */
  old(now = new Date()): HistoryItem[] {
    const cutoff = now.getTime() - CLEAR_AFTER_HOURS * 3_600_000;
    return this.list().filter((item) => !item.pinned && item.at.getTime() < cutoff);
  }

  /** Returns the items it deleted, or null if the server refused. */
  async clearOld(): Promise<HistoryItem[] | null> {
    const doomed = this.old();
    this.problem.set(null);
    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/chat/cleanup`, { inactive_hours: CLEAR_AFTER_HOURS, keep_pinned: true }),
      );
      const gone = new Set(doomed.map((item) => item.id));
      this.list.update((list) => list.filter((item) => !gone.has(item.id)));
      this.refresh();
      return doomed;
    } catch {
      this.problem.set("Couldn't clear old chats. Check the chat server, then try again.");
      return null;
    }
  }

  private update(id: string, changes: Partial<HistoryItem>): void {
    this.list.update((list) => list.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }
}