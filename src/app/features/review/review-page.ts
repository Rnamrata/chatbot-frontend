import { Component, DestroyRef, Signal, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PageHeaderService } from '../../core/page-header.service';
import { Icon } from '../../shared/icon';
import { LensAvatar } from '../../shared/lens-avatar';
import { AskLens } from './ask-lens';
import { CodeViewer } from './code-viewer';
import { FindingList } from './finding-list';
import { Review, Tone, analyzersFor, languageLabel, toneOf } from './review.models';
import { Loaded, ReviewService } from './review.service';
import { ReviewWarning } from './review-warning';
import { SeverityFilter } from './severity-filter';

/** After this long the status says the review is taking longer than usual. */
const SLOW_AFTER_S = 30;

type View = 'running' | 'stopped' | 'ready' | 'loading' | 'missing' | 'error';

/**
 * /review/:reviewId. The id is either a job started in this tab (in progress) or a
 * stored review's id. A finished job moves to /review/<review_id>.
 */
@Component({
  selector: 'app-review-page',
  imports: [AskLens, CodeViewer, FindingList, Icon, LensAvatar, ReviewWarning, RouterLink, SeverityFilter],
  templateUrl: './review-page.html',
  styleUrl: './review-page.css',
})
export class ReviewPage {
  readonly reviewId = input.required<string>();

  private readonly reviews = inject(ReviewService);
  private readonly router = inject(Router);
  private readonly askLens = viewChild(AskLens);

  private readonly now = signal(Date.now());
  private readonly loaded = signal<Signal<Loaded> | null>(null);

  protected readonly job = computed(() => this.reviews.job(this.reviewId())?.() ?? null);

  protected readonly review = computed<Review | null>(() => {
    const loaded = this.loaded()?.();
    return loaded?.state === 'ready' ? loaded.review : null;
  });

  protected readonly view = computed<View>(() => {
    const job = this.job();
    if (job) return job.stopped ? 'stopped' : 'running';
    const loaded = this.loaded()?.();
    return loaded?.state ?? 'loading';
  });

  protected readonly loadError = computed(() => {
    const loaded = this.loaded()?.();
    return loaded?.state === 'error' ? loaded.message : '';
  });

  // ---------- in progress ----------

  protected readonly elapsed = computed(() => {
    const job = this.job();
    if (!job) return 0;
    const end = job.stoppedAt ?? this.now();
    return Math.max(0, Math.floor((end - job.startedAt) / 1000));
  });
  protected readonly clock = computed(() => clock(this.elapsed()));
  protected readonly slow = computed(() => this.elapsed() >= SLOW_AFTER_S);
  protected readonly jobLinter = computed(() => analyzersFor(this.job()?.language ?? null).linter);
  protected readonly jobLines = computed(() => lineCount(this.job()?.code ?? ''));
  protected readonly skeletons = [92, 74, 86, 64];

  // ---------- finished ----------

  protected readonly tone = signal<Tone | null>(null);
  protected readonly selected = signal<number | null>(null);
  protected readonly tab = signal<'findings' | 'ask'>('findings');
  protected readonly draft = signal('');

  protected readonly findings = computed(() => this.review()?.findings ?? []);
  protected readonly shown = computed(() => {
    const tone = this.tone();
    return this.findings()
      .map((finding, index) => ({ index, finding }))
      .filter(({ finding }) => !tone || toneOf(finding.severity) === tone);
  });
  protected readonly shownFindings = computed(() => this.shown().map((s) => s.finding));
  protected readonly selectedLine = computed(() => {
    const i = this.selected();
    return i === null ? null : (this.findings()[i]?.line ?? null);
  });

  /** "2 issues found: 1 high, 1 medium." in bold, then "Most serious: …". */
  protected readonly summary = computed(() => {
    const first = (this.review()?.summary ?? '').split('\n\n')[0].trim();
    const match = first.match(/^(.*?[.!])\s+([\s\S]*)$/);
    return match ? { lead: match[1], rest: match[2] } : { lead: first, rest: '' };
  });

  /** Which checks ran, from the language and the warnings. */
  private readonly checks = computed(() => {
    const review = this.review();
    if (!review) return { ran: [] as string[], skipped: [] as string[] };
    const { linter, source } = analyzersFor(review.language);
    const warned = new Set(review.warnings.map((w) => w.source));
    const ran: string[] = [];
    const skipped: string[] = [];
    if (linter) (warned.has(source) ? skipped : ran).push(linter);
    const aiRan = !warned.has('llm') && (review.language === 'java' || review.findings.some((f) => f.source === 'llm'));
    if (warned.has('llm')) skipped.push('AI reviewer');
    else if (aiRan) ran.push('AI reviewer');
    return { ran, skipped };
  });

  protected readonly ranWith = computed(() => this.checks().ran.join(' + ') || null);

  protected readonly caption = computed(() => {
    const review = this.review();
    if (!review) return '';
    const lines = `${lineCount(review.code)} lines`;
    if (review.warning) return `${lines} · not reviewed`;
    const { ran, skipped } = this.checks();
    const parts = [lines, ran.length ? `checked by ${ran.join(' + ')}` : 'no checks ran'];
    if (skipped.length) parts.push(`${skipped.join(' and ')} skipped`);
    if (review.language === 'java' && ran.length) parts[1] += ' (Java has no linter here)';
    return parts.join(' · ');
  });

  protected readonly listTitle = computed(() => {
    const tone = this.tone();
    return tone ? `Findings · ${tone} only` : 'Findings';
  });

  protected readonly emptyText = computed(() => {
    const review = this.review();
    if (!review) return '';
    if (review.warning) return 'No findings, because the review did not run.';
    if (review.warnings.length) return 'No findings from the checks that ran.';
    return 'No issues found. The code looks clean.';
  });

  protected readonly canRetry = computed(() => !!this.reviews.fileFor(this.reviewId()));

  constructor() {
    const header = inject(PageHeaderService);

    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));

    // A stored review (not a job of this tab): fetch it.
    effect(() => {
      const id = this.reviewId();
      untracked(() => this.loaded.set(this.reviews.job(id) ? null : this.reviews.load(id)));
      this.tone.set(null);
      this.selected.set(null);
      this.tab.set('findings');
    });

    // A job that finishes while you watch moves to its review; one that fails goes back to the start screen.
    effect(() => {
      const job = this.job();
      if (!job) return;
      if (job.status === 'done' && !job.stopped && job.review) {
        void this.router.navigate(['/review', job.review.review_id], { replaceUrl: true });
      } else if (job.status === 'failed') {
        untracked(() => this.reviews.startError.set(job.error ?? null));
        void this.router.navigate(['/review'], { replaceUrl: true });
      }
    });

    effect(() => {
      const job = this.job();
      const review = this.review();
      const name = review?.filename ?? job?.filename ?? 'Code review';
      const language = review?.language ?? job?.language ?? null;
      header.set(name, languageLabel(language));
    });

    // The severity filter can hide the selected finding.
    effect(() => {
      const i = this.selected();
      if (i !== null && !this.shown().some((f) => f.index === i)) untracked(() => this.selected.set(null));
    });
  }

  protected stop(): void {
    const job = this.job();
    if (job) this.reviews.stop(job.id);
  }

  protected openResult(): void {
    const id = this.job()?.review?.review_id;
    if (id) void this.router.navigate(['/review', id], { replaceUrl: true });
  }

  protected reload(): void {
    this.loaded.set(this.reviews.load(this.reviewId()));
  }

  protected async runAgain(): Promise<void> {
    const file = this.reviews.fileFor(this.reviewId());
    if (!file) return;
    const jobId = await this.reviews.start(file);
    void this.router.navigate(['/review', jobId]);
  }

  protected askAbout(line: number): void {
    this.draft.set(`How do I fix line ${line}?`);
    this.tab.set('ask');
    setTimeout(() => this.askLens()?.focus());
  }
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function lineCount(code: string): number {
  return code ? code.replace(/\n$/, '').split('\n').length : 0;
}