import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { StatusService } from '../core/status.service';
import { ThemeService } from '../core/theme.service';
import { fakeStatus } from '../testing/test-helpers';
import { ConnectionStatus } from './connection-status';
import { ModeSwitch } from './mode-switch';

describe('ConnectionStatus', () => {
  async function render() {
    const status = fakeStatus();
    TestBed.configureTestingModule({ providers: [status.provider] });
    const fixture = TestBed.createComponent(ConnectionStatus);
    await fixture.whenStable();
    return { fixture, status, el: fixture.nativeElement as HTMLElement };
  }

  it('folds into "All connected" when every service is up', async () => {
    const { el } = await render();

    expect(el.querySelector('summary')?.textContent).toContain('All connected');
    expect(el.querySelector('[aria-live]')?.textContent).toBe('All services connected');
  });

  it('opens a Connections card naming what is offline', async () => {
    const { fixture, status, el } = await render();
    status.health.set({ chatServer: 'up', ollama: 'down', reviewService: 'down', model: null });
    await fixture.whenStable();

    expect(el.querySelector('h2')?.textContent).toBe('Connections');
    const rows = [...el.querySelectorAll('.row')].map((r) =>
      [...r.querySelectorAll('span')].map((s) => s.textContent?.trim()).filter(Boolean).join(' '),
    );
    expect(rows).toEqual(['Chat server :5001', 'Ollama offline', 'Review service offline']);
    expect(el.querySelector('[aria-live]')?.textContent).toBe('Offline: Ollama, Review service');
  });
});

describe('ModeSwitch', () => {
  async function render() {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ModeSwitch);
    fixture.componentRef.setInput('mode', 'chat');
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('always sends Code Review to the start screen for a new review, and Document Q&A to a new chat', async () => {
    const { el } = await render();
    const links = [...el.querySelectorAll('a')].map((a) => a.getAttribute('href'));

    expect(el.querySelector('a[aria-current="page"]')?.textContent).toContain('Document Q&A');
    expect(links).toEqual(['/chat', '/review']);
  });

  it('shows icons only, with names, on phones', async () => {
    const { fixture, el } = await render();
    fixture.componentRef.setInput('compact', true);
    await fixture.whenStable();

    expect([...el.querySelectorAll('a')].map((a) => a.getAttribute('aria-label'))).toEqual(['Document Q&A', 'Code Review']);
    expect(el.querySelector('a span')).toBeNull();
  });
});

describe('ThemeService', () => {
  afterEach(() => {
    localStorage.removeItem('lens-theme');
    delete document.documentElement.dataset['theme'];
  });

  it('switches theme on the page and remembers the choice', () => {
    document.documentElement.dataset['theme'] = 'light';
    const theme = TestBed.inject(ThemeService);

    theme.toggle();
    TestBed.tick();

    expect(theme.isDark()).toBe(true);
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(localStorage.getItem('lens-theme')).toBe('dark');
  });
});

describe('StatusService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reads /health into a status for each service', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const status = TestBed.inject(StatusService);
    const http = TestBed.inject(HttpTestingController);
    expect(status.checking()).toBe(true);

    await vi.advanceTimersByTimeAsync(0);
    http.expectOne('http://localhost:5001/health').flush({
      status: 'healthy',
      llm_model: 'llama3.2',
      ollama: 'unreachable: connection refused',
      review_service: { success: true, status: 'ok' },
    });

    expect(status.health()).toEqual({ chatServer: 'up', ollama: 'down', reviewService: 'up', model: 'llama3.2' });
    expect(status.ollamaUp()).toBe(false);
    expect(status.allUp()).toBe(false);
  });

  it('treats an unreachable chat server as down, and the rest as unknown', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const status = TestBed.inject(StatusService);
    const http = TestBed.inject(HttpTestingController);

    await vi.advanceTimersByTimeAsync(0);
    http.expectOne('http://localhost:5001/health').error(new ProgressEvent('error'), { status: 0 });

    expect(status.health()).toMatchObject({ chatServer: 'down', ollama: 'unknown', reviewService: 'unknown' });
  });
});