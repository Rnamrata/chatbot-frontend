import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReviewStateService } from '../core/review-state.service';
import { Icon } from '../shared/icon';

export type Mode = 'chat' | 'review';

@Component({
  selector: 'app-mode-switch',
  imports: [RouterLink, Icon],
  template: `
    <div role="group" aria-label="Mode" class="switch" [class.compact]="compact()">
      <a
        routerLink="/chat"
        class="opt"
        [class.on]="mode() === 'chat'"
        [attr.aria-current]="mode() === 'chat' ? 'page' : null"
        [attr.aria-label]="compact() ? 'Document Q&A' : null"
      >
        <app-icon name="doc" [size]="16" />
        @if (!compact()) {
          <span>Document Q&amp;A</span>
        }
      </a>
      <a
        [routerLink]="reviewLink()"
        class="opt"
        [class.on]="mode() === 'review'"
        [attr.aria-current]="mode() === 'review' ? 'page' : null"
        [attr.aria-label]="compact() ? 'Code Review' : null"
      >
        <app-icon name="code" [size]="16" />
        @if (!compact()) {
          <span>Code Review</span>
        }
      </a>
    </div>
  `,
  styles: `
    .switch {
      display: flex;
      gap: 4px;
      padding: 4px;
      border-radius: var(--radius);
      background: var(--primary-soft);
    }
    .opt {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 38px;
      padding: 0 14px;
      border-radius: 9px;
      color: var(--ink-2);
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
    }
    .opt:hover {
      color: var(--ink);
    }
    .opt.on {
      background: var(--surface);
      color: var(--ink);
      font-weight: 600;
      box-shadow: var(--shadow-sm);
    }
    .compact .opt {
      padding: 0 11px;
    }
  `,
})
export class ModeSwitch {
  readonly mode = input.required<Mode>();
  readonly compact = input(false);

  private readonly reviewState = inject(ReviewStateService);

  /** Code Review reopens the last review, or the start screen if there is none. */
  protected readonly reviewLink = computed(() => {
    const id = this.reviewState.lastReviewId();
    return id ? ['/review', id] : ['/review'];
  });
}