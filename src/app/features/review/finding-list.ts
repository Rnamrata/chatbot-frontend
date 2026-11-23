import { Component, computed, input, output } from '@angular/core';
import { Icon } from '../../shared/icon';
import { Finding, sourceLabel, toneOf } from './review.models';

/** Findings tab: one card per finding; the selected one opens with its suggestion. */
@Component({
  selector: 'app-finding-list',
  imports: [Icon],
  template: `
    <div class="head">
      <span class="title">{{ title() }}</span>
      @if (items().length) {
        <span class="hint">Select one to see it in the code</span>
      }
    </div>

    @for (f of items(); track f.index) {
      <div class="card" [class.on]="f.index === selected()">
        <button
          type="button"
          class="pick"
          [attr.aria-expanded]="f.index === selected()"
          (click)="selectFinding.emit(f.index === selected() ? null : f.index)"
        >
          <span class="meta">
            <span [class]="'sev ' + f.tone">{{ f.severity }}</span>
            <span class="where">{{ f.where }}</span>
            @if (f.fromAI) {
              <span class="ai" title="Found by the AI reviewer, which can be wrong">AI · check it</span>
            }
          </span>
          <span class="msg">{{ f.finding.message }}</span>
        </button>
        @if (f.index === selected()) {
          <div class="more">
            @if (f.fromAI) {
              <p class="ai-note">
                Found by the AI reviewer, which can misread code or point at a nearby line. Check the code before you
                change it.
              </p>
            }
            @if (f.snippet) {
              <!-- The flagged line itself, for when the code viewer is out of sight (phones, narrow windows) -->
              <div class="snippet"><span class="n" aria-hidden="true">{{ f.finding.line }}</span><code>{{ f.snippet }}</code></div>
            }
            @if (f.finding.suggestion) {
              <p class="tip">
                <app-icon name="idea" [size]="16" class="idea" />
                <span><strong>Suggestion: </strong>{{ f.finding.suggestion }}</span>
              </p>
            }
            @if (f.finding.line > 0) {
              <button type="button" class="ask" (click)="ask.emit(f.finding.line)">
                Ask about line {{ f.finding.line }}
                <app-icon name="arrowRight" [size]="14" />
              </button>
            }
          </div>
        }
      </div>
    } @empty {
      <p class="none">{{ emptyText() }}</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
      padding: 0 2px;
    }
    .title {
      font-size: 13px;
      font-weight: 600;
    }
    .hint {
      font-size: 12px;
      color: var(--muted);
    }
    .card {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
    }
    .card.on {
      border: 2px solid var(--primary);
    }
    .pick {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: 100%;
      padding: 12px 14px;
      border: none;
      background: transparent;
      color: var(--ink);
      text-align: left;
      cursor: pointer;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 600;
    }
    .ai {
      padding: 0 7px;
      border: 1px dashed var(--muted);
      border-radius: 10px;
      color: var(--ink-2);
      font-weight: 500;
    }
    .ai-note {
      margin: 0;
      color: var(--ink-2);
      font-size: 13px;
      line-height: 20px;
    }
    .sev {
      padding: 1px 8px;
      border-radius: 10px;
      text-transform: capitalize;
    }
    .sev.high {
      background: var(--sev-high-bg);
      color: var(--sev-high);
    }
    .sev.medium {
      background: var(--sev-med-bg);
      color: var(--sev-med);
    }
    .sev.low {
      background: var(--sev-low-bg);
      color: var(--sev-low);
    }
    .where {
      color: var(--muted);
    }
    .msg {
      font-weight: 500;
      overflow-wrap: anywhere;
    }
    .more {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 0 14px 14px;
      animation: fade-in 0.18s ease-out;
    }
    .snippet {
      display: flex;
      overflow-x: auto;
      padding: 8px 0;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--code-bg);
      font: 12px/18px var(--font-mono);
    }
    .snippet .n {
      flex: 0 0 36px;
      padding-right: 10px;
      color: var(--line-no);
      text-align: right;
      user-select: none;
    }
    .snippet code {
      padding-right: 10px;
      white-space: pre;
    }
    .tip {
      display: flex;
      gap: 8px;
      margin: 0;
      padding: 10px 12px;
      border-radius: 10px;
      background: var(--surface-2);
      font-size: 13px;
      line-height: 20px;
      color: var(--ink-2);
    }
    .tip strong {
      color: var(--ink);
    }
    .idea {
      margin-top: 2px;
      color: var(--primary-text);
    }
    .ask {
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 36px;
      padding: 0 12px;
      border: 1px solid var(--border-strong);
      border-radius: 10px;
      background: var(--surface);
      color: var(--primary-text);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .none {
      margin: 0;
      padding: 16px 2px;
      color: var(--ink-2);
      font-size: 14px;
    }
    @keyframes fade-in {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
    }
  `,
})
export class FindingList {
  /** The findings to list (after the severity filter); index is the position in the full list. */
  readonly findings = input.required<{ index: number; finding: Finding }[]>();
  readonly code = input('');
  readonly selected = input<number | null>(null);
  readonly title = input('Findings');
  readonly emptyText = input('No findings.');
  readonly selectFinding = output<number | null>();
  readonly ask = output<number>();
  private readonly lines = computed(() => this.code().replace(/\r\n?/g, '\n').split('\n'));

  protected readonly items = computed(() =>
    this.findings().map(({ index, finding }) => ({
      index,
      finding,
      tone: toneOf(finding.severity),
      // Linters and the secret scan are exact; the model is a second opinion
      fromAI: finding.source === 'llm',
      severity: finding.severity || 'info',
      snippet: finding.line > 0 ? (this.lines()[finding.line - 1] ?? '').trim() : '',
      where: [finding.line > 0 ? `Line ${finding.line}` : 'Whole file', finding.category, sourceLabel(finding.source)]
        .filter(Boolean)
        .join(' · '),
    })),
  );
}