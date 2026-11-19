import { Component, input, output } from '@angular/core';
import { Source } from './chat.models';

/** "Sources 1 · notes.pdf  2 · …" under an answer. Each chip opens that passage. */
@Component({
  selector: 'app-source-chips',
  template: `
    <span class="label">Sources</span>
    @for (s of sources(); track s.n) {
      <button
        type="button"
        class="chip"
        [class.on]="openN() === s.n"
        [attr.aria-expanded]="openN() === s.n"
        [attr.aria-controls]="panelId()"
        [title]="s.name"
        (click)="toggleSource.emit(s.n)"
      >
        {{ s.n }} · {{ s.name }}
      </button>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .label {
      font-size: 13px;
      color: var(--muted);
    }
    .chip {
      max-width: 260px;
      min-height: 32px;
      padding: 0 6px;
      overflow: hidden;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: var(--primary-text);
      font-size: 13px;
      font-weight: 500;
      text-decoration: underline;
      text-underline-offset: 3px;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: pointer;
    }
    .chip.on {
      background: var(--primary-soft);
      font-weight: 600;
      text-decoration: none;
    }
  `,
})
export class SourceChips {
  readonly sources = input.required<Source[]>();
  readonly openN = input<number | null>(null);
  readonly panelId = input.required<string>();
  readonly toggleSource = output<number>();
}