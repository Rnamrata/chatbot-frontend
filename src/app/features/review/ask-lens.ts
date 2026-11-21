import {
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  model,
  untracked,
  viewChild,
} from '@angular/core';
import { StatusService } from '../../core/status.service';
import { Icon } from '../../shared/icon';
import { ChatService } from '../chat/chat.service';
import { MessageList } from '../chat/message-list';
import { SuggestedQuestions } from '../chat/suggested-questions';

const SUGGESTIONS = ['Which issue first?', 'Show the fixed file'];

/** "Ask Lens" tab: a chat in the review's own session, so answers come from this code and its findings. */
@Component({
  selector: 'app-ask-lens',
  imports: [Icon, MessageList, SuggestedQuestions],
  template: `
    <div class="scroller" #scroller>
      @if (messages().length) {
        <app-message-list
          [messages]="messages()"
          [showSources]="false"
          [avatarSize]="30"
          pendingText="Reading the code and findings…"
          (retry)="retry($event)"
        />
      } @else {
        <p class="intro">
          Ask anything about this file and its findings, such as how to fix a line. Lens answers from the code and the
          review.
        </p>
      }
    </div>
    <form (submit)="$event.preventDefault(); submit()">
      @if (canAsk()) {
        <app-suggested-questions [questions]="suggestions" (pick)="draft.set($event); focus()" />
      }
      <div class="box">
        <label for="ask-review" class="visually-hidden">Ask about this review</label>
        <input
          #field
          id="ask-review"
          type="text"
          autocomplete="off"
          [value]="draft()"
          [placeholder]="placeholder()"
          [disabled]="!sessionId() || !status.ollamaUp()"
          (input)="draft.set(field.value)"
        />
        <button type="submit" aria-label="Send" [disabled]="!canSend()">
          <app-icon name="send" />
        </button>
      </div>
    </form>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .scroller {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 14px;
      font-size: 14px;
      line-height: 21px;
    }
    .intro {
      margin: 0;
      color: var(--ink-2);
    }
    form {
      flex: none;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px 12px 12px;
      border-top: 1px solid var(--border);
    }
    .box {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 4px 4px 10px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius);
      background: var(--surface);
    }
    .box:focus-within {
      border-color: var(--primary);
    }
    input {
      flex: 1;
      min-width: 0;
      height: 40px;
      border: none;
      outline: none;
      background: transparent;
      color: var(--ink);
      font: inherit;
      font-size: 14px;
    }
    button {
      flex: 0 0 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 44px;
      border: none;
      border-radius: 10px;
      background: var(--primary);
      color: var(--on-primary);
      cursor: pointer;
    }
    button:disabled {
      background: var(--border-strong);
      color: var(--ink-2);
      cursor: default;
    }
  `,
})
export class AskLens {
  readonly sessionId = input.required<string | null>();
  readonly reviewId = input.required<string>();
  readonly draft = model('');
  /** The selected finding's line, for the placeholder. */
  readonly line = input<number | null>(null);

  private readonly chat = inject(ChatService);
  protected readonly status = inject(StatusService);
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  protected readonly suggestions = SUGGESTIONS;

  private readonly conversation = computed(() => {
    const id = this.sessionId();
    return id ? this.chat.conversation(id) : null;
  });

  /** Reloaded history starts with the review summary, which the page already shows. */
  protected readonly messages = computed(() =>
    (this.conversation()?.messages() ?? []).filter((m, i) => !(i === 0 && m.role === 'assistant' && !m.question)),
  );

  private readonly busy = computed(() => this.messages().some((m) => m.status === 'pending'));
  protected readonly canAsk = computed(() => !!this.sessionId() && this.status.ollamaUp() && !this.busy());
  protected readonly canSend = computed(() => this.canAsk() && this.draft().trim().length > 0);

  protected readonly placeholder = computed(() => {
    if (!this.sessionId()) return 'This review has no chat session';
    if (!this.status.ollamaUp()) return 'Waiting for Ollama…';
    const line = this.line();
    return line ? `Ask about line ${line}…` : 'Ask about this review…';
  });

  constructor() {
    effect(() => {
      const id = this.sessionId();
      if (id) untracked(() => this.chat.load(id));
    });

    afterRenderEffect(() => {
      const last = this.messages().at(-1);
      if (!last) return;
      last.status; // also when the pending answer settles
      const el = this.scroller().nativeElement;
      el.scrollTop = el.scrollHeight;
    });
  }

  focus(): void {
    this.field().nativeElement.focus();
  }

  protected submit(): void {
    const id = this.sessionId();
    const question = this.draft().trim();
    if (!id || !question || !this.canAsk()) return;
    this.chat.send(id, question, this.reviewId());
    this.draft.set('');
  }

  protected retry(messageId: string): void {
    const id = this.sessionId();
    if (id) this.chat.retry(id, messageId);
  }
}