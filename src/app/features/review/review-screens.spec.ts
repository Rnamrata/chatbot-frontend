import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { PageHeaderService } from '../../core/page-header.service';
import { allowScrolling, byText, fakeStatus } from '../../testing/test-helpers';
import { Review } from './review.models';
import { ReviewPage } from './review-page';
import { ReviewStart } from './review-start';

const API = 'http://localhost:5001';

const REVIEW: Review = {
  review_id: 'r1',
  session_id: 's1',
  filename: 'user_dao.py',
  language: 'python',
  code: 'import os\nPASSWORD = "admin123"\n\ndef find(name):\n    return db.execute("SELECT * FROM users WHERE name = \'" + name + "\'")\n',
  findings: [
    { file: 'user_dao.py', line: 2, severity: 'high', message: 'Hardcoded password', category: 'security', source: 'ruff', suggestion: 'Read it from the environment.' },
    { file: 'user_dao.py', line: 5, severity: 'high', message: 'SQL injection', category: 'security', source: 'llm' },
    { file: 'user_dao.py', line: 1, severity: 'low', message: '`os` imported but unused', source: 'ruff' },
  ],
  warnings: [],
  summary: '3 issues found: 2 high, 1 low. Most serious: Hardcoded password (line 2).',
};

function setup() {
  const status = fakeStatus();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), status.provider],
  });
  return { status, http: TestBed.inject(HttpTestingController), router: TestBed.inject(Router) };
}

describe('ReviewStart', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function render() {
    const ctx = setup();
    const fixture = TestBed.createComponent(ReviewStart);
    await fixture.whenStable();
    const pick = (file: File) => (fixture.componentInstance as unknown as { pick(f: File[]): Promise<void> }).pick([file]);
    return { ...ctx, fixture, pick, el: fixture.nativeElement as HTMLElement };
  }

  it('turns away a file type the review service can’t check, without uploading', async () => {
    const { fixture, pick, el } = await render();

    await pick(new File(['package main'], 'main.go'));
    await fixture.whenStable();

    expect(el.querySelector('[role=alert]')?.textContent).toContain("Lens can't check .go files yet");
  });

  it('uploads a code file and opens its progress page', async () => {
    const { fixture, pick, http, router } = await render();
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await pick(new File(['x = 1\n'], 'app.py'));
    await fixture.whenStable();

    expect(http.expectOne(`${API}/review`).request.body).toBeInstanceOf(FormData);
    expect(navigate).toHaveBeenCalledWith(['/review', expect.any(String)]);
  });

  it('says so when the review service is down, and blocks picking a file', async () => {
    const { fixture, status, el } = await render();
    status.health.set({ chatServer: 'up', ollama: 'up', reviewService: 'down', model: null });
    await fixture.whenStable();

    expect(el.querySelector('[role=alert]')?.textContent).toContain("The review service isn't responding");
    expect(el.querySelector<HTMLInputElement>('#code-file')!.disabled).toBe(true);
    expect(el.querySelector('.button')?.textContent).toContain('Review unavailable');

    byText(el, 'button', 'Try again').click();
    expect(status.fake.rechecks).toBe(1);
  });
});

describe('ReviewPage', () => {
  beforeAll(allowScrolling);
  async function render(review: Review = REVIEW) {
    const ctx = setup();
    const fixture = TestBed.createComponent(ReviewPage);
    fixture.componentRef.setInput('reviewId', review.review_id);
    await fixture.whenStable();
    ctx.http.expectOne(`${API}/review/${review.review_id}`).flush({ success: true, ...review });
    await fixture.whenStable();
    return { ...ctx, fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the summary, the code and every finding, and names the file in the header', async () => {
    const { el } = await render();

    expect(el.querySelector('.summary strong')?.textContent).toBe('3 issues found: 2 high, 1 low.');
    expect(el.querySelectorAll('app-finding-list .card')).toHaveLength(3);
    expect(el.querySelector('#line-2')?.classList).toContain('high');
    expect(el.querySelector('app-code-viewer .bar')?.textContent).toContain('checked by Ruff + AI reviewer');
    expect(TestBed.inject(PageHeaderService).title()).toBe('user_dao.py');
    expect(TestBed.inject(PageHeaderService).subtitle()).toBe('Python');
  });

  it('filters findings by severity', async () => {
    const { fixture, el } = await render();

    byText(el, 'app-severity-filter button', '1 low').click();
    await fixture.whenStable();

    expect([...el.querySelectorAll('app-finding-list .msg')].map((m) => m.textContent?.trim())).toEqual([
      '`os` imported but unused',
    ]);
    expect(el.querySelector('#tab-findings .count')?.textContent).toBe('1');
  });

  it('opens a finding in place, then moves to Ask Lens with a question ready', async () => {
    const { fixture, el, http } = await render();

    byText(el, '.pick', 'Hardcoded password').click();
    await fixture.whenStable();
    expect(el.querySelector('.more .tip')?.textContent).toContain('Read it from the environment.');
    expect(el.querySelector('#line-2')?.classList).toContain('selected');

    byText(el, 'button', 'Ask about line 2').click();
    await fixture.whenStable();
    http.expectOne(`${API}/chat/history/s1`).flush({ history: [{ question: null, answer: REVIEW.summary }], length: 1 });
    await fixture.whenStable();

    expect(el.querySelector('#tab-ask')?.getAttribute('aria-selected')).toBe('true');
    expect(el.querySelector<HTMLInputElement>('#ask-review')!.value).toBe('How do I fix line 2?');
    // The summary the page already shows isn't repeated as a chat message
    expect(el.querySelector('app-ask-lens app-message-list')).toBeNull();
  });

  it('warns when only part of the review ran', async () => {
    const { el } = await render({
      ...REVIEW,
      findings: [REVIEW.findings[0]],
      warnings: [{ source: 'llm', message: 'Ollama timed out' }],
    });

    expect(el.querySelector('app-review-warning')?.textContent).toContain('Only part of this review ran');
    expect(el.querySelector('app-code-viewer .bar')?.textContent).toContain('AI reviewer skipped');
  });

  it('says when a stored review is gone', async () => {
    const ctx = setup();
    const fixture = TestBed.createComponent(ReviewPage);
    fixture.componentRef.setInput('reviewId', 'gone');
    await fixture.whenStable();
    ctx.http.expectOne(`${API}/review/gone`).flush({ success: false }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain("This review isn't stored any more");
  });
});