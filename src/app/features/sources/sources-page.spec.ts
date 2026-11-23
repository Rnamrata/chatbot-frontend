import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { byText, typeInto } from '../../testing/test-helpers';
import { LibrarySource } from './sources.models';
import { SourcesPage } from './sources-page';

const API = 'http://localhost:5001';

const SOURCES: LibrarySource[] = [
  { id: 'pe', name: 'Prompt_Engineering.pdf', type: 'file_upload', source: 'Prompt_Engineering.pdf', chunks: 638, status: 'ready', added_at: '2026-11-22T23:48:00+00:00' },
  { id: 'trust', name: 'The trust inversion', type: 'web', source: 'https://kyndryl.com/trust', chunks: 28, status: 'ready', added_at: '2026-11-23T04:11:00+00:00' },
  { id: 'mx', name: 'MX Master 4', type: 'youtube', source: 'https://youtube.com/shorts/8YII', chunks: 0, status: 'processing', added_at: null },
  { id: 'legacy', name: 'Older data without details', type: 'unknown', source: null, chunks: 1328, status: 'outdated', added_at: null },
];

describe('SourcesPage', () => {
  let http: HttpTestingController;

  async function render(sources = SOURCES) {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SourcesPage);
    await fixture.whenStable();
    http.expectOne(`${API}/sources`).flush({ success: true, sources, total: sources.length });
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const names = () => [...el.querySelectorAll('tbody .title')].map((t) => t.textContent?.trim());
    const check = async (label: string) => {
      byText<HTMLInputElement>(el, 'input[type=checkbox]', label).click();
      await fixture.whenStable();
    };
    return { fixture, el, names, check };
  }

  it('lists every source with its type, when it was added and its status, and no way to add one here', async () => {
    const { el, names } = await render();

    expect(names()).toEqual(['Prompt_Engineering.pdf', 'The trust inversion', 'MX Master 4', 'Older data without details']);
    expect(el.querySelector('.count')?.textContent).toBe('4 sources');
    const first = [...el.querySelectorAll('tbody tr')[0].querySelectorAll('td')].map((td) => td.textContent?.trim());
    expect(first.slice(2, 5)).toEqual(['PDF', expect.stringMatching(/^(Today|Yesterday|Nov 22),?/), 'Ready']);
    expect(el.textContent).not.toContain('Add video');
    expect(el.querySelector('.legacy')?.textContent).toContain("can't be chosen for a chat");
  });

  it('searches by name and link', async () => {
    const { fixture, el, names } = await render();

    typeInto(el.querySelector<HTMLInputElement>('#src-search')!, 'kyndryl');
    await fixture.whenStable();
    expect(names()).toEqual(['The trust inversion']);

    typeInto(el.querySelector<HTMLInputElement>('#src-search')!, 'nothing like this');
    await fixture.whenStable();
    expect(el.querySelector('tbody')?.textContent).toContain('No sources match your search.');
  });

  it('selects sources, all of them but the outdated data, and clears the selection', async () => {
    const { fixture, el, check } = await render();
    expect(el.querySelector('[aria-label="Selected sources"]')).toBeNull();
    expect(byText<HTMLInputElement>(el, 'input', 'Select Older data without details').disabled).toBe(true);

    await check('Select The trust inversion');
    expect(el.querySelector('[aria-label="Selected sources"]')?.textContent).toContain('1 source selected');

    await check('Select all sources');
    expect(el.querySelector('[aria-label="Selected sources"]')?.textContent).toContain('3 sources selected');

    byText(el, 'button', 'Clear').click();
    await fixture.whenStable();
    expect(el.querySelector('[aria-label="Selected sources"]')).toBeNull();
  });

  it('asks before deleting the selected sources, then deletes each one', async () => {
    const { fixture, el, check } = await render();
    await check('Select Prompt_Engineering.pdf');
    await check('Select The trust inversion');

    byText(el, '.selection button', 'Delete').click();
    await fixture.whenStable();
    expect(el.querySelector('.selection')?.textContent).toContain("Delete 2 sources? They're removed from every chat");
    http.expectNone(`${API}/sources/pe`);

    byText(el, '.selection button.danger', 'Delete').click();
    for (const id of ['pe', 'trust']) {
      expect(http.expectOne(`${API}/sources/${id}`).request.method).toBe('DELETE');
    }
  });

  it('starts a chat that answers from the selected sources only', async () => {
    const { el, check } = await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await check('Select The trust inversion');
    await check('Select Prompt_Engineering.pdf');

    byText(el, 'button', 'Start a chat with these').click();

    const [path] = navigate.mock.calls[0];
    const id = (path as string[])[1];
    expect(path).toEqual(['/chat', expect.any(String)]);
    const put = http.expectOne(`${API}/chat/session/${id}/sources`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ source_ids: ['pe', 'trust'] });
  });

  it('points to the chat when there are no sources yet', async () => {
    const { el } = await render([]);

    expect(el.querySelector('.empty')?.textContent).toContain('Sources are added from a chat: press +');
    expect(byText(el, 'a', 'Start a chat').getAttribute('href')).toBe('/chat');
  });
});
