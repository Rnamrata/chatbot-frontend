import { TestBed } from '@angular/core/testing';
import { allowScrolling, byText } from '../../testing/test-helpers';
import { CodeViewer } from './code-viewer';
import { Finding } from './review.models';
import { ReviewWarning } from './review-warning';
import { SeverityFilter } from './severity-filter';

const CODE = Array.from({ length: 20 }, (_, i) => `line_${i + 1} = ${i + 1}`).join('\n');
const FINDINGS: Finding[] = [
  { file: 'a.py', line: 10, severity: 'high', message: 'Hardcoded password' },
  { file: 'a.py', line: 11, severity: 'critical', message: 'SQL injection' },
  { file: 'a.py', line: 18, severity: 'low', message: 'Unused import' },
];

describe('SeverityFilter', () => {
  it('counts findings by colour, critical with high, and filters on a press', async () => {
    const fixture = TestBed.createComponent(SeverityFilter);
    fixture.componentRef.setInput('findings', FINDINGS);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect([...el.querySelectorAll('button')].map((b) => b.textContent?.trim())).toEqual(['2 high', '1 low']);

    byText(el, 'button', '1 low').click();
    await fixture.whenStable();
    expect(fixture.componentInstance.selected()).toBe('low');
    expect(byText(el, 'button', '1 low').getAttribute('aria-pressed')).toBe('true');

    byText(el, 'button', '1 low').click();
    expect(fixture.componentInstance.selected()).toBeNull();
  });
});

describe('ReviewWarning', () => {
  async function render(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(ReviewWarning);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    let retries = 0;
    fixture.componentInstance.retry.subscribe(() => retries++);
    await fixture.whenStable();
    return { el: fixture.nativeElement as HTMLElement, retries: () => retries };
  }

  it('says which check couldn’t run and what the results are based on', async () => {
    const { el } = await render({ warnings: [{ source: 'llm', message: 'Ollama timed out' }], ranWith: 'Ruff' });

    expect(el.textContent).toContain('Only part of this review ran');
    expect(el.textContent).toContain("AI reviewer couldn't run: Ollama timed out.");
    expect(el.textContent).toContain('These results come from Ruff alone');
  });

  it('says plainly when nothing was reviewed, and can run it again', async () => {
    const { el, retries } = await render({ failure: 'Review service unreachable', canRetry: true });

    expect(el.textContent).toContain('This file was not reviewed');
    expect(el.classList).toContain('failed');
    byText(el, 'button', 'Run the review again').click();
    expect(retries()).toBe(1);
  });
});

describe('CodeViewer', () => {
  beforeAll(allowScrolling);
  async function render(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(CodeViewer);
    fixture.componentRef.setInput('code', CODE);
    fixture.componentRef.setInput('language', 'python');
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const shownLines = (el: HTMLElement) => [...el.querySelectorAll('.row .n')].map((n) => Number(n.textContent));

  it('shows lines near findings and folds the quiet stretches', async () => {
    const { el } = await render({ findings: FINDINGS, shown: FINDINGS });

    // 8–13 and 16–20 are within 2 lines of a finding; the 2-line gap between them is too short to fold
    expect(shownLines(el)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect([...el.querySelectorAll('.fold')].map((f) => f.textContent?.trim())).toEqual([
      'Show 7 lines without issues (1–7)',
    ]);
    expect(el.querySelector('#line-10')?.classList).toContain('high');
    expect(el.querySelector('#line-18')?.classList).toContain('low');
  });

  it('opens a fold on request', async () => {
    const { fixture, el } = await render({ findings: FINDINGS, shown: FINDINGS });

    byText(el, '.fold', 'Show 7 lines').click();
    await fixture.whenStable();

    expect(shownLines(el)).toHaveLength(20);
    expect(el.querySelector('.fold')).toBeNull();
  });

  it('highlights only the findings the filter leaves, and outlines the selected line', async () => {
    const { el } = await render({ findings: FINDINGS, shown: [FINDINGS[2]], selectedLine: 18 });

    expect(el.querySelector('#line-10')?.classList).not.toContain('high');
    expect(el.querySelector('#line-18')?.classList).toContain('selected');
  });

  it('shows every line of a file without findings', async () => {
    const { el } = await render({});

    expect(shownLines(el)).toHaveLength(20);
    expect(el.querySelector('.fold')).toBeNull();
  });
});