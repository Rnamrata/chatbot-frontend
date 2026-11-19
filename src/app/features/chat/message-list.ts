import { DatePipe } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
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
  readonly retry = output<string>();

  /** One passage panel open at a time, as in the design. */
  protected readonly open = signal<{ messageId: string; n: number } | null>(null);
  protected readonly copied = signal<string | null>(null);

  /** Read out by screen readers as answers arrive. */
  protected readonly live = computed(() => {
    const last = this.messages().at(-1);
    if (last?.role !== 'assistant') return '';
    if (last.status === 'pending') return 'Lens is searching your sources';
    if (last.status === 'error') return last.error ?? 'Lens could not answer';
    return 'Lens answered';
  });

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