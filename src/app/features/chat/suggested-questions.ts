import { Component, input, output } from '@angular/core';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'app-suggested-questions',
  imports: [Icon],
  host: { role: 'group', 'aria-label': 'Suggested questions' },
  template: `
    @for (q of questions(); track q) {
      <button type="button" (click)="pick.emit(q)">
        <app-icon name="sparkle" [size]="14" class="spark" />
        {{ q }}
      </button>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 36px;
      padding: 0 12px;
      border: 1px solid var(--border-strong);
      border-radius: 18px;
      background: var(--surface);
      color: var(--ink-2);
      font-size: 13px;
      cursor: pointer;
    }
    button:hover {
      border-color: var(--primary);
      color: var(--ink);
    }
    .spark {
      color: var(--primary-text);
    }
  `,
})
export class SuggestedQuestions {
  readonly questions = input.required<string[]>();
  readonly pick = output<string>();
}