import { DOCUMENT, Injectable, inject, signal } from '@angular/core';

const MOBILE_QUERY = '(max-width: 767.98px)';

/** Sidebar open/closed. Under 768px the sidebar becomes a drawer that starts closed. */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly query = inject(DOCUMENT).defaultView?.matchMedia?.(MOBILE_QUERY);

  readonly isMobile = signal(this.query?.matches ?? false);
  readonly sidebarOpen = signal(!this.isMobile());

  constructor() {
    this.query?.addEventListener('change', (e) => {
      this.isMobile.set(e.matches);
      this.sidebarOpen.set(!e.matches);
    });
  }

  toggle(): void {
    this.sidebarOpen.update((open) => !open);
  }

  close(): void {
    this.sidebarOpen.set(false);
  }
}