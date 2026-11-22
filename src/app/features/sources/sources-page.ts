import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeaderService } from '../../core/page-header.service';
import { Icon, IconName } from '../../shared/icon';
import { FileDrop } from './file-drop';
import { AddKind, Job } from './sources.models';
import { SourcesService } from './sources.service';
import { SourcesTable } from './sources-table';
import { UrlForm } from './url-form';

/** On phones only one way of adding shows at a time; these buttons pick it. */
const KINDS: { value: AddKind; label: string; icon: IconName }[] = [
  { value: 'file', label: 'File', icon: 'upload' },
  { value: 'youtube', label: 'YouTube', icon: 'video' },
  { value: 'web', label: 'Web page', icon: 'globe' },
];

@Component({
  selector: 'app-sources-page',
  imports: [FileDrop, Icon, RouterLink, SourcesTable, UrlForm],
  templateUrl: './sources-page.html',
  styleUrl: './sources-page.css',
})
export class SourcesPage {
  protected readonly lib = inject(SourcesService);
  protected readonly kinds = KINDS;
  protected readonly adding = signal<AddKind>('file');
  protected readonly hasLegacy = computed(() => this.lib.sources().some((s) => s.status === 'outdated'));

  constructor() {
    inject(PageHeaderService).set('Sources', 'Everything you add here can be used to answer questions in any chat.');
    this.lib.load();
  }

  protected busy(kind: AddKind): boolean {
    return this.lib.jobs()[kind]?.status === 'busy';
  }

  protected error(kind: AddKind): string | null {
    const job: Job = this.lib.jobs()[kind];
    return job?.status === 'error' ? job.message : null;
  }

  protected addFile(file: File): void {
    this.lib.clearError('file');
    this.lib.addFile(file);
  }

  protected addYouTube(url: string): void {
    this.lib.clearError('youtube');
    this.lib.addYouTube(url);
  }

  protected addWebPage(url: string): void {
    this.lib.clearError('web');
    this.lib.addWebPage(url);
  }
}