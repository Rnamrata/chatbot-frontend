import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon';
import { Source, SourceKind } from './chat.models';

const KIND_LABEL: Record<SourceKind, string> = {
  file: 'uploaded file',
  youtube: 'YouTube transcript',
  web: 'web page',
  other: 'excerpt',
};

/**
 * The passage behind a citation. Flask sends the first 200 characters of the chunk and
 * no match position, so the whole excerpt is shown instead of a highlighted sentence.
 */
@Component({
  selector: 'app-source-passage',
  imports: [Icon, RouterLink],
  host: { role: 'region', 'aria-label': 'Source passage' },
  template: `
    <div class="head">
      <strong class="name">{{ source().name }}</strong>
      <span class="where">· {{ kind() }}</span>
      <button type="button" class="close" aria-label="Close source" (click)="closed.emit()">
        <app-icon name="close" [size]="16" />
      </button>
    </div>
    <blockquote>{{ source().passage }}{{ source().truncated ? '…' : '' }}</blockquote>
    <div class="links">
      <a routerLink="/sources">Open in Sources</a>
      @if (source().url; as url) {
        <a [href]="url" target="_blank" rel="noopener noreferrer">Open original</a>
      }
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 14px 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface-2);
      animation: lens-fade 0.18s ease-out;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      font-size: 13px;
    }
    .name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .where {
      flex: none;
      color: var(--muted);
    }
    .close {
      flex: none;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      margin-left: auto;
      border: none;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--ink-2);
      cursor: pointer;
    }
    .close:hover {
      background: var(--primary-soft);
    }
    blockquote {
      margin: 0;
      padding-left: 12px;
      border-left: 3px solid var(--primary);
      color: var(--ink-2);
      font-size: 14px;
      line-height: 21px;
      white-space: pre-line;
    }
    .links {
      display: flex;
      gap: 16px;
      font-size: 13px;
      font-weight: 600;
    }
    @keyframes lens-fade {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
    }
  `,
})
export class SourcePassage {
  readonly source = input.required<Source>();
  readonly closed = output<void>();
  protected readonly kind = computed(() => KIND_LABEL[this.source().kind]);
}