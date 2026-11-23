import { Component, ElementRef, afterRenderEffect, computed, input, model, output, viewChild } from '@angular/core';
import { Icon } from '../../shared/icon';

const MAX_HEIGHT = 200;

/** Enter sends, Shift + Enter adds a line. + opens "Add sources to this chat". */
@Component({
  selector: 'app-composer',
  imports: [Icon],
  template: `
    <form class="box" [class.off]="disabled()" (submit)="$event.preventDefault(); submit()">
      @if (canAddSources()) {
        <button type="button" class="attach" aria-label="Add sources" aria-haspopup="dialog" (click)="addSources.emit()">
          <app-icon name="plus" [size]="20" />
        </button>
      }
      <label for="ask" class="visually-hidden">Ask a question</label>
      <textarea
        #box
        id="ask"
        rows="1"
        [value]="draft()"
        [disabled]="disabled()"
        [placeholder]="placeholder()"
        (input)="draft.set(box.value)"
        (keydown)="onKey($event)"
      ></textarea>
      <button type="submit" class="send" aria-label="Send" [disabled]="!canSend()">
        <app-icon name="send" />
      </button>
    </form>
  `,
  styles: `
    .box {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      padding: 8px;
      border: 1px solid var(--border-strong);
      border-radius: 16px;
      background: var(--surface);
    }
    .box:focus-within {
      border-color: var(--primary);
    }
    .box.off {
      border-color: var(--border);
      background: var(--surface-2);
    }
    .attach,
    .send {
      flex: 0 0 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 44px;
      border: none;
      border-radius: 10px;
    }
    .attach {
      background: transparent;
      color: var(--ink-2);
      cursor: pointer;
    }
    .attach:hover {
      background: var(--primary-soft);
      color: var(--ink);
    }
    textarea {
      flex: 1;
      min-width: 0;
      min-height: 44px;
      padding: 11px 4px;
      border: none;
      outline: none;
      resize: none;
      background: transparent;
      color: var(--ink);
      font: inherit;
    }
    textarea:disabled {
      color: var(--muted);
    }
    .send {
      background: var(--primary);
      color: var(--on-primary);
      cursor: pointer;
    }
    .send:disabled {
      background: var(--border-strong);
      color: var(--ink-2);
      cursor: default;
    }
  `,
})
export class Composer {
  readonly draft = model('');
  readonly disabled = input(false);
  /** An answer is on its way: typing is fine, sending waits. */
  readonly busy = input(false);
  readonly placeholder = input('Ask about your documents…');
  /** False when there is nothing to send yet (no sources and no link in the message). */
  readonly canSubmit = input(true);
  /** Shows the + button (document chats only). */
  readonly canAddSources = input(true);
  readonly send = output<string>();
  readonly addSources = output<void>();

  private readonly box = viewChild.required<ElementRef<HTMLTextAreaElement>>('box');

  protected readonly canSend = computed(
    () => !this.disabled() && !this.busy() && this.canSubmit() && this.draft().trim().length > 0,
  );

  constructor() {
    // Grow with the text, up to MAX_HEIGHT, then scroll. Empty: back to one row.
    afterRenderEffect(() => {
      const value = this.draft();
      const el = this.box().nativeElement;
      el.style.height = 'auto';
      if (value) el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    });
  }

  focus(): void {
    this.box().nativeElement.focus();
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.submit();
    }
  }

  protected submit(): void {
    if (!this.canSend()) return;
    this.send.emit(this.draft().trim());
    this.draft.set('');
    // Also empty the box itself: after fast typing, Angular may not have drawn the typed text
    // yet, so to the [value] binding '' looks unchanged and the old text would stay.
    this.box().nativeElement.value = '';
  }
}