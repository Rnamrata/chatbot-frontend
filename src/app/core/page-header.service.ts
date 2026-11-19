import { Injectable, signal } from '@angular/core';

/** Title and subtitle shown in the top bar. Each page sets its own. */
@Injectable({ providedIn: 'root' })
export class PageHeaderService {
  readonly title = signal('Lens');
  readonly subtitle = signal<string | null>(null);

  set(title: string, subtitle: string | null = null): void {
    this.title.set(title);
    this.subtitle.set(subtitle);
  }
}