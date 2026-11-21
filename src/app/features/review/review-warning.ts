import { Component, computed, input, output } from '@angular/core';
import { Icon } from '../../shared/icon';
import { ReviewWarning as Warning, sourceLabel } from './review.models';

/**
 * Banner over a review that did not fully run: one check failed (partial), or the
 * review service could not be reached at all (failed).
 */
@Component({
  selector: 'app-review-warning',
  imports: [Icon],
  host: { role: 'alert', '[class.failed]': 'failed()' },
  template: `
    <app-icon [name]="failed() ? 'alert' : 'warning'" [size]="20" class="icon" />
    <div class="text">
      <strong>{{ failed() ? 'This file was not reviewed' : 'Only part of this review ran' }}</strong>
      @for (line of lines(); track $index) {
        <span>{{ line }}</span>
      }
      <span>{{ consequence() }}</span>
    </div>
    @if (canRetry()) {
      <button type="button" (click)="retry.emit()">Run the review again</button>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      border-radius: var(--radius);
      background: var(--warn-bg);
      box-shadow: inset 4px 0 0 var(--warn-bar);
    }
    :host(.failed) {
      background: var(--danger-bg);
      box-shadow: inset 4px 0 0 var(--danger-bar);
    }
    .icon {
      margin-top: 1px;
      color: var(--warn);
    }
    :host(.failed) .icon {
      color: var(--danger);
    }
    .text {
      flex: 1 1 360px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      color: var(--ink-2);
      overflow-wrap: anywhere;
    }
    .text strong {
      color: var(--ink);
    }
    button {
      height: 40px;
      padding: 0 14px;
      border: 1px solid var(--border-strong);
      border-radius: 10px;
      background: var(--surface);
      color: var(--ink);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
  `,
})
export class ReviewWarning {
  readonly warnings = input<Warning[]>([]);
  /** Set when the review service could not be reached at all. */
  readonly failure = input<string | undefined>(undefined);
  /** The checks that did run, e.g. "Ruff". */
  readonly ranWith = input<string | null>(null);
  readonly canRetry = input(false);
  readonly retry = output<void>();

  protected readonly failed = computed(() => !!this.failure());

  protected readonly lines = computed(() =>
    this.failed()
      ? [this.failure()!]
      : this.warnings().map((w) => `${sourceLabel(w.source)} couldn't run: ${w.message.replace(/\.?$/, '.')}`),
  );

  protected readonly consequence = computed(() => {
    if (this.failed()) return 'The code was saved, so you can still ask about it, but no checks ran.';
    const ran = this.ranWith();
    return ran
      ? `These results come from ${ran} alone, so this file may have problems that aren't listed here.`
      : "So this file may have problems that aren't listed here.";
  });
}