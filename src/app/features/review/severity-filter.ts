import { Component, computed, input, model } from '@angular/core';
import { Finding, Tone, toneOf } from './review.models';

const ORDER: Tone[] = ['high', 'medium', 'low'];

/** "2 high · 1 medium · 1 low" chips; pressing one shows only that severity. */
@Component({
  selector: 'app-severity-filter',
  host: { role: 'group', 'aria-label': 'Filter findings by severity' },
  template: `
    @for (chip of chips(); track chip.tone) {
      <button
        type="button"
        [class]="chip.tone"
        [class.on]="selected() === chip.tone"
        [attr.aria-pressed]="selected() === chip.tone"
        (click)="selected.set(selected() === chip.tone ? null : chip.tone)"
      >
        {{ chip.count }} {{ chip.tone }}
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
      height: 32px;
      padding: 0 12px;
      border: 2px solid transparent;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .high {
      background: var(--sev-high-bg);
      color: var(--sev-high);
    }
    .medium {
      background: var(--sev-med-bg);
      color: var(--sev-med);
    }
    .low {
      background: var(--sev-low-bg);
      color: var(--sev-low);
    }
    .on {
      border-color: currentColor;
    }
  `,
})
export class SeverityFilter {
  readonly findings = input.required<Finding[]>();
  readonly selected = model<Tone | null>(null);

  protected readonly chips = computed(() => {
    const counts = new Map<Tone, number>();
    for (const f of this.findings()) {
      const tone = toneOf(f.severity);
      counts.set(tone, (counts.get(tone) ?? 0) + 1);
    }
    return ORDER.filter((tone) => counts.has(tone)).map((tone) => ({ tone, count: counts.get(tone)! }));
  });
}