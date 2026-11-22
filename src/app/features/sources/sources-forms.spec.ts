import { TestBed } from '@angular/core/testing';
import { byText, typeInto } from '../../testing/test-helpers';
import { FileDrop } from './file-drop';
import { LibrarySource } from './sources.models';
import { SourcesTable } from './sources-table';
import { checkUrl } from './url-check';
import { UrlForm } from './url-form';

describe('checkUrl', () => {
  it('accepts YouTube and web links, and says what is wrong with others', () => {
    expect(checkUrl('youtube', 'https://youtu.be/aircAruvnKk')).toBeNull();
    expect(checkUrl('web', 'https://en.wikipedia.org/wiki/Python')).toBeNull();
    expect(checkUrl('web', '  ')).toBe('Paste a link first.');
    expect(checkUrl('web', 'wikipedia.org')).toContain('should start with https://');
    expect(checkUrl('web', 'ftp://example.com/file')).toContain('starts with https://');
    expect(checkUrl('youtube', 'https://vimeo.com/123')).toContain('isn’t a YouTube link');
  });
});

describe('UrlForm', () => {
  async function render() {
    const fixture = TestBed.createComponent(UrlForm);
    const inputs = {
      kind: 'youtube',
      fieldId: 'yt',
      heading: 'YouTube video',
      text: 'We download the audio.',
      label: 'Video link',
      action: 'Add video',
      busyText: 'Transcribing the video…',
    };
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    const submitted: string[] = [];
    fixture.componentInstance.submitted.subscribe((url) => submitted.push(url));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, submitted, field: el.querySelector('input')!, button: el.querySelector('button')! };
  }

  it('explains a bad link next to the field instead of sending it', async () => {
    const { fixture, el, submitted, field, button } = await render();
    typeInto(field, 'https://vimeo.com/1');
    button.click();
    await fixture.whenStable();

    expect(submitted).toEqual([]);
    expect(el.querySelector('[role=alert]')?.textContent).toContain('isn’t a YouTube link');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('aria-describedby')).toBe('yt-error');
  });

  it('sends a good link, shows progress, and clears the field when done', async () => {
    const { fixture, el, submitted, field, button } = await render();
    typeInto(field, ' https://www.youtube.com/watch?v=aircAruvnKk ');
    button.click();
    expect(submitted).toEqual(['https://www.youtube.com/watch?v=aircAruvnKk']);

    fixture.componentRef.setInput('busy', true);
    await fixture.whenStable();
    expect(button.textContent).toContain('Transcribing the video…');
    expect(field.disabled).toBe(true);

    fixture.componentRef.setInput('busy', false);
    await fixture.whenStable();
    expect(el.querySelector('input')!.value).toBe('');
  });

  it('shows the server’s reason when adding failed', async () => {
    const { fixture, el } = await render();
    fixture.componentRef.setInput('error', 'Could not download the audio');
    await fixture.whenStable();

    expect(el.querySelector('[role=alert]')?.textContent).toContain('Could not download the audio');
  });
});

describe('FileDrop', () => {
  async function render() {
    const fixture = TestBed.createComponent(FileDrop);
    const picked: File[] = [];
    fixture.componentInstance.picked.subscribe((f) => picked.push(f));
    await fixture.whenStable();
    // pick() is what both the file chooser and a drop call
    const pick = (file: File) => (fixture.componentInstance as unknown as { pick(f: File[]): void }).pick([file]);
    return { fixture, picked, pick, el: fixture.nativeElement as HTMLElement };
  }

  it('takes PDF, TXT and Markdown files', async () => {
    const { picked, pick } = await render();
    pick(new File(['# Notes'], 'notes.md'));

    expect(picked.map((f) => f.name)).toEqual(['notes.md']);
  });

  it('turns away other types and empty files with a reason', async () => {
    const { fixture, picked, pick, el } = await render();

    pick(new File(['x'], 'slides.pptx'));
    await fixture.whenStable();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('PDF, TXT and Markdown');

    pick(new File([], 'empty.txt'));
    await fixture.whenStable();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('empty');
    expect(picked).toEqual([]);
  });
});

describe('SourcesTable', () => {
  const SOURCES: LibrarySource[] = [
    { id: 'a', name: 'Lecture01.pdf', type: 'file_upload', source: 'Lecture01.pdf', chunks: 12, status: 'ready', added_at: null },
    { id: 'b', name: 'Neural networks', type: 'youtube', source: 'https://youtu.be/x', chunks: 0, status: 'processing', added_at: null },
    { id: 'legacy', name: 'Older data without details', type: 'unknown', source: null, chunks: 1328, status: 'outdated', added_at: null },
  ];

  async function render() {
    const fixture = TestBed.createComponent(SourcesTable);
    fixture.componentRef.setInput('sources', SOURCES);
    const removed: string[] = [];
    fixture.componentInstance.remove.subscribe((id) => removed.push(id));
    await fixture.whenStable();
    return { fixture, removed, el: fixture.nativeElement as HTMLElement };
  }

  it('names each source’s type and status', async () => {
    const { el } = await render();
    const rows = [...el.querySelectorAll('tbody tr')].map((r) =>
      [...r.querySelectorAll('td')].slice(1, 3).map((c) => c.textContent?.trim()),
    );

    expect(rows).toEqual([
      ['PDF', 'Ready'],
      ['YouTube', 'Transcribing…'],
      ['—', 'Outdated'],
    ]);
    expect(el.querySelector('tbody tr .detail')?.textContent).toContain('12 sections');
  });

  it('asks before removing, and can’t remove something still being added', async () => {
    const { fixture, el, removed } = await render();
    expect(el.querySelector('[aria-label="Remove Neural networks"]')).toBeNull();

    byText(el, 'button', 'Remove Lecture01.pdf').click();
    await fixture.whenStable();
    expect(removed).toEqual([]);

    byText(el, '.ask button', 'Remove').click();
    expect(removed).toEqual(['a']);
  });
});