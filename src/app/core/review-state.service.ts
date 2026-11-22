import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'lens-last-review';

/** Remembers the last review so the Code Review switch can reopen it. */
@Injectable({ providedIn: 'root' })
export class ReviewStateService {
  readonly lastReviewId = signal<string | null>(read());

  remember(reviewId: string): void {
    this.lastReviewId.set(reviewId);
    try {
      sessionStorage.setItem(STORAGE_KEY, reviewId);
    } catch {
      // storage blocked: kept in memory only
    }
  }

  /** After the review is deleted, the Code Review switch starts a new one instead. */
  forget(reviewId: string): void {
    if (this.lastReviewId() !== reviewId) return;
    this.lastReviewId.set(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage blocked
    }
  }
}


function read(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}