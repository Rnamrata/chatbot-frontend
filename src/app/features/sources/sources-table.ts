import { Component, computed, input, output, signal } from '@angular/core';
import { Icon } from '../../shared/icon';
import { addedLabel, typeLabel } from './source-checks';
import { LibrarySource } from './sources.models';

/** The library: one row per source, with a checkbox to choose sources for a chat. */
@Component({
  selector: 'app-sources-table',
  imports: [Icon],
  templateUrl: './sources-table.html',
  styleUrl: './sources-table.css',
})
export class SourcesTable {
  /** The rows to show (after the search). */
  readonly sources = input.required<LibrarySource[]>();
  /** Ids of the chosen sources. */
  readonly selected = input<string[]>([]);
  /** Ids of the sources being deleted. */
  readonly removing = input<string[]>([]);
  readonly toggle = output<string>();
  readonly toggleAll = output<void>();
  readonly remove = output<string>();

  /** Row asking "Delete …?" before anything is deleted. */
  protected readonly confirming = signal<string | null>(null);

  /** Older data without names can't be chosen for a chat. */
  protected readonly selectable = computed(() => this.sources().filter((s) => s.status !== 'outdated'));
  protected readonly allSelected = computed(
    () => this.selectable().length > 0 && this.selectable().every((s) => this.selected().includes(s.id)),
  );
  protected readonly someSelected = computed(
    () => !this.allSelected() && this.selectable().some((s) => this.selected().includes(s.id)),
  );

  protected isSelected(id: string): boolean {
    return this.selected().includes(id);
  }

  protected confirm(id: string): void {
    this.confirming.set(null);
    this.remove.emit(id);
  }

  protected type(s: LibrarySource): string {
    return typeLabel(s.type, s.source, s.name);
  }

  protected added(s: LibrarySource): string {
    return addedLabel(s.added_at);
  }

  protected statusLabel(s: LibrarySource): string {
    if (s.status === 'ready') return 'Ready';
    if (s.status === 'outdated') return 'Outdated';
    return s.type === 'youtube' ? 'Transcribing…' : 'Adding…';
  }

  protected detail(s: LibrarySource): string {
    if (s.status === 'processing') return s.source ?? '';
    const sections = `${s.chunks.toLocaleString('en-US')} ${s.chunks === 1 ? 'section' : 'sections'}`;
    return s.type === 'web' || s.type === 'youtube' ? `${sections} · ${s.source}` : sections;
  }
}
