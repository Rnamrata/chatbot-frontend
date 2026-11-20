import { Component, input, output, signal } from '@angular/core';
import { Icon } from '../../shared/icon';
import { LibrarySource } from './sources.models';

@Component({
  selector: 'app-sources-table',
  imports: [Icon],
  templateUrl: './sources-table.html',
  styleUrl: './sources-table.css',
})
export class SourcesTable {
  readonly sources = input.required<LibrarySource[]>();
  /** Id of the source being removed. */
  readonly removing = input<string | null>(null);
  readonly remove = output<string>();

  /** Row asking "Remove …?" before anything is deleted. */
  protected readonly confirming = signal<string | null>(null);

  protected confirm(id: string): void {
    this.confirming.set(null);
    this.remove.emit(id);
  }

  protected typeLabel(s: LibrarySource): string {
    switch (s.type) {
      case 'youtube':
        return 'YouTube';
      case 'web':
        return 'Web page';
      case 'file_upload': {
        const name = (s.source ?? s.name).toLowerCase();
        if (name.endsWith('.pdf')) return 'PDF';
        if (name.endsWith('.md')) return 'Markdown';
        if (name.endsWith('.txt')) return 'Text';
        return 'File';
      }
      default:
        return '—';
    }
  }

  protected statusLabel(s: LibrarySource): string {
    if (s.status === 'ready') return 'Ready';
    if (s.status === 'outdated') return 'Outdated';
    return s.type === 'youtube' ? 'Transcribing…' : 'Adding…';
  }

  protected detail(s: LibrarySource): string {
    if (s.status === 'processing') return s.source ?? '';
    const sections = `${s.chunks} ${s.chunks === 1 ? 'section' : 'sections'}`;
    return s.type === 'web' || s.type === 'youtube' ? `${sections} · ${s.source}` : sections;
  }
}