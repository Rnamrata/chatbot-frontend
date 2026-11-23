import { TestBed } from '@angular/core/testing';
import { FindingList } from './finding-list';

describe('FindingList', () => {
  it('shows the selected finding with its line of code and suggestion', async () => {
    const fixture = TestBed.createComponent(FindingList);
    fixture.componentRef.setInput('code', 'import os\nPASSWORD = "admin123"\n');
    fixture.componentRef.setInput('findings', [
      {
        index: 0,
        finding: { file: 'a.py', line: 2, severity: 'high', message: 'Hardcoded password', suggestion: 'Read it from the environment.' },
      },
    ]);
    fixture.componentRef.setInput('selected', 0);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.snippet')?.textContent).toContain('PASSWORD = "admin123"');
    expect(el.querySelector('.snippet .n')?.textContent).toBe('2');
    expect(el.querySelector('.tip')?.textContent).toContain('Read it from the environment.');
    expect(el.querySelector('.ask')?.textContent).toContain('Ask about line 2');
  });

  it('marks a finding from the AI reviewer as one to check, and explains why when it is opened', async () => {
    const fixture = TestBed.createComponent(FindingList);
    fixture.componentRef.setInput('code', 'a = 1\nb = a / len(xs)\n');
    fixture.componentRef.setInput('findings', [
      { index: 0, finding: { file: 'a.py', line: 2, severity: 'medium', message: 'Division by zero', category: 'bug', source: 'llm' } },
      { index: 1, finding: { file: 'a.py', line: 1, severity: 'low', message: 'Unused', category: 'maintainability', source: 'ruff' } },
    ]);
    fixture.componentRef.setInput('selected', 0);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const cards = el.querySelectorAll('.card');
    expect(cards[0].querySelector('.where')?.textContent).toBe('Line 2 · bug · AI reviewer');
    expect(cards[0].querySelector('.ai')?.textContent).toBe('AI · check it');
    expect(cards[0].querySelector('.ai-note')?.textContent).toContain('Check the code before you change it.');
    expect(cards[1].querySelector('.ai')).toBeNull();
  });

  it('names the secret scan as the source of its findings', async () => {
    const fixture = TestBed.createComponent(FindingList);
    fixture.componentRef.setInput('findings', [
      { index: 0, finding: { file: 'a.ts', line: 3, severity: 'high', message: 'Hard-coded key', category: 'security', source: 'secrets' } },
    ]);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.where')?.textContent).toBe('Line 3 · security · Secret scan');
    expect(el.querySelector('.ai')).toBeNull();
  });
});
