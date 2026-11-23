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
import { Icon } from '../../shared/icon';
import { checkFile, findLink } from '../sources/source-checks';
import { SourcesService } from '../sources/sources.service';
import { AddSourcesDialog } from './add-sources-dialog';
import { ChatService } from './chat.service';
import { ChatSourcesBar } from './chat-sources-bar';
import { Composer } from './composer';
import { MessageList } from './message-list';
import { SuggestedQuestions } from './suggested-questions';
import { Problem, Welcome } from './welcome';

/** Shown on an empty chat once there are sources. llm-chatbot doesn't suggest questions yet. */
const STARTERS = ['Summarize my sources in 5 points', 'What are the main ideas?', 'Which terms should I know?'];

/** /chat (new chat) and /chat/:sessionId. */
@Component({
  selector: 'app-chat-page',
  imports: [AddSourcesDialog, ChatSourcesBar, Composer, Icon, MessageList, RouterLink, SuggestedQuestions, Welcome],
  templateUrl: './chat-page.html',
  styleUrl: './chat-page.css',
  host: {
    '(dragover)': 'onDragOver($event)',
    '(dragleave)': 'onDragLeave($event)',
    '(drop)': 'onDrop($event)',
  },
})
export class ChatPage {
  /** From the route param (withComponentInputBinding); undefined on /chat. */
  readonly sessionId = input<string>();

  private readonly chat = inject(ChatService);
  private readonly status = inject(StatusService);
  private readonly router = inject(Router);
  protected readonly library = inject(SourcesService);

  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private readonly composer = viewChild.required(Composer);

  protected readonly draft = signal('');
  protected readonly dialogOpen = signal(false);
  protected readonly dragging = signal(false);
  protected readonly dropProblem = signal<string | null>(null);
  /** A link the person chose to keep as text instead of adding it as a source. */
  protected readonly dismissedUrl = signal<string | null>(null);

  private readonly conversation = computed(() => {
    const id = this.sessionId();
    return id ? this.chat.conversation(id) : null;
  });
  protected readonly messages = computed(() => this.conversation()?.messages() ?? []);
  protected readonly state = computed(() => this.conversation()?.state() ?? 'ready');
  protected readonly busy = computed(() => this.messages().some((m) => m.status === 'pending'));
  protected readonly sourceIds = computed(() => this.conversation()?.sourceIds() ?? []);
  protected readonly uploads = computed(() => this.conversation()?.uploads() ?? []);
  protected readonly sourcesError = computed(() => this.conversation()?.sourcesError() ?? null);

  /** A YouTube or web link in the message, to add as a source when it's sent. */
  protected readonly pastedLink = computed(() => {
    const link = findLink(this.draft());
    return link && link.url !== this.dismissedUrl() ? link : null;
  });

  protected readonly firstRun = computed(() => this.chat.hasSources() !== true);

  protected readonly problem = computed<Problem>(() => {
    const h = this.status.health();
    if (h.chatServer === 'down') return 'server';
    if (h.ollama === 'down') return 'ollama';
    return null;
  });

  protected readonly canType = computed(() => this.status.ollamaUp());
  /** With no sources at all, only a message with a link to add can be sent. */
  protected readonly canSubmit = computed(() => this.chat.hasSources() !== false || !!this.pastedLink());

  protected readonly placeholder = computed(() => {
    const h = this.status.health();
    if (h.chatServer === 'checking') return 'Checking the connection…';
    if (h.chatServer === 'down') return 'Waiting for the chat server…';
    if (h.ollama !== 'up') return 'Waiting for Ollama…';
    if (this.chat.hasSources() === false) return 'Paste a YouTube or web link, or press + to upload a file';
    return this.sourceIds().length ? 'Ask about these sources…' : 'Ask about all your sources…';
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
    this.library.load();
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
      const n = this.sourceIds().length;
      header.set(
        first ? shorten(first.text || first.link?.url || 'Chat') : 'New chat',
        n === 0 ? 'All sources' : n === 1 ? '1 source' : `${n} sources`,
      );
    });

    // A new link pasted in the message is offered again, even if an earlier one was kept as text
    effect(() => {
      const link = findLink(this.draft());
      if (!link) untracked(() => this.dismissedUrl.set(null));
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
    const link = this.pastedLink();
    const id = this.ensureSession();
    if (link) {
      this.chat.send(id, link.rest, { link: { kind: link.kind, url: link.url } });
    } else {
      this.chat.send(id, question);
    }
    this.dismissedUrl.set(null);
  }

  protected retryLink(messageId: string): void {
    const id = this.sessionId();
    if (id) this.chat.retryLink(id, messageId);
  }

  protected useSources(ids: string[]): void {
    this.chat.setSources(this.ensureSession(), ids);
  }

  protected removeSource(sourceId: string): void {
    const id = this.sessionId();
    if (id) this.chat.setSources(id, this.sourceIds().filter((x) => x !== sourceId));
  }

  protected addFile(file: File): void {
    this.chat.addFile(this.ensureSession(), file);
  }

  protected dismissUpload(uploadId: string): void {
    const id = this.sessionId();
    if (id) this.chat.dismissUpload(id, uploadId);
  }

  protected onDragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    // Leaving the page, not moving between its children
    if (!event.relatedTarget || !(event.currentTarget as Node).contains(event.relatedTarget as Node)) this.dragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    this.dragging.set(false);
    const files = [...event.dataTransfer.files];
    const problems = files.map(checkFile).filter((p): p is string => !!p);
    this.dropProblem.set(problems.join(' ') || null);
    for (const f of files) if (!checkFile(f)) this.addFile(f);
  }

  protected shortUrl(url: string): string {
    return url.replace(/^https?:\/\/(www\.)?/, '');
  }

  /**
   * The chat's id. A new chat gets one as soon as it needs it (its first question, a source
   * chosen or a file added) and moves from /chat to /chat/<id>.
   */
  private ensureSession(): string {
    let id = this.sessionId();
    if (!id) {
      // Flask creates the session on the first call that uses this id.
      id = crypto.randomUUID();
      this.chat.start(id);
      void this.router.navigate(['/chat', id], { state: { keepFocus: true } });
    }
    return id;
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