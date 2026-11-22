import {
  Component,
  DOCUMENT,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  viewChild,
} from '@angular/core';
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
  host: { '(document:keydown.escape)': 'escape()' },
})
export class AppShell {
  protected readonly layout = inject(LayoutService);
  protected readonly header = inject(PageHeaderService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly menuButton = viewChild.required<ElementRef<HTMLButtonElement>>('menuButton');
  private readonly title = viewChild.required<ElementRef<HTMLElement>>('title');
  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');

  private readonly navigationEnd$ = this.router.events.pipe(
    filter((e): e is NavigationEnd => e instanceof NavigationEnd),
  );

  private readonly url = toSignal(this.navigationEnd$.pipe(map((e) => e.urlAfterRedirects)), {
    initialValue: this.router.url,
  });

  /** On phones the open sidebar is a drawer over the page, which can't be reached meanwhile. */
  protected readonly drawer = computed(() => this.layout.isMobile() && this.layout.sidebarOpen());

  protected readonly menuLabel = computed(() => {
    const open = this.layout.sidebarOpen();
    if (this.layout.isMobile()) return open ? 'Close menu' : 'Open menu';
    return open ? 'Hide sidebar' : 'Show sidebar';
  });

  /** The mode switch shows on chat and review screens only (not Sources or History). */
  protected readonly mode = computed<Mode | null>(() => {
    const url = this.url();
    if (url.startsWith('/review')) return 'review';
    if (url.startsWith('/chat')) return 'chat';
    return null;
  });

  constructor() {
    let first = true;
    this.navigationEnd$.pipe(takeUntilDestroyed()).subscribe(() => {
      // On phones the sidebar is a drawer: close it after every navigation.
      if (this.drawer()) this.layout.close();
      if (first) {
        first = false;
        return;
      }
      // A page that keeps focus itself (a new chat moving to its own address) says so.
      if (this.router.lastSuccessfulNavigation()?.extras.state?.['keepFocus']) return;
      afterNextRender(() => this.focusTitleIfLost(), { injector: this.injector });
    });
  }

  protected toggleMenu(): void {
    this.layout.toggle();
    if (this.drawer()) {
      afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('#main-nav .close-menu')?.focus(), {
        injector: this.injector,
      });
    }
  }

  /** Closes the drawer and puts focus back on the button that opened it. */
  protected closeDrawer(): void {
    if (!this.drawer()) return;
    this.layout.close();
    afterNextRender(() => this.menuButton().nativeElement.focus(), { injector: this.injector });
  }

  protected escape(): void {
    this.closeDrawer();
  }

  protected skipToContent(event: Event): void {
    event.preventDefault();
    this.content().nativeElement.focus();
  }

  /**
   * After a navigation the clicked link is often gone (a closed drawer, a removed
   * row), which leaves focus nowhere. Start from the new page's title instead.
   */
  private focusTitleIfLost(): void {
    const active = this.document.activeElement;
    if (!active || active === this.document.body || !active.isConnected) {
      this.title().nativeElement.focus({ preventScroll: true });
    }
  }
}