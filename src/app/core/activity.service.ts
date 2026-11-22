import { Injectable, signal } from '@angular/core';

/**
 * Counts changes to chats and reviews (an answer arrived, a review finished), so
 * History and the sidebar's Recent list know to reload without the chat and review
 * features depending on History.
 */
@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly count = signal(0);
  readonly changes = this.count.asReadonly();

  changed(): void {
    this.count.update((n) => n + 1);
  }
}