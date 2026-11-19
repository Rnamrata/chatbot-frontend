import { Component, input, signal } from '@angular/core';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'app-code-block',
  imports: [Icon],
  template: `
    <div class="bar">
      <span class="lang">{{ lang() || 'code' }}</span>
      <button type="button" class="copy" [attr.aria-label]="copied() ? 'Code copied' : 'Copy code'" (click)="copy()">
        <app-icon [name]="copied() ? 'check' : 'copy'" [size]="14" />
        {{ copied() ? 'Copied' : 'Copy' }}
      </button>
    </div>
    <pre tabindex="0"><code>{{ code() }}</code></pre>
  `,
  styles: `
    :host {
      display: block;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface-2);
    }
    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 6px 4px 14px;
      border-bottom: 1px solid var(--border);
      font-size: 12px;
      color: var(--muted);
    }
    .copy {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 32px;
      padding: 0 10px;
      border: none;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--ink-2);
      font-size: 12px;
      cursor: pointer;
    }
    .copy:hover {
      background: var(--primary-soft);
      color: var(--ink);
    }
    pre {
      margin: 0;
      padding: 12px 14px;
      overflow-x: auto;
      font: 13px/20px var(--font-mono);
      color: var(--ink);
    }
  `,
})
export class CodeBlock {
  readonly code = input.required<string>();
  readonly lang = input('');
  protected readonly copied = signal(false);

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.code());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // clipboard blocked: nothing to do
    }
  }
}