import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'lens-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;

  /** Starts from what the inline script in index.html already applied. */
  readonly theme = signal<Theme>(this.root.dataset['theme'] === 'dark' ? 'dark' : 'light');
  readonly isDark = computed(() => this.theme() === 'dark');

  constructor() {
    effect(() => {
      this.root.dataset['theme'] = this.theme();
    });
  }

  toggle(): void {
    const next: Theme = this.isDark() ? 'light' : 'dark';
    this.theme.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, next); // only an explicit choice is remembered
    } catch {
      // storage blocked: the choice lasts for this tab only
    }
  }
}