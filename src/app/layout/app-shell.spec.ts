import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { LayoutService } from '../core/layout.service';
import { AppShell } from './app-shell';

describe('AppShell on a phone', () => {
  let layout: LayoutService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppShell],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    layout = TestBed.inject(LayoutService);
    layout.isMobile.set(true);
    layout.sidebarOpen.set(false);
  });

  async function render() {
    const fixture = TestBed.createComponent(AppShell);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el); // focus only works on attached elements
    return { fixture, el, menu: el.querySelector<HTMLButtonElement>('.topbar .icon-btn')! };
  }

  it('opens the drawer as a menu: page behind unreachable, focus on Close menu', async () => {
    const { fixture, el, menu } = await render();
    expect(menu.getAttribute('aria-label')).toBe('Open menu');

    menu.click();
    await fixture.whenStable();

    expect(menu.getAttribute('aria-label')).toBe('Close menu');
    expect(el.querySelector<HTMLElement>('.main')!.inert).toBe(true);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close menu');
    expect(document.activeElement?.closest('#main-nav')).not.toBeNull();
    el.remove();
  });

  it('closes with Escape and gives focus back to the menu button', async () => {
    const { fixture, el, menu } = await render();
    menu.click();
    await fixture.whenStable();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();

    expect(layout.sidebarOpen()).toBe(false);
    expect(el.querySelector<HTMLElement>('.main')!.inert).toBe(false);
    expect(document.activeElement).toBe(menu);
    el.remove();
  });

  it('has a skip link to the page content', async () => {
    const { el } = await render();
    const skip = el.querySelector<HTMLAnchorElement>('a.skip')!;

    skip.click();

    expect(document.activeElement?.id).toBe('content');
    el.remove();
  });
});