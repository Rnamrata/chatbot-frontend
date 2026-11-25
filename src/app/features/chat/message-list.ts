import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { Icon } from '../../shared/icon';
import { LensAvatar } from '../../shared/lens-avatar';
import { Message, Source } from './chat.models';
import { MarkdownAnswer } from './markdown-answer';
import { SourceChips } from './source-chips';
import { SourcePassage } from './source-passage';

@Component({
  selector: 'app-message-list',
  imports: [DatePipe, Icon, LensAvatar, MarkdownAnswer, SourceChips, SourcePassage],
  templateUrl: './message-list.html',
  styleUrl: './message-list.css',
})
export class MessageList {
  readonly messages = input.required<Message[]>();
  readonly showSources = input(true);
  readonly avatarSize = input(40);
  readonly pendingText = input('Searching your sources…');
  readonly retry = output<string>();
  /** A link sent with a question couldn't be added: try again. */
  readonly retryLink = output<string>();

  /** Ticks while a link is being added, for its elapsed time ("transcribing, 1:42"). */
  private readonly now = signal(Date.now());

  /** One passage panel open at a time, as in the design. */
  protected readonly open = signal<{ messageId: string; n: number } | null>(null);
  protected readonly copied = signal<string | null>(null);

  /** Read out by screen readers as answers arrive. */
  protected readonly live = computed(() => {
    const last = this.messages().at(-1);
    if (last?.role !== 'assistant') return '';
        if (last.status === 'pending') return `Lens is working: ${this.pendingText()}`;
    if (last.status === 'error') return last.error ?? 'Lens could not answer';
    return 'Lens answered';
  });

  constructor() {
    let timer: ReturnType<typeof setInterval> | undefined;
    effect(() => {
      const adding = this.messages().some((m) => m.link?.status === 'adding' || (m.status === 'pending' && m.progress));
      if (adding && !timer) {
        timer = setInterval(() => this.now.set(Date.now()), 1000);
      } else if (!adding && timer) {
        clearInterval(timer);
        timer = undefined;
      }
    });
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected elapsed(since: number): string {
    const s = Math.max(0, Math.floor((this.now() - since) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  protected shortUrl(url: string): string {
    return url.replace(/^https?:\/\/(www\.)?/, '');
  }

  protected openN(m: Message): number | null {
    const o = this.open();
    return o?.messageId === m.id ? o.n : null;
  }

  protected openSource(m: Message): Source | null {
    const n = this.openN(m);
    return n === null ? null : (m.sources.find((s) => s.n === n) ?? null);
  }

  protected toggle(messageId: string, n: number): void {
    this.open.update((o) => (o?.messageId === messageId && o.n === n ? null : { messageId, n }));
  }

  protected async copy(m: Message): Promise<void> {
    try {
      await navigator.clipboard.writeText(m.text);
      this.copied.set(m.id);
      setTimeout(() => this.copied.update((id) => (id === m.id ? null : id)), 2000);
    } catch {
      // clipboard blocked: nothing to do
    }
  }
}