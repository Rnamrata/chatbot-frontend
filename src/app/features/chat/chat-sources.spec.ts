import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { allowDialogs, byText, fakeStatus, typeInto } from '../../testing/test-helpers';
import { LibrarySource } from '../sources/sources.models';
import { AddSourcesDialog } from './add-sources-dialog';
import { ChatPage } from './chat-page';
import { ChatService } from './chat.service';
import { ChatSourcesBar } from './chat-sources-bar';

const API = 'http://localhost:5001';

const LIBRARY: LibrarySource[] = [
  { id: 'pe', name: 'Prompt_Engineering.pdf', type: 'file_upload', source: 'Prompt_Engineering.pdf', chunks: 638, status: 'ready', added_at: null },
  { id: 'trust', name: 'The trust inversion', type: 'web', source: 'https://www.kyndryl.com/trust', chunks: 28, status: 'ready', added_at: null },
  { id: 'legacy', name: 'Older data without details', type: 'unknown', source: null, chunks: 9, status: 'outdated', added_at: null },
];

describe('ChatSourcesBar', () => {
  async function render(ids: string[], uploads = [] as { id: string; name: string; status: 'adding' | 'failed'; error?: string }[]) {
    const fixture = TestBed.createComponent(ChatSourcesBar);
    fixture.componentRef.setInput('ids', ids);
    fixture.componentRef.setInput('library', LIBRARY);
    fixture.componentRef.setInput('uploads', uploads);
    const removed: string[] = [];
    fixture.componentInstance.remove.subscribe((id) => removed.push(id));
    await fixture.whenStable();
    return { el: fixture.nativeElement as HTMLElement, removed };
  }

  it('says the chat answers from all sources when it has none of its own', async () => {
    const { el } = await render([]);

    expect(el.querySelector('.scope')?.textContent).toBe('Answering from all your sources');
    expect(el.querySelectorAll('.chip')).toHaveLength(0);
  });

  it("shows the chat's sources with their type, and removes one", async () => {
    const { el, removed } = await render(['trust', 'pe', 'gone']);

    expect([...el.querySelectorAll('.chip')].map((c) => [c.querySelector('.badge')?.textContent, c.querySelector('.name')?.textContent])).toEqual([
      ['WEB', 'The trust inversion'],
      ['PDF', 'Prompt_Engineering.pdf'],
    ]);
    byText(el, 'button', 'Remove The trust inversion from this chat').click();
    expect(removed).toEqual(['trust']);
  });

  it('shows files being added, and why one could not be', async () => {
    const { el } = await render([], [
      { id: 'u1', name: 'notes.pdf', status: 'adding' },
      { id: 'u2', name: 'scan.pdf', status: 'failed', error: 'Lens found no text in this file.' },
    ]);

    expect(el.querySelector('.chip.busy')?.textContent).toContain('notes.pdf · reading…');
    expect(el.querySelector('[role=alert]')?.textContent).toContain("Couldn't add scan.pdf");
    expect(el.querySelector('[role=alert]')?.textContent).toContain('Lens found no text in this file.');
  });
});

describe('AddSourcesDialog', () => {
  beforeEach(() => allowDialogs());

  async function render(chosen: string[]) {
    const fixture = TestBed.createComponent(AddSourcesDialog);
    fixture.componentRef.setInput('library', LIBRARY);
    fixture.componentRef.setInput('chosen', chosen);
    fixture.componentRef.setInput('open', true);
    const applied: string[][] = [];
    const uploaded: File[] = [];
    fixture.componentInstance.apply.subscribe((ids) => applied.push(ids));
    fixture.componentInstance.upload.subscribe((f) => uploaded.push(f));
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement, applied, uploaded };
  }

  it("opens with the chat's sources ticked, leaves out older data, and uses the new choice", async () => {
    const { fixture, el, applied } = await render(['pe']);
    expect(el.querySelector('dialog')?.hasAttribute('open')).toBe(true);
    expect(byText<HTMLInputElement>(el, 'label', 'Prompt_Engineering.pdf').querySelector('input')!.checked).toBe(true);
    expect(el.textContent).not.toContain('Older data without details');
    expect(el.textContent).toContain("Older data stored without names can't be added to a chat.");

    byText(el, 'label', 'The trust inversion').querySelector('input')!.click();
    await fixture.whenStable();
    expect(el.querySelector('.count')?.textContent).toBe('2 selected');

    byText(el, 'button', 'Use 2 sources').click();
    expect(applied).toEqual([['pe', 'trust']]);
    expect(el.querySelector('dialog')?.hasAttribute('open')).toBe(false);
  });

  it('says the chat uses all sources when nothing is ticked', async () => {
    const { el, applied } = await render([]);

    expect(el.querySelector('.count')?.textContent).toBe('Nothing selected: the chat uses all sources');
    byText(el, 'button', 'Use all sources').click();
    expect(applied).toEqual([[]]);
  });

  it('searches the library', async () => {
    const { fixture, el } = await render([]);

    typeInto(el.querySelector<HTMLInputElement>('#add-search')!, 'kyndryl');
    await fixture.whenStable();
    expect([...el.querySelectorAll('label.row .name')].map((n) => n.textContent)).toEqual(['The trust inversion']);
  });

  it('uploads PDF, TXT and Markdown files, and turns other files away with a reason', async () => {
    const { fixture, el, uploaded } = await render([]);
    const input = el.querySelector<HTMLInputElement>('input[type=file]')!;
    const good = new File(['x'], 'notes.md');
    Object.defineProperty(input, 'files', { value: [good, new File(['x'], 'slides.pptx')], configurable: true });

    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(uploaded).toEqual([good]);
    expect(el.querySelector('.problem')?.textContent).toContain('not slides.pptx');
  });
});

describe('ChatPage with sources', () => {
  let http: HttpTestingController;

  beforeEach(() => allowDialogs());

  async function render() {
    const status = fakeStatus();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), status.provider],
    });
    http = TestBed.inject(HttpTestingController);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();
    http.expectOne(`${API}/stats`).flush({ total_chunks: 12, total_sessions: 0, total_reviews: 0, status: 'ready' });
    http.expectOne(`${API}/sources`).flush({ success: true, sources: LIBRARY, total: LIBRARY.length });
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const newId = () => (navigate.mock.calls[0][0] as string[])[1];
    /** What the router does after the first action in a new chat: open /chat/<id>. */
    const arrive = async () => {
      fixture.componentRef.setInput('sessionId', newId());
      await fixture.whenStable();
    };
    return { fixture, el, newId, arrive };
  }

  it('adds a pasted link as a source first, then asks the question from it', async () => {
    const { fixture, el, newId, arrive } = await render();
    typeInto(el.querySelector('textarea')!, 'What changed? https://youtube.com/shorts/8YII135YGIQ');
    await fixture.whenStable();
    expect(el.querySelector('.pasted')?.textContent).toContain('YouTube video · youtube.com/shorts/8YII135YGIQ');

    byText(el, 'button', 'Send').click();
    await arrive();
    const upload = http.expectOne(`${API}/upload/youtube`);
    expect(upload.request.body).toEqual({ url: 'https://youtube.com/shorts/8YII135YGIQ', session_id: newId() });
    http.expectNone(`${API}/chat`); // the question waits for the video
    expect(el.querySelector('.user .link')?.textContent).toContain('youtube.com/shorts/8YII135YGIQ');
    expect(el.querySelector('.adding')?.textContent).toContain('Adding the YouTube video as a source · transcribing, 0:00');

    upload.flush({ success: true, source: { ...LIBRARY[0], id: 'mx', name: 'MX Master 4', type: 'youtube' } });
    await fixture.whenStable();
    expect(http.expectOne(`${API}/chat`).request.body).toEqual({ question: 'What changed?', session_id: newId() });
    expect(TestBed.inject(ChatService).conversation(newId()).sourceIds()).toEqual(['mx']);
  });

  it("explains a link that couldn't be added, and tries it again", async () => {
    const { fixture, el, arrive } = await render();
    typeInto(el.querySelector('textarea')!, 'https://example.com/private');
    await fixture.whenStable();
    byText(el, 'button', 'Send').click();
    await arrive();
    http
      .expectOne(`${API}/upload/web`)
      .flush({ success: false, error: '403 Client Error: Forbidden for url' }, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();

    expect(el.querySelector('.failed')?.textContent).toContain("doesn't let Lens read the page");
    expect(el.querySelector('.failed details')?.textContent).toContain('403 Client Error');
    byText(el, '.failed button', 'Try again').click();
    http.expectOne(`${API}/upload/web`);
  });

  it("explains a dropped file that couldn't be added", async () => {
    const { fixture, el, arrive } = await render();
    const drop = new Event('drop', { bubbles: true }) as DragEvent;
    Object.defineProperty(drop, 'dataTransfer', { value: { types: ['Files'], files: [new File(['x'], 'scan.pdf'), new File(['x'], 'a.docx')] } });

    fixture.nativeElement.dispatchEvent(drop);
    await arrive();
    expect(el.querySelector('.problem')?.textContent).toContain('not a.docx');
    const upload = http.expectOne(`${API}/upload/file`);
    expect(((upload.request.body as FormData).get('file') as File).name).toBe('scan.pdf');
    expect(el.querySelector('.chip.busy')?.textContent).toContain('scan.pdf · reading…');

    upload.flush({ success: false, error: 'No content extracted from file' }, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();
    expect(el.querySelector('app-chat-sources-bar [role=alert]')?.textContent).toContain('Lens found no text in this file');
  });

  it('keeps a link as text when asked to', async () => {
    const { fixture, el, newId } = await render();
    typeInto(el.querySelector('textarea')!, 'Is https://example.com a good site?');
    await fixture.whenStable();

    byText(el, 'button', "Don't add the link as a source").click();
    await fixture.whenStable();
    expect(el.querySelector('.pasted')).toBeNull();
    byText(el, 'button', 'Send').click();

    http.expectNone(`${API}/upload/web`);
    expect(http.expectOne(`${API}/chat`).request.body).toEqual({ question: 'Is https://example.com a good site?', session_id: newId() });
  });

  it('chooses sources for a new chat through +, before the first question', async () => {
    const { fixture, el, newId } = await render();

    byText(el, 'app-composer button', 'Add sources').click();
    await fixture.whenStable();
    byText(el, 'label', 'The trust inversion').querySelector('input')!.click();
    await fixture.whenStable();
    byText(el, 'button', 'Use 1 source').click();
    await fixture.whenStable();

    const put = http.expectOne(`${API}/chat/session/${newId()}/sources`);
    expect(put.request.body).toEqual({ source_ids: ['trust'] });
    put.flush({ success: true, session: { source_ids: ['trust'] } });
  });
});
