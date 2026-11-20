import { Component, computed, effect, input, output, signal } from '@angular/core';
import { Icon } from '../../shared/icon';
import { checkUrl } from './url-check';

/** The "YouTube video" and "Web page" cards: a link field and one button. */
@Component({
  selector: 'app-url-form',
  imports: [Icon],
  host: { role: 'region', '[attr.aria-labelledby]': 'fieldId() + "-heading"' },
  template: `
    <h2 [id]="fieldId() + '-heading'">{{ heading() }}</h2>
    <p class="text">{{ text() }}</p>
    <form (submit)="$event.preventDefault(); submit()">
      <label [for]="fieldId()">{{ label() }}</label>
      <input
        type="url"
        inputmode="url"
        autocomplete="off"
        [id]="fieldId()"
        [placeholder]="placeholder()"
        [value]="url()"
        [disabled]="busy()"
        [attr.aria-invalid]="problem() ? true : null"
        [attr.aria-describedby]="problem() ? fieldId() + '-error' : null"
        (input)="onInput(field.value)"
        #field
      />
      @if (problem(); as message) {
        <p class="error" role="alert" [id]="fieldId() + '-error'">{{ message }}</p>
      }
      <button type="submit" [class.busy]="busy()" [disabled]="busy()" [attr.aria-busy]="busy()">
        @if (busy()) {
          <app-icon name="spinner" [size]="16" class="spin" />
          {{ busyText() }}
        } @else {
          {{ action() }}
        }
      </button>
    </form>
    @if (note() && busy()) {
      <span class="note">{{ note() }}</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 20px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: var(--surface);
    }
    h2 {
      font-family: var(--font-body);
      font-size: 16px;
      font-weight: 600;
    }
    .text {
      margin: 0;
      font-size: 14px;
      color: var(--ink-2);
    }
    form {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    label {
      font-size: 13px;
      font-weight: 500;
    }
    input {
      height: 44px;
      padding: 0 12px;
      border: 1px solid var(--border-strong);
      border-radius: 10px;
      background: var(--surface);
      color: var(--ink);
      font: inherit;
      font-size: 14px;
    }
    input[aria-invalid='true'] {
      border-color: var(--danger);
    }
    input:disabled {
      color: var(--muted);
    }
    button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: 44px;
      margin-top: auto;
      border: none;
      border-radius: 10px;
      background: var(--primary);
      color: var(--on-primary);
      font-weight: 600;
      cursor: pointer;
    }
    button.busy {
      background: var(--busy-bg);
      color: var(--busy);
      cursor: progress;
    }
    .spin {
      animation: spin 1s linear infinite;
    }
    .error {
      margin: -4px 0 0;
      font-size: 14px;
      color: var(--danger);
    }
    .note {
      font-size: 13px;
      color: var(--muted);
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class UrlForm {
  readonly kind = input.required<'youtube' | 'web'>();
  /** Base for the field's DOM ids. */
  readonly fieldId = input.required<string>();
  readonly heading = input.required<string>();
  readonly text = input.required<string>();
  readonly label = input.required<string>();
  readonly placeholder = input('');
  readonly action = input.required<string>();
  readonly busyText = input.required<string>();
  /** Shown under the button while busy. */
  readonly note = input('');
  readonly busy = input(false);
  /** Error from the server for the last try. */
  readonly error = input<string | null>(null);
  readonly submitted = output<string>();

  protected readonly url = signal('');
  private readonly invalid = signal<string | null>(null);
  protected readonly problem = computed(() => this.invalid() ?? this.error());

  constructor() {
    // Clear the field once an add finishes without an error.
    let wasBusy = false;
    effect(() => {
      const busy = this.busy();
      if (wasBusy && !busy && !this.error()) this.url.set('');
      wasBusy = busy;
    });
  }

  protected onInput(value: string): void {
    this.url.set(value);
    this.invalid.set(null);
  }

  protected submit(): void {
    const message = checkUrl(this.kind(), this.url());
    this.invalid.set(message);
    if (!message) this.submitted.emit(this.url().trim());
  }
}