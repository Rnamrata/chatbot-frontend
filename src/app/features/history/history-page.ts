import { Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeaderService } from '../../core/page-header.service';
import { StatusService } from '../../core/status.service';
import { Icon } from '../../shared/icon';
import { ChatService } from '../chat/chat.service';
import { ReviewService } from '../review/review.service';
import { HistoryItem, HistoryKind, groupItems, matches, rowTime } from './history.models';
import { HistoryService } from './history.service';

type Filter = 'all' | HistoryKind;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'chat', label: 'Document Q&A' },
  { value: 'code', label: 'Code Review' },
];

/** /history: every chat and code review, with search, a type filter, pin and delete. */
@Component({
  selector: 'app-history-page',
  imports: [Icon, RouterLink],
  templateUrl: './history-page.html',
  styleUrl: './history-page.css',
  host: { '(keydown.escape)': 'cancel()' },
})
export class HistoryPage {
  protected readonly history = inject(HistoryService);
  private readonly status = inject(StatusService);
  private readonly chat = inject(ChatService);
  private readonly reviews = inject(ReviewService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly search = viewChild.required<ElementRef<HTMLInputElement>>('search');

  protected readonly filters = FILTERS;
  protected readonly query = signal('');
  protected readonly filter = signal<Filter>('all');
  /** The row whose delete is waiting for "Delete" or "Cancel". */
  protected readonly confirming = signal<string | null>(null);
  protected readonly confirmClear = signal(false);
  protected readonly busy = signal(false);
  /** Read out after a delete or clear. */
  protected readonly announcement = signal('');
  private readonly now = signal(new Date());

  protected readonly groups = computed(() => {
    const now = this.now();
    const filter = this.filter();
    const visible = this.history
      .items()
      .filter((item) => (filter === 'all' || item.kind === filter) && matches(item, this.query()));
    return groupItems(visible, now).map((g) => ({
      ...g,
      items: g.items.map((item) => ({ ...item, time: rowTime(item.at, now, g.label === 'Pinned') })),
    }));
  });

  protected readonly view = computed(() => {
    const state = this.history.state();
    if (state === 'ready') return this.history.items().length ? 'list' : 'empty';
    if (state === 'error' || this.status.health().chatServer === 'down') return 'error';
    return 'loading';
  });

  protected readonly noMatch = computed(() => {
    if (this.query().trim()) return 'Nothing matches your search.';
    return this.filter() === 'code' ? 'No code reviews yet.' : 'No document chats yet.';
  });

  protected readonly oldCount = computed(() => this.history.old(this.now()).length);

  constructor() {
    inject(PageHeaderService).set('History', 'Every chat and code review, newest first.');
    this.history.refresh();

    // Keeps "Today" and the times right if the page stays open.
    const timer = setInterval(() => this.now.set(new Date()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected setQuery(value: string): void {
    this.query.set(value);
  }

  protected togglePin(item: HistoryItem): void {
    void this.history.setPinned(item.id, !item.pinned);
  }

  protected askDelete(item: HistoryItem): void {
    this.confirmClear.set(false);
    this.confirming.set(item.id);
    this.focusLater('.confirm .danger');
  }

  protected async delete(item: HistoryItem): Promise<void> {
    this.busy.set(true);
    const ok = await this.history.remove(item.id);
    this.busy.set(false);
    this.confirming.set(null);
    if (!ok) return;
    this.forget([item]);
    this.announcement.set(`Deleted “${item.title}”.`);
    this.search().nativeElement.focus();
  }

  protected askClear(): void {
    this.confirming.set(null);
    this.confirmClear.set(true);
    this.focusLater('.clear-confirm .danger');
  }

  protected async clearOld(): Promise<void> {
    this.busy.set(true);
    const gone = await this.history.clearOld();
    this.busy.set(false);
    this.confirmClear.set(false);
    if (!gone) return;
    this.forget(gone);
    this.announcement.set(`Cleared ${gone.length} ${gone.length === 1 ? 'chat' : 'chats'} older than 24 hours.`);
    this.search().nativeElement.focus();
  }

  protected cancel(): void {
    this.confirming.set(null);
    this.confirmClear.set(false);
  }

  protected retry(): void {
    this.status.recheck();
    this.history.refresh();
  }

  /** Drops what this tab still holds for deleted chats and reviews. */
  private forget(items: HistoryItem[]): void {
    for (const item of items) {
      this.chat.forget(item.id);
      if (item.reviewId) this.reviews.forget(item.reviewId);
    }
  }

  private focusLater(selector: string): void {
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus());
  }
}