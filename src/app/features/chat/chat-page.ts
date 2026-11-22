import {
  Component,
  afterNextRender,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PageHeaderService } from '../../core/page-header.service';
import { StatusService } from '../../core/status.service';
import { ChatService } from './chat.service';
import { Composer } from './composer';
import { MessageList } from './message-list';
import { SuggestedQuestions } from './suggested-questions';
import { Problem, Welcome } from './welcome';

/** Shown on an empty chat once there are sources. llm-chatbot doesn't suggest questions yet. */
const STARTERS = ['Summarize my sources in 5 points', 'What are the main ideas?', 'Which terms should I know?'];

/** /chat (new chat) and /chat/:sessionId. */
@Component({
  selector: 'app-chat-page',
  imports: [Composer, MessageList, RouterLink, SuggestedQuestions, Welcome],
  templateUrl: './chat-page.html',
  styleUrl: './chat-page.css',
})
export class ChatPage {
  /** From the route param (withComponentInputBinding); undefined on /chat. */
  readonly sessionId = input<string>();

  private readonly chat = inject(ChatService);
  private readonly status = inject(StatusService);
  private readonly router = inject(Router);

  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private readonly composer = viewChild.required(Composer);

  protected readonly draft = signal('');

  private readonly conversation = computed(() => {
    const id = this.sessionId();
    return id ? this.chat.conversation(id) : null;
  });
  protected readonly messages = computed(() => this.conversation()?.messages() ?? []);
  protected readonly state = computed(() => this.conversation()?.state() ?? 'ready');
  protected readonly busy = computed(() => this.messages().some((m) => m.status === 'pending'));

  protected readonly firstRun = computed(() => this.chat.hasSources() !== true);

  protected readonly problem = computed<Problem>(() => {
    const h = this.status.health();
    if (h.chatServer === 'down') return 'server';
    if (h.ollama === 'down') return 'ollama';
    return null;
  });

  protected readonly canType = computed(() => this.status.ollamaUp() && this.chat.hasSources() !== false);

  protected readonly placeholder = computed(() => {
    const h = this.status.health();
    if (h.chatServer === 'checking') return 'Checking the connection…';
    if (h.chatServer === 'down') return 'Waiting for the chat server…';
    if (h.ollama !== 'up') return 'Waiting for Ollama…';
    if (this.chat.hasSources() === false) return 'Add a source first, then ask anything about it';
    return 'Ask about your documents…';
  });

  protected readonly suggestions = computed(() => {
    if (!this.canType()) return [];
    const list = this.messages();
    if (!list.length) return this.chat.hasSources() ? STARTERS : [];
    const last = list.at(-1)!;
    return last.role === 'assistant' && last.status === 'done' ? last.suggestions : [];
  });

  constructor() {
    this.chat.refreshStats();
    // A new chat moves from /chat to /chat/<id> after the first question: stay in the composer.
    if (this.router.currentNavigation()?.extras.state?.['keepFocus']) {
      afterNextRender(() => this.composer().focus());
    }

    effect(() => {
      const id = this.sessionId();
      if (id) untracked(() => this.chat.load(id));
    });

    // Sessions have no title in llm-chatbot yet, so the first question stands in for one.
    const header = inject(PageHeaderService);
    effect(() => {
      const first = this.messages().find((m) => m.role === 'user');
      header.set(first ? shorten(first.text) : this.sessionId() ? 'Chat' : 'New chat');
    });

    // Keep the newest message in view when one is added or an answer arrives.
    afterRenderEffect(() => {
      const last = this.messages().at(-1);
      if (!last) return;
      last.status; // also re-run when the pending answer settles
      const el = this.scroller().nativeElement;
      el.scrollTop = el.scrollHeight;
    });
  }

  protected ask(question: string): void {
    let id = this.sessionId();
    if (!id) {
      // Flask creates the session on the first /chat call with this id.
      id = crypto.randomUUID();
      void this.router.navigate(['/chat', id], { state: { keepFocus: true } });
    }
    this.chat.send(id, question);
  }

  protected retry(messageId: string): void {
    const id = this.sessionId();
    if (id) this.chat.retry(id, messageId);
  }

  protected reload(): void {
    const id = this.sessionId();
    if (id) this.chat.load(id);
  }

  protected useSuggestion(question: string): void {
    this.draft.set(question);
    this.composer().focus();
  }

  protected checkAgain(): void {
    this.status.recheck();
    this.chat.refreshStats();
  }
}

function shorten(text: string, max = 60): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}