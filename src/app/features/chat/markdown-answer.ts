import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { marked } from 'marked';
import { CodeBlock } from './code-block';
import { splitFences } from './markdown';

/**
 * Renders an answer's markdown. Code fences become CodeBlock components; the rest goes
 * through marked and [innerHTML], which Angular sanitizes (scripts and handlers are stripped).
 */
@Component({
  selector: 'app-markdown-answer',
  imports: [CodeBlock],
  encapsulation: ViewEncapsulation.None, // the [innerHTML] content needs these styles
  template: `
    @for (part of parts(); track $index) {
      @if (part.kind === 'code') {
        <app-code-block [code]="part.text" [lang]="part.lang" />
      } @else {
        <div class="md" [innerHTML]="part.html"></div>
      }
    }
  `,
  styles: `
    app-markdown-answer {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-top: 4px;
      overflow-wrap: anywhere;
    }
    app-markdown-answer .md > :first-child {
      margin-top: 0;
    }
    app-markdown-answer .md > :last-child {
      margin-bottom: 0;
    }
    app-markdown-answer .md p {
      margin: 0 0 10px;
    }
    app-markdown-answer .md :is(h1, h2, h3, h4) {
      margin: 16px 0 6px;
      font-size: 17px;
      line-height: 24px;
      font-weight: 600;
    }
    app-markdown-answer .md :is(ul, ol) {
      margin: 0 0 10px;
      padding-left: 22px;
    }
    app-markdown-answer .md li + li {
      margin-top: 4px;
    }
    app-markdown-answer .md code {
      padding: 1px 6px;
      border-radius: 6px;
      background: var(--code-chip);
      font: 13px var(--font-mono);
    }
    app-markdown-answer .md blockquote {
      margin: 0 0 10px;
      padding-left: 12px;
      border-left: 3px solid var(--border-strong);
      color: var(--ink-2);
    }
    app-markdown-answer .md table {
      margin: 0 0 10px;
      border-collapse: collapse;
      font-size: 14px;
    }
    app-markdown-answer .md :is(th, td) {
      padding: 6px 10px;
      border: 1px solid var(--border);
      text-align: left;
    }
  `,
})
export class MarkdownAnswer {
  readonly text = input.required<string>();

  protected readonly parts = computed(() =>
    splitFences(this.text()).map((part) => ({
      ...part,
      html: part.kind === 'text' ? (marked.parse(part.text, { async: false, gfm: true }) as string) : '',
    })),
  );
}