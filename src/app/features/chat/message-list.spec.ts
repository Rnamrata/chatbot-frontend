import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { byText } from '../../testing/test-helpers';
import { Message } from './chat.models';
import { MessageList } from './message-list';

function message(over: Partial<Message>): Message {
  return { id: 'm', role: 'assistant', text: '', at: null, status: 'done', sources: [], suggestions: [], ...over };
}

const QUESTION = message({ id: 'q1', role: 'user', text: 'What is RAG?' });
const ANSWER = message({
  id: 'a1',
  text: 'It combines **retrieval** with generation.',
  question: 'What is RAG?',
  sources: [
    { n: 1, name: 'notes.pdf', kind: 'file', url: null, passage: 'RAG retrieves passages first', truncated: true },
    { n: 2, name: 'RAG - Wikipedia', kind: 'web', url: 'https://en.wikipedia.org/wiki/RAG', passage: 'Retrieval', truncated: false },
  ],
});

describe('MessageList', () => {
  async function render(messages: Message[], inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(MessageList);
    fixture.componentRef.setInput('messages', messages);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    const retried: string[] = [];
    fixture.componentInstance.retry.subscribe((id) => retried.push(id));
    await fixture.whenStable();
    return { fixture, retried, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the question and the answer as markdown, with numbered sources', async () => {
    const { el } = await render([QUESTION, ANSWER]);

    expect(el.querySelector('.user .bubble')?.textContent).toContain('What is RAG?');
    expect(el.querySelector('.answer strong')?.textContent).toBe('retrieval');
    expect([...el.querySelectorAll('.chip')].map((c) => c.textContent?.trim())).toEqual([
      '1 · notes.pdf',
      '2 · RAG - Wikipedia',
    ]);
  });

  it('opens a source passage from its chip and closes it again', async () => {
    const { fixture, el } = await render([QUESTION, ANSWER]);

    byText(el, '.chip', 'notes.pdf').click();
    await fixture.whenStable();
    const passage = el.querySelector('app-source-passage');
    expect(passage?.textContent).toContain('RAG retrieves passages first…');
    expect(byText(el, '.chip', 'notes.pdf').getAttribute('aria-expanded')).toBe('true');

    byText(el, 'button', 'Close source').click();
    await fixture.whenStable();
    expect(el.querySelector('app-source-passage')).toBeNull();
  });

  it('links the original page of a web source', async () => {
    const { fixture, el } = await render([QUESTION, ANSWER]);

    byText(el, '.chip', 'Wikipedia').click();
    await fixture.whenStable();

    expect(byText<HTMLAnchorElement>(el, 'a', 'Open original').href).toBe('https://en.wikipedia.org/wiki/RAG');
  });

  it('shows the pending text while Lens is answering, and announces it', async () => {
    const { el } = await render([QUESTION, message({ id: 'a1', status: 'pending', question: 'What is RAG?' })], {
      pendingText: 'Reading the code and findings…',
    });

    expect(el.querySelector('.thinking')?.textContent).toContain('Reading the code and findings…');
    expect(el.querySelector('[aria-live]')?.textContent).toContain('Lens is working');
  });

  it('offers Try again on a failed answer', async () => {
    const failed = message({ id: 'a1', status: 'error', error: 'Ollama is not running', question: 'What is RAG?' });
    const { el, retried } = await render([QUESTION, failed]);

    expect(el.querySelector('.error-text')?.textContent).toContain('Ollama is not running');
    byText(el, 'button', 'Try again').click();

    expect(retried).toEqual(['a1']);
  });

  it('can hide sources, as Ask Lens does', async () => {
    const { el } = await render([QUESTION, ANSWER], { showSources: false });

    expect(el.querySelector('app-source-chips')).toBeNull();
  });
});