import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ActivityService } from '../../core/activity.service';
import { Health, StatusService } from '../../core/status.service';
import { SessionSummary, ago, groupItems, matches, rowTime, toItem } from './history.models';
import { HistoryService } from './history.service';

const API = 'http://localhost:5001';
const NOW = new Date(2026, 10, 21, 21, 30); // Sat 21 Nov 2026, 9:30 PM

function summary(over: Partial<SessionSummary> = {}): SessionSummary {
  return {
    session_id: 's1',
    type: 'docs',
    title: 'Machine learning notes',
    preview: 'Give me one example of each.',
    pinned: false,
    created_at: NOW.toISOString(),
    last_activity: NOW.toISOString(),
    message_count: 3,
    messages: 6,
    source_count: 3,
    review_id: null,
    filename: null,
    language: null,
    ...over,
  };
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

describe('HistoryService', () => {
  let history: HistoryService;
  let http: HttpTestingController;
  const health = signal<Health>({ chatServer: 'down', ollama: 'unknown', reviewService: 'unknown', model: null });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: StatusService, useValue: { health, recheck: () => undefined } },
      ],
    });
    history = TestBed.inject(HistoryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    health.set({ chatServer: 'down', ollama: 'unknown', reviewService: 'unknown', model: null });
    http.verify();
  });

  function load(sessions: SessionSummary[]): void {
    history.refresh();
    http.expectOne(`${API}/chat/sessions`).flush({ sessions, total_sessions: sessions.length });
  }

  it('loads when the chat server comes up, and again after a chat changes', () => {
    TestBed.tick();
    http.expectNone(`${API}/chat/sessions`);

    health.set({ chatServer: 'up', ollama: 'up', reviewService: 'up', model: 'llama3.2' });
    TestBed.tick();
    http.expectOne(`${API}/chat/sessions`).flush({ sessions: [summary()], total_sessions: 1 });
    expect(history.items()[0].title).toBe('Machine learning notes');

    TestBed.inject(ActivityService).changed();
    TestBed.tick();
    http.expectOne(`${API}/chat/sessions`).flush({ sessions: [], total_sessions: 0 });
    expect(history.items()).toEqual([]);
  });

  it('pins at once, and puts it back if the server refuses', async () => {
    load([summary()]);

    const pinning = history.setPinned('s1', true);
    expect(history.items()[0].pinned).toBe(true);
    const req = http.expectOne(`${API}/chat/session/s1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ pinned: true });
    req.flush({}, { status: 500, statusText: 'Server Error' });
    await pinning;

    expect(history.items()[0].pinned).toBe(false);
    expect(history.problem()).toContain("Couldn't pin");
  });

  it('removes a chat once the server has deleted it', async () => {
    load([summary(), summary({ session_id: 's2', title: 'Other' })]);

    const removing = history.remove('s1');
    expect(history.items()).toHaveLength(2);
    http.expectOne({ method: 'DELETE', url: `${API}/chat/clear/s1` }).flush({ success: true });

    expect(await removing).toBe(true);
    expect(history.items().map((i) => i.id)).toEqual(['s2']);
  });

  it('clears chats older than 24 hours but not pinned ones', async () => {
    load([
      summary({ session_id: 'new', last_activity: hoursAgo(2) }),
      summary({ session_id: 'old', last_activity: hoursAgo(30) }),
      summary({ session_id: 'old-pinned', last_activity: hoursAgo(30), pinned: true }),
    ]);
    expect(history.old().map((i) => i.id)).toEqual(['old']);

    const clearing = history.clearOld();
    const req = http.expectOne(`${API}/chat/cleanup`);
    expect(req.request.body).toEqual({ inactive_hours: 24, keep_pinned: true });
    req.flush({ success: true, cleaned: 1 });
    const gone = await clearing;
    http.expectOne(`${API}/chat/sessions`).flush({ sessions: [], total_sessions: 0 });

    expect(gone!.map((i) => i.id)).toEqual(['old']);
  });

  it('lists pinned chats first in Recent, then the latest', () => {
    load([
      summary({ session_id: 'a', last_activity: hoursAgo(1) }),
      summary({ session_id: 'b', last_activity: hoursAgo(50), pinned: true }),
      summary({ session_id: 'c', last_activity: hoursAgo(0.1) }),
    ]);

    expect(history.recent().map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('history models', () => {
  it('describes chats and reviews the way the design does', () => {
    expect(toItem(summary()).meta).toBe('Document Q&A · 6 messages · 3 sources');
    const review = toItem(
      summary({ type: 'code_review', title: 'Review: UserDao.java', review_id: 'r1', language: 'java', messages: 1 }),
    );
    expect(review).toMatchObject({ kind: 'code', link: ['/review', 'r1'], meta: 'Code Review · Java · 1 message' });
    expect(toItem(summary()).link).toEqual(['/chat', 's1']);
  });

  it('groups by pinned and by day, newest first', () => {
    const at = (d: number, h = 12) => new Date(2026, 10, 21 - d, h).toISOString();
    const items = [
      summary({ session_id: 'today-early', last_activity: at(0, 9) }),
      summary({ session_id: 'today-late', last_activity: at(0, 20) }),
      summary({ session_id: 'yesterday', last_activity: at(1) }),
      summary({ session_id: 'monday', last_activity: at(5) }),
      summary({ session_id: 'old', last_activity: at(20) }),
      summary({ session_id: 'pinned', last_activity: at(20), pinned: true }),
    ].map(toItem);

    expect(groupItems(items, NOW).map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ['Pinned', ['pinned']],
      ['Today', ['today-late', 'today-early']],
      ['Yesterday', ['yesterday']],
      ['Earlier this week', ['monday']],
      ['Older', ['old']],
    ]);
  });

  it('writes times for the list and the sidebar', () => {
    expect(rowTime(new Date(2026, 10, 16, 9), NOW)).toBe(new Date(2026, 10, 16).toLocaleDateString([], { weekday: 'short' }));
    expect(ago(new Date(NOW.getTime() - 2 * 60_000), NOW)).toBe('2 min ago');
    expect(ago(new Date(NOW.getTime() - 90 * 60_000), NOW)).toBe('1 h ago');
    expect(ago(new Date(2026, 10, 20, 18), NOW)).toBe('Yesterday');
  });

  it('searches titles, previews and file names', () => {
    const review = toItem(summary({ title: 'Review: UserDao.java', preview: '2 issues found', filename: 'UserDao.java' }));
    expect(matches(review, 'userdao')).toBe(true);
    expect(matches(review, 'issues')).toBe(true);
    expect(matches(review, 'python')).toBe(false);
    expect(matches(review, '  ')).toBe(true);
  });
});