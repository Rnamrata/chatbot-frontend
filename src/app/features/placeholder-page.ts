import { Component, effect, inject, input } from '@angular/core';
import { PageHeaderService } from '../core/page-header.service';
import { LensAvatar } from '../shared/lens-avatar';

/** Stand-in for screens built in later phases. Inputs come from the route's `data`. */
@Component({
  selector: 'app-placeholder-page',
  imports: [LensAvatar],
  template: `
    <section class="placeholder">
      <app-lens-avatar [size]="72" />
      <h2>{{ heading() }}</h2>
      <p>This screen is built in {{ phase() }}.</p>
    </section>
  `,
  styles: `
    .placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 80px 24px;
      text-align: center;
      color: var(--muted);
    }
    h2 {
      font-size: 24px;
      color: var(--ink);
    }
    p {
      margin: 0;
    }
  `,
})
export class PlaceholderPage {
  readonly heading = input('');
  readonly subtitle = input<string | null>(null);
  readonly phase = input('a later phase');

  constructor() {
    const header = inject(PageHeaderService);
    effect(() => header.set(this.heading(), this.subtitle()));
  }
}