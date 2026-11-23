import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { byText, fakeStatus, typeInto } from '../../testing/test-helpers';
import { SessionSummary } from './history.models';
import { HistoryPage } from './history-page';

const API = 'http://localhost:5001';

function session(over: Partial<SessionSummary>): SessionSummary {
  const now = new Date().toISOString();
  return {
    session_id: 's',
    type: 'docs',
    title: 'Chat',
    preview: '',
    pinned: false,
    created_at: now,
    last_activity: now,
    message_count: 1,
    messages: 2,
    source_count: 1,
    review_id: null,
    filename: null,
    language: null,
    ...over,
  };
}

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

const SESSIONS = [
  session({ session_id: 'ml', title: 'Machine learning notes', preview: 'Give me an example', pinned: true }),
  session({ session_id: 'dao', type: 'code_review', title: 'Review: UserDao.java', review_id: 'r1', filename: 'UserDao.java', language: 'java', preview: '5 issues found' }),
  session({ session_id: 'py', title: 'Python basics', preview: 'Who created Python?', last_activity: daysAgo(3) }),
];

describe('HistoryPage', () => {
  let http: HttpTestingController;

  async function render(sessions = SESSIONS) {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), fakeStatus().provider],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(HistoryPage);
    await fixture.whenStable();
    answerSessions(sessions);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  /** The page and the service may both ask; a newer ask cancels the older one, so answer what's still open. */
  function answerSessions(sessions: SessionSummary[]): void {
    for (const req of http.match(`${API}/chat/sessions`)) {
      if (!req.cancelled) req.flush({ sessions, total_sessions: sessions.length });
    }
  }

  const titles = (el: HTMLElement) => [...el.querySelectorAll('.row .title')].map((t) => t.textContent?.trim());
  const groups = (el: HTMLElement) => [...el.querySelectorAll('.group h2')].map((h) => h.textContent?.trim());

  it('groups chats and reviews: pinned first, then by day', async () => {
    const { el } = await render();

    expect(groups(el)).toEqual(['Pinned', 'Today', 'Earlier this week']);
    expect(titles(el)).toEqual(['Machine learning notes', 'Review: UserDao.java', 'Python basics']);
    expect(byText<HTMLAnchorElement>(el, 'a', 'Review: UserDao.java').getAttribute('href')).toBe('/review/r1');
    expect(el.textContent).toContain('Code Review · Java · 2 messages');
  });

  it('keeps the full title on hover, for titles cut short on phones', async () => {
    const long = 'Summarize the main points of the prompt engineering book chapter by chapter';
    const { el } = await render([session({ session_id: 'long', title: long })]);

    expect(el.querySelector<HTMLAnchorElement>('.row .title')!.title).toBe(long);
  });

  it('searches and filters by type', async () => {
    const { fixture, el } = await render();

    typeInto(el.querySelector<HTMLInputElement>('#history-search')!, 'userdao');
    await fixture.whenStable();
    expect(titles(el)).toEqual(['Review: UserDao.java']);

    typeInto(el.querySelector<HTMLInputElement>('#history-search')!, 'zzz');
    await fixture.whenStable();
    expect(el.querySelector('.no-match')?.textContent).toContain('Nothing matches your search.');

    typeInto(el.querySelector<HTMLInputElement>('#history-search')!, '');
    byText(el, '.filters button', 'Document Q&A').click();
    await fixture.whenStable();
    expect(titles(el)).toEqual(['Machine learning notes', 'Python basics']);
  });

  it('pins a chat', async () => {
    const { fixture, el } = await render();

    byText(el, 'button', 'Pin Python basics').click();
    await fixture.whenStable();

    expect(http.expectOne(`${API}/chat/session/py`).request.body).toEqual({ pinned: true });
    expect(groups(el)[0]).toBe('Pinned');
    expect(byText(el, 'button', 'Unpin Python basics').getAttribute('aria-pressed')).toBe('true');
  });

  it('asks before deleting, then removes the row', async () => {
    const { fixture, el } = await render();

    byText(el, 'button', 'Delete Review: UserDao.java').click();
    await fixture.whenStable();
    expect(el.querySelector('.confirm')?.textContent).toContain('Its stored code, findings and questions go too.');
    http.expectNone(`${API}/chat/clear/dao`);

    byText(el, '.confirm button', 'Delete').click();
    http.expectOne({ method: 'DELETE', url: `${API}/chat/clear/dao` }).flush({ success: true });
    await fixture.whenStable();
    await fixture.whenStable();

    expect(titles(el)).not.toContain('Review: UserDao.java');
    expect(el.querySelector('[role=status]')?.textContent).toContain('Deleted “Review: UserDao.java”.');
  });

  it('clears chats older than a day, but not pinned ones', async () => {
    const { fixture, el } = await render();

    byText(el, 'button', 'Clear chats older than 24 h').click();
    await fixture.whenStable();
    expect(el.querySelector('.clear-confirm')?.textContent).toContain('Delete 1 chat not used in the last 24 hours?');

    byText(el, '.clear-confirm button', 'Delete 1').click();
    const req = http.expectOne(`${API}/chat/cleanup`);
    expect(req.request.body).toEqual({ inactive_hours: 24, keep_pinned: true });
    req.flush({ success: true, cleaned: 1 });
    await fixture.whenStable();
    answerSessions(SESSIONS.slice(0, 2));
    await fixture.whenStable();

    expect(titles(el)).toEqual(['Machine learning notes', 'Review: UserDao.java']);
  });

  it('invites a first chat when there is no history', async () => {
    const { el } = await render([]);

    expect(el.querySelector('.empty')?.textContent).toContain('No chats yet');
    expect(byText<HTMLAnchorElement>(el, 'a', 'Review a file').getAttribute('href')).toBe('/review');
  });
});