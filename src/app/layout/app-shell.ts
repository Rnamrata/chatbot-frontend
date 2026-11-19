import { Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { LayoutService } from '../core/layout.service';
import { PageHeaderService } from '../core/page-header.service';
import { Icon } from '../shared/icon';
import { Mode, ModeSwitch } from './mode-switch';
import { Sidebar } from './sidebar';
import { ThemeToggle } from './theme-toggle';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar, ModeSwitch, ThemeToggle, Icon],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.css',
  host: { '(document:keydown.escape)': 'closeDrawer()' },
})
export class AppShell {
  protected readonly layout = inject(LayoutService);
  protected readonly header = inject(PageHeaderService);
  private readonly router = inject(Router);

  private readonly navigationEnd$ = this.router.events.pipe(
    filter((e): e is NavigationEnd => e instanceof NavigationEnd),
  );

  private readonly url = toSignal(this.navigationEnd$.pipe(map((e) => e.urlAfterRedirects)), {
    initialValue: this.router.url,
  });

  /** The mode switch shows on chat and review screens only (not Sources or History). */
  protected readonly mode = computed<Mode | null>(() => {
    const url = this.url();
    if (url.startsWith('/review')) return 'review';
    if (url.startsWith('/chat')) return 'chat';
    return null;
  });

  constructor() {
    // On phones the sidebar is a drawer: close it after every navigation.
    this.navigationEnd$.pipe(takeUntilDestroyed()).subscribe(() => this.closeDrawer());
  }

  protected closeDrawer(): void {
    if (this.layout.isMobile()) this.layout.close();
  }
}