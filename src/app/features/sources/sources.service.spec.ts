import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { addedLabel, badgeLabel, checkFile, findLink, typeLabel } from './source-checks';
import { LibrarySource } from './sources.models';
import { SourcesService } from './sources.service';

const API = 'http://localhost:5001';

const notes: LibrarySource = {
  id: 'abc123',
  name: 'notes.pdf',
  type: 'file_upload',
  source: 'notes.pdf',
  chunks: 45,
  status: 'ready',
  added_at: '2026-11-19T20:00:00+00:00',
};

describe('SourcesService', () => {
  let sources: SourcesService;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    sources = TestBed.inject(SourcesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  it('loads the list', () => {
    sources.load();
    http.expectOne(`${API}/sources`).flush({ success: true, sources: [notes], total: 1 });

    expect(sources.sources()).toEqual([notes]);
    expect(sources.loadState()).toBe('ready');
  });

  it('adds a file from a chat, with the chat id, and refreshes the list', () => {
    const added: (LibrarySource | null)[] = [];
    sources.addToChat('file', new File(['hello'], 'notes.pdf'), 's1').subscribe((s) => added.push(s));

    const req = http.expectOne(`${API}/upload/file`);
    const body = req.request.body as FormData;
    expect((body.get('file') as File).name).toBe('notes.pdf');
    expect(body.get('session_id')).toBe('s1');
    req.flush({ success: true, chunks_created: 45, source: notes });

    expect(added).toEqual([notes]);
    http.expectOne(`${API}/sources`).flush({ success: true, sources: [notes], total: 1 });
    vi.advanceTimersByTime(500); // the early refresh that shows "processing"
    http.expectOne(`${API}/sources`).flush({ success: true, sources: [notes], total: 1 });
  });

  it('adds a link from a chat', () => {
    sources.addToChat('youtube', { url: 'https://youtu.be/x' }, 's1').subscribe();

    const req = http.expectOne(`${API}/upload/youtube`);
    expect(req.request.body).toEqual({ url: 'https://youtu.be/x', session_id: 's1' });
    req.flush({ success: true, reused: true, chunks_created: 0, source: { ...notes, type: 'youtube' } });
    http.expectOne(`${API}/sources`).flush({ success: true, sources: [], total: 0 });
    vi.advanceTimersByTime(500);
    http.expectOne(`${API}/sources`).flush({ success: true, sources: [], total: 0 });
  });

  it('polls while something is processing', () => {
    sources.load();
    http.expectOne(`${API}/sources`).flush({ success: true, sources: [{ ...notes, status: 'processing' }], total: 1 });

    vi.advanceTimersByTime(5_000);
    http.expectOne(`${API}/sources`).flush({ success: true, sources: [notes], total: 1 });

    vi.advanceTimersByTime(5_000);
    http.expectNone(`${API}/sources`);
  });

  it('deletes several sources, one request each', () => {
    const web: LibrarySource = { ...notes, id: 'w1', name: 'Trust', type: 'web' };
    sources.sources.set([notes, web]);
    sources.remove(['abc123', 'w1']);
    expect(sources.removing()).toEqual(['abc123', 'w1']);

    for (const id of ['abc123', 'w1']) {
      const req = http.expectOne(`${API}/sources/${id}`);
      expect(req.request.method).toBe('DELETE');
      req.flush({ success: true, id, chunks_removed: 1 });
    }

    expect(sources.sources()).toEqual([]);
    expect(sources.removing()).toEqual([]);
  });

  it('names the source it could not delete', () => {
    sources.sources.set([notes]);
    sources.remove(['abc123']);
    http.expectOne(`${API}/sources/abc123`).flush({ success: false, error: 'Source not found' }, { status: 404, statusText: 'Not Found' });

    expect(sources.removeError()).toBe('Lens could not delete notes.pdf. Source not found');
    http.expectOne(`${API}/sources`).flush({ success: true, sources: [], total: 0 });
  });
});

describe('source checks', () => {
  it('finds a YouTube or web link in a message, and the words around it', () => {
    expect(findLink('What changed in https://youtube.com/shorts/8YII135YGIQ?')).toEqual({
      kind: 'youtube',
      url: 'https://youtube.com/shorts/8YII135YGIQ',
      rest: 'What changed in?',
    });
    expect(findLink('Summarize https://youtu.be/abc')?.kind).toBe('youtube');
    expect(findLink('Read https://en.wikipedia.org/wiki/Python_(programming_language), please')).toEqual({
      kind: 'web',
      url: 'https://en.wikipedia.org/wiki/Python_(programming_language)',
      rest: 'Read, please',
    });
    expect(findLink('(see https://example.com/page).')?.url).toBe('https://example.com/page');
    expect(findLink('No link here, just www.example.com')).toBeNull();
  });

  it('takes PDF, TXT and Markdown files up to 20 MB', () => {
    expect(checkFile(new File(['x'], 'a.pdf'))).toBeNull();
    expect(checkFile(new File(['x'], 'b.MD'))).toBeNull();
    expect(checkFile(new File(['x'], 'c.docx'))).toContain('PDF, TXT and Markdown');
    expect(checkFile(new File([], 'empty.txt'))).toBe('empty.txt is empty.');
    const big = new File(['x'], 'big.pdf');
    Object.defineProperty(big, 'size', { value: 21 * 1024 * 1024 });
    expect(checkFile(big)).toBe('big.pdf is larger than 20 MB.');
  });

  it('names types and badges', () => {
    expect(typeLabel('file_upload', 'a.pdf')).toBe('PDF');
    expect(typeLabel('youtube', 'https://youtu.be/x')).toBe('YouTube');
    expect(typeLabel('unknown', null)).toBe('—');
    expect(badgeLabel('file_upload', 'notes.md')).toBe('MD');
    expect(badgeLabel('web', 'https://x.com')).toBe('WEB');
  });

  it('says when a source was added', () => {
    const now = new Date(2026, 10, 23, 15, 0);
    expect(addedLabel(new Date(2026, 10, 23, 9, 5).toISOString(), now)).toBe('Today, 9:05 AM');
    expect(addedLabel(new Date(2026, 10, 22, 18, 49).toISOString(), now)).toBe('Yesterday, 6:49 PM');
    expect(addedLabel(new Date(2026, 10, 2).toISOString(), now)).toBe('Nov 2');
    expect(addedLabel(new Date(2025, 0, 5).toISOString(), now)).toBe('Jan 5, 2025');
    expect(addedLabel(null, now)).toBe('—');
  });
});
