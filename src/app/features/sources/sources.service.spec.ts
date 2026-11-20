import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LibrarySource } from './sources.models';
import { SourcesService } from './sources.service';
import { checkUrl } from './url-check';

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

    expect(sources.loadState()).toBe('ready');
    expect(sources.sources()).toEqual([notes]);
  });

  it('uploads a file, shows it as ready and refreshes the list', () => {
    sources.addFile(new File(['hello'], 'notes.pdf'));
    expect(sources.jobs().file).toEqual({ status: 'busy' });

    const upload = http.expectOne(`${API}/upload/file`);
    expect(upload.request.body).toBeInstanceOf(FormData);
    upload.flush({ success: true, chunks_created: 45, source: notes });

    expect(sources.jobs().file).toBeNull();
    expect(sources.lastAdded()).toEqual(notes);
    http.expectOne(`${API}/sources`).flush({ success: true, sources: [notes], total: 1 });

    vi.advanceTimersByTime(500); // the early refresh that shows "processing"
    http.expectOne(`${API}/sources`).flush({ success: true, sources: [notes], total: 1 });
  });

  it('keeps the server’s reason when adding fails', () => {
    sources.addWebPage('https://example.com/missing');
    http
      .expectOne(`${API}/upload/web`)
      .flush({ success: false, error: 'Failed to load data from URL' }, { status: 400, statusText: 'Bad Request' });

    expect(sources.jobs().web).toEqual({
      status: 'error',
      message: 'Lens could not add that source. Failed to load data from URL',
    });
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

  it('removes a source', () => {
    sources.sources.set([notes]);
    sources.remove('abc123');

    const req = http.expectOne(`${API}/sources/abc123`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true, id: 'abc123', chunks_removed: 45 });

    expect(sources.sources()).toEqual([]);
    expect(sources.removing()).toBeNull();
  });
});

describe('checkUrl', () => {
  it('accepts YouTube links and rejects other sites on the YouTube card', () => {
    expect(checkUrl('youtube', 'https://www.youtube.com/watch?v=n1l-9lIMW7E')).toBeNull();
    expect(checkUrl('youtube', 'https://youtu.be/n1l-9lIMW7E')).toBeNull();
    expect(checkUrl('youtube', 'https://vimeo.com/1')).toContain('isn’t a YouTube link');
  });

  it('needs an http(s) link', () => {
    expect(checkUrl('web', '')).toBe('Paste a link first.');
    expect(checkUrl('web', 'wikipedia')).toContain('doesn’t look like a link');
    expect(checkUrl('web', 'ftp://example.com')).toContain('https://');
    expect(checkUrl('web', 'https://en.wikipedia.org/wiki/Python')).toBeNull();
  });
});