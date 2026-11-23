import { Component, computed, input, output } from '@angular/core';
import { Icon } from '../../shared/icon';
import { badgeLabel } from '../sources/source-checks';
import { LibrarySource } from '../sources/sources.models';
import { FileUpload } from './chat.models';

/** Above the message box: which sources this chat answers from, and files being added to it. */
@Component({
  selector: 'app-chat-sources-bar',
  imports: [Icon],
  template: `
    <div class="bar" role="group" aria-label="Sources this chat uses">
      <span class="scope">{{ chips().length || adding().length ? 'Answering from' : 'Answering from all your sources' }}</span>
      @for (chip of chips(); track chip.id) {
        <span class="chip" [class.busy]="chip.busy">
          <span class="badge" [class]="'badge ' + chip.badge">{{ chip.badge }}</span>
          <span class="name" [title]="chip.name">{{ chip.name }}{{ chip.busy ? ' · adding…' : '' }}</span>
          <button type="button" class="x" [attr.aria-label]="'Remove ' + chip.name + ' from this chat'" (click)="remove.emit(chip.id)">
            <app-icon name="close" [size]="14" />
          </button>
        </span>
      }
      @for (u of adding(); track u.id) {
        <span class="chip busy" role="status">
          <app-icon name="spinner" [size]="14" />
          <span class="name" [title]="u.name">{{ u.name }} · reading…</span>
        </span>
      }
      <button type="button" class="add" aria-haspopup="dialog" (click)="add.emit()">
        <app-icon name="plus" [size]="14" />
        Add
      </button>
    </div>
    @for (u of failed(); track u.id) {
      <div class="failed" role="alert">
        <app-icon name="alert" [size]="18" />
        <span class="grow">
          <strong>Couldn't add {{ u.name }}</strong>
          <span>{{ u.error }}</span>
          @if (u.detail) {
            <details>
              <summary>Details</summary>
              {{ u.detail }}
            </details>
          }
        </span>
        <button type="button" class="x" [attr.aria-label]="'Dismiss the message about ' + u.name" (click)="dismiss.emit(u.id)">
          <app-icon name="close" [size]="14" />
        </button>
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 8px;
      font-size: 13px;
    }
    .scope {
      color: var(--muted);
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      max-width: 260px;
      height: 32px;
      padding: 0 4px 0 8px;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: var(--surface);
      color: var(--ink);
    }
    .chip.busy {
      padding-right: 10px;
      color: var(--ink-2);
    }
    .name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .badge {
      flex: none;
      padding: 0 5px;
      border-radius: 5px;
      font-size: 10px;
      font-weight: 700;
      background: var(--primary-soft);
      color: var(--primary-text);
    }
    .badge.WEB {
      background: var(--surface-2);
      color: var(--ink-2);
    }
    .badge.YT {
      background: var(--code-chip);
      color: var(--ink);
    }
    .x {
      flex: 0 0 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: none;
      border-radius: 14px;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
    }
    .x:hover {
      background: var(--surface-2);
      color: var(--ink);
    }
    .add {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 32px;
      padding: 0 10px;
      border: 1px dashed var(--border-strong);
      border-radius: 16px;
      background: transparent;
      color: var(--ink-2);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    .add:hover {
      border-color: var(--primary);
      color: var(--primary-text);
    }
    .failed {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 10px 10px 12px;
      border-radius: 12px;
      background: var(--danger-bg);
      color: var(--danger);
      font-size: 13px;
    }
    .grow {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      color: var(--ink);
    }
    details {
      color: var(--ink-2);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    summary {
      cursor: pointer;
    }
  `,
})
export class ChatSourcesBar {
  /** The chat's own sources (ids); empty means it answers from every source. */
  readonly ids = input.required<string[]>();
  readonly library = input.required<LibrarySource[]>();
  readonly uploads = input<FileUpload[]>([]);
  readonly remove = output<string>();
  readonly add = output<void>();
  readonly dismiss = output<string>();

  protected readonly chips = computed(() => {
    const byId = new Map(this.library().map((s) => [s.id, s]));
    return this.ids()
      .map((id) => byId.get(id))
      .filter((s): s is LibrarySource => !!s) // a source deleted from the library meanwhile
      .map((s) => ({ id: s.id, name: s.name, badge: badgeLabel(s.type, s.source, s.name), busy: s.status === 'processing' }));
  });
  protected readonly adding = computed(() => this.uploads().filter((u) => u.status === 'adding'));
  protected readonly failed = computed(() => this.uploads().filter((u) => u.status === 'failed'));
}
