import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PageHeaderService } from '../../core/page-header.service';
import { StatusService } from '../../core/status.service';
import { Icon } from '../../shared/icon';
import { LensAvatar } from '../../shared/lens-avatar';
import { CODE_EXTENSIONS, StartError } from './review.models';
import { ReviewService } from './review.service';

/** /review: pick one code file to review. */
@Component({
  selector: 'app-review-start',
  imports: [Icon, LensAvatar],
  templateUrl: './review-start.html',
  styleUrl: './review-start.css',
})
export class ReviewStart {
  private readonly reviews = inject(ReviewService);
  private readonly router = inject(Router);
  protected readonly status = inject(StatusService);

  protected readonly accept = CODE_EXTENSIONS.join(',');
  protected readonly dragging = signal(false);
  protected readonly starting = signal(false);
  private readonly now = signal(Date.now());

  /** A problem with the picked file, found before uploading. */
  private readonly fileError = signal<StartError | null>(null);

  protected readonly serviceDown = computed(() => this.status.health().reviewService === 'down');

  protected readonly error = computed<StartError | null>(() => {
    if (this.serviceDown()) {
      return {
        kind: 'unreachable',
        title: "The review service isn't responding",
        body: "Lens couldn't reach it at localhost:4000. Start it with npm run dev in the code-review-backend folder, then try again.",
      };
    }
    return this.fileError() ?? this.reviews.startError();
  });

  /** Seconds until another review may start, while rate limited. */
  protected readonly waitSeconds = computed(() => {
    const retryAt = this.error()?.retryAt;
    return retryAt ? Math.max(0, Math.ceil((retryAt - this.now()) / 1000)) : 0;
  });

  protected readonly blocked = computed(() => this.serviceDown() || this.waitSeconds() > 0 || this.starting());

  protected readonly buttonLabel = computed(() => {
    if (this.starting()) return 'Starting…';
    if (this.serviceDown()) return 'Review unavailable';
    const wait = this.waitSeconds();
    return wait > 0 ? `Review again in ${clock(wait)}` : 'Choose file';
  });

  protected readonly errorBody = computed(() => {
    const e = this.error();
    if (!e) return '';
    const wait = this.waitSeconds();
    return e.kind === 'rate-limited' && wait > 0 ? `${e.body} You can start another one in ${spoken(wait)}.` : e.body;
  });

  constructor() {
    inject(PageHeaderService).set('New code review');

    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));

    // When the wait is over, clear the rate-limit message.
    effect(() => {
      if (this.reviews.startError()?.kind === 'rate-limited' && this.waitSeconds() === 0) {
        this.reviews.startError.set(null);
      }
    });
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.blocked()) this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (!this.blocked()) void this.pick(event.dataTransfer?.files ?? null);
  }

  protected async pick(files: FileList | null): Promise<void> {
    const file = files?.[0];
    if (!file || this.blocked()) return;

    const problem = this.reviews.check(file);
    this.fileError.set(problem);
    if (problem) return;

    this.starting.set(true);
    try {
      const jobId = await this.reviews.start(file);
      await this.router.navigate(['/review', jobId]);
    } finally {
      this.starting.set(false);
    }
  }

  protected tryAgain(): void {
    this.status.recheck();
  }
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function spoken(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m} min ${s} s` : `${s} s`;
}