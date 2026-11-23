import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PageHeaderService } from '../../core/page-header.service';
import { Icon } from '../../shared/icon';
import { ChatService } from '../chat/chat.service';
import { SourcesService } from './sources.service';
import { SourcesTable } from './sources-table';

/** The library of everything Lens can answer from: choose sources for a chat, or delete them. */
@Component({
  selector: 'app-sources-page',
  imports: [Icon, RouterLink, SourcesTable],
  templateUrl: './sources-page.html',
  styleUrl: './sources-page.css',
})
export class SourcesPage {
  protected readonly lib = inject(SourcesService);
  private readonly chat = inject(ChatService);
  private readonly router = inject(Router);

  protected readonly query = signal('');
  private readonly picked = signal<string[]>([]);
  protected readonly confirmingDelete = signal(false);

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.lib.sources();
    return q ? all.filter((s) => `${s.name} ${s.source ?? ''}`.toLowerCase().includes(q)) : all;
  });
  /** Chosen sources still in the library, in the library's order. */
  protected readonly chosen = computed(() =>
    this.lib
      .sources()
      .filter((s) => s.status !== 'outdated' && this.picked().includes(s.id))
      .map((s) => s.id),
  );
  protected readonly hasLegacy = computed(() => this.lib.sources().some((s) => s.status === 'outdated'));
  protected readonly countLabel = computed(() => plural(this.lib.sources().length, 'source'));
  protected readonly chosenLabel = computed(() => plural(this.chosen().length, 'source'));

  constructor() {
    inject(PageHeaderService).set(
      'Sources',
      'Everything Lens can answer from. Select sources to start a chat about them; add new ones from a chat.',
    );
    this.lib.load();
  }

  protected toggle(id: string): void {
    this.confirmingDelete.set(false);
    this.picked.update((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  }

  /** Selects every source the search shows, or clears them when all are selected already. */
  protected toggleAll(): void {
    this.confirmingDelete.set(false);
    const shown = this.visible()
      .filter((s) => s.status !== 'outdated')
      .map((s) => s.id);
    const every = shown.every((id) => this.picked().includes(id));
    this.picked.update((list) => (every ? list.filter((id) => !shown.includes(id)) : [...new Set([...list, ...shown])]));
  }

  protected clear(): void {
    this.confirmingDelete.set(false);
    this.picked.set([]);
  }

  protected deleteChosen(): void {
    this.lib.remove(this.chosen());
    this.clear();
  }

  /** A new chat that answers from the chosen sources only. */
  protected startChat(): void {
    const id = crypto.randomUUID();
    this.chat.start(id);
    this.chat.setSources(id, this.chosen());
    void this.router.navigate(['/chat', id], { state: { keepFocus: true } });
  }
}

function plural(n: number, word: string): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? word : `${word}s`}`;
}
