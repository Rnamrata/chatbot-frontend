import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChatService, toSources } from './chat.service';

const API = 'http://localhost:5001';

describe('ChatService', () => {
  let chat: ChatService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    chat = TestBed.inject(ChatService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('shows the question and a pending answer, then fills in the answer and its sources', () => {
    chat.send('s1', 'What is RAG?');
    const c = chat.conversation('s1');
    expect(c.messages().map((m) => `${m.role}:${m.status}`)).toEqual(['user:done', 'assistant:pending']);

    const req = http.expectOne(`${API}/chat`);
    expect(req.request.body).toEqual({ question: 'What is RAG?', session_id: 's1' });
    req.flush({
      success: true,
      answer: 'Retrieval-augmented generation…',
      session_id: 's1',
      sources: [{ content: 'RAG combines a retriever...', metadata: { source: 'notes.pdf', type: 'file_upload' }, full_length: 900 }],
    });

    const answer = c.messages()[1];
    expect(answer.status).toBe('done');
    expect(answer.text).toBe('Retrieval-augmented generation…');
    expect(answer.sources[0]).toMatchObject({ n: 1, name: 'notes.pdf', kind: 'file', passage: 'RAG combines a retriever', truncated: true });
  });

  it('turns success: false into an error that can be retried', () => {
    chat.send('s2', 'Hello?');
    http.expectOne(`${API}/chat`).flush({ success: false, error: 'model not found', answer: '', session_id: 's2' });

    const failed = chat.conversation('s2').messages()[1];
    expect(failed.status).toBe('error');
    expect(failed.error).toContain('model not found');

    chat.retry('s2', failed.id);
    expect(chat.conversation('s2').messages()[1].status).toBe('pending');
    http.expectOne(`${API}/chat`).flush({ success: true, answer: 'Hi', session_id: 's2', sources: [] });
    expect(chat.conversation('s2').messages()[1].status).toBe('done');
  });

  it('marks a chat the server no longer has as missing', () => {
    chat.load('gone');
    http.expectOne(`${API}/chat/history/gone`).flush({ history: [], length: 0, message: 'Session not found' });
    expect(chat.conversation('gone').state()).toBe('missing');
  });

  it('rebuilds messages from history, including a standalone assistant message', () => {
    chat.load('old');
    http.expectOne(`${API}/chat/history/old`).flush({
      history: [
        { question: null, answer: 'Review summary', timestamp: '2026-11-19T10:00:00' },
        { question: 'Why?', answer: 'Because.', timestamp: '2026-11-19T10:01:00' },
      ],
      length: 2,
    });
    expect(chat.conversation('old').messages().map((m) => m.text)).toEqual(['Review summary', 'Why?', 'Because.']);
  });
});

describe('toSources', () => {
  it('names web pages by title and keeps their link', () => {
    const [web] = toSources([
      { content: 'Intro', metadata: { source: 'https://example.com/a', type: 'web', title: 'Example' }, full_length: 5 },
    ]);
    expect(web).toEqual({ n: 1, name: 'Example', kind: 'web', url: 'https://example.com/a', passage: 'Intro', truncated: false });
  });
});