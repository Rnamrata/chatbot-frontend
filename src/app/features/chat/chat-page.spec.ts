import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { byText, fakeStatus, typeInto } from '../../testing/test-helpers';
import { ChatPage } from './chat-page';

const API = 'http://localhost:5001';

describe('ChatPage', () => {
  let http: HttpTestingController;

  async function render(chunks = 12, health?: Parameters<typeof fakeStatus>[0]) {
    const status = fakeStatus(health);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), status.provider],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();
    http.expectOne(`${API}/stats`).flush({ total_chunks: chunks, total_sessions: 0, total_reviews: 0, status: chunks ? 'ready' : 'empty' });
    await fixture.whenStable();
    return { fixture, status, el: fixture.nativeElement as HTMLElement };
  }

  it('starts a new chat: moves to its address, keeps focus, and asks the question', async () => {
    const { fixture, el } = await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    typeInto(el.querySelector('textarea')!, 'What is gradient descent?');
    await fixture.whenStable();
    byText(el, 'button', 'Send').click();

    const [path, extras] = navigate.mock.calls[0];
    expect(path).toEqual(['/chat', expect.any(String)]);
    expect(extras).toEqual({ state: { keepFocus: true } });
    expect(http.expectOne(`${API}/chat`).request.body).toEqual({
      question: 'What is gradient descent?',
      session_id: (path as string[])[1],
    });
  });

  it('offers starter questions once there are sources', async () => {
    const { fixture, el } = await render();

    byText(el, 'app-suggested-questions button', 'What are the main ideas?').click();
    await fixture.whenStable();

    expect(el.querySelector('textarea')!.value).toBe('What are the main ideas?');
  });

  it('points to Sources first when there is nothing to search', async () => {
    const { el } = await render(0);

    expect(el.querySelector('textarea')!.disabled).toBe(true);
    expect(el.querySelector('textarea')!.placeholder).toBe('Add a source first, then ask anything about it');
    expect(el.querySelector('app-welcome')?.textContent).toContain('1. Add a source');
  });

  it('explains how to start Ollama when it is down, and checks again on request', async () => {
    const { el, status } = await render(12, { chatServer: 'up', ollama: 'down', reviewService: 'up', model: null });

    expect(el.querySelector('[role=alert]')?.textContent).toContain("Ollama isn't running");
    expect(el.querySelector('textarea')!.disabled).toBe(true);

    byText(el, 'button', 'Check again').click();
    expect(status.fake.rechecks).toBe(1);
    http.expectOne(`${API}/stats`).flush({ total_chunks: 12, total_sessions: 0, total_reviews: 0, status: 'ready' });
  });
});