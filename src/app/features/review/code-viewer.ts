import { Component, ElementRef, afterRenderEffect, computed, inject, input, signal, untracked } from '@angular/core';
import { Icon } from '../../shared/icon';
import { Row, Token, buildRows, foldKey, tokenize } from './code-view';
import { Finding, Tone, toneOf } from './review.models';

/** One row of the viewer: a code line, or a fold standing in for lines from–to. */
interface RowView {
  key: string;
  kind: 'line' | 'fold';
  n: number;
  tokens: Token[];
  tone: Tone | null;
  selected: boolean;
  from: number;
  to: number;
  label: string;
}

/**
 * The reviewed file with line numbers, simple syntax colours and the finding lines
 * highlighted. Lines more than 2 away from any finding fold away.
 */
@Component({
  selector: 'app-code-viewer',
  imports: [Icon],
  host: { role: 'region', 'aria-label': 'Code' },
  template: `
    <div class="bar">
      <span>{{ caption() }}</span>
      @if (foldable()) {
        <span>Lines without issues are folded</span>
      } @else if (note()) {
        <span>{{ note() }}</span>
      }
    </div>
    <div class="code" tabindex="0">
      @for (row of rows(); track row.key) {
        @if (row.kind === 'line') {
          <div
            class="row"
            [id]="'line-' + row.n"
            [class.high]="row.tone === 'high'"
            [class.medium]="row.tone === 'medium'"
            [class.low]="row.tone === 'low'"
            [class.selected]="row.selected"
          >
            <span class="n">{{ row.n }}</span>
            <span class="src">@for (t of row.tokens; track $index) {<span [class]="'tk-' + t.kind">{{ t.text }}</span>}</span>
          </div>
        } @else {
          <button type="button" class="fold" (click)="unfold(row.from, row.to)">
            <app-icon name="unfold" [size]="14" />
            {{ row.label }}
          </button>
        }
      }
    </div>
  `,
  styleUrl: './code-viewer.css',
})
export class CodeViewer {
  readonly code = input.required<string>();
  readonly language = input<string | null>(null);
  /** Every finding: decides what folds. */
  readonly findings = input<Finding[]>([]);
  /** The findings to highlight (after the severity filter). */
  readonly shown = input<Finding[]>([]);
  readonly selectedLine = input<number | null>(null);
  readonly caption = input('');
  /** Right-hand note when nothing is folded. */
  readonly note = input('');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly unfolded = signal<ReadonlySet<string>>(new Set());

  private readonly lines = computed(() => this.code().replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n'));
  private readonly tokens = computed(() => this.lines().map((line) => tokenize(line, this.language())));

  /** Most serious tone per line; findings arrive most serious first. */
  private readonly toneByLine = computed(() => {
    const map = new Map<number, Tone>();
    for (const f of this.shown()) if (!map.has(f.line)) map.set(f.line, toneOf(f.severity));
    return map;
  });

  private readonly layout = computed<Row[]>(() =>
    buildRows(
      this.lines().length,
      this.findings().map((f) => f.line).filter((n) => n > 0),
      this.unfolded(),
    ),
  );

  protected readonly foldable = computed(() => this.layout().some((r) => r.kind === 'fold'));

  protected readonly rows = computed<RowView[]>(() => {
    const tokens = this.tokens();
    const tones = this.toneByLine();
    const selected = this.selectedLine();
    return this.layout().map((r): RowView => {
      if (r.kind === 'fold') {
        const count = r.to - r.from + 1;
        return {
          key: `f${r.from}`,
          kind: 'fold',
          n: 0,
          tokens: [],
          tone: null,
          selected: false,
          from: r.from,
          to: r.to,
          label: `Show ${count} lines without issues (${r.from}–${r.to})`,
        };
      }
      const tone = tones.get(r.n) ?? null;
      return {
        key: `l${r.n}`,
        kind: 'line',
        n: r.n,
        tokens: tokens[r.n - 1] ?? [],
        tone,
        selected: tone !== null && r.n === selected,
        from: 0,
        to: 0,
        label: '',
      };
    });
  });

  constructor() {
    // Bring the selected finding's line into view.
    afterRenderEffect(() => {
      const line = this.selectedLine();
      if (line === null) return;
      untracked(() => {
        const el = this.host.nativeElement.querySelector<HTMLElement>(`#line-${line}`);
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        el?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      });
    });
  }

  protected unfold(from: number, to: number): void {
    this.unfolded.update((set) => new Set(set).add(foldKey(from, to)));
  }
}