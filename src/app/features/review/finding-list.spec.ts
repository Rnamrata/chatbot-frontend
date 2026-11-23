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

  describe('why it matters', () => {
    const WHY = {
      id: 'sql-injection',
      title: 'SQL built from input',
      reason: 'One quote in a name can read, change or delete other rows.',
      fix: 'Pass values as query parameters.',
      source: 'OWASP SQL Injection Prevention',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html',
    };

    async function open(finding: object) {
      const fixture = TestBed.createComponent(FindingList);
      fixture.componentRef.setInput('findings', [
        { index: 0, finding: { file: 'a.py', line: 20, severity: 'high', message: 'SQL injection (S608)', source: 'ruff', ...finding } },
      ]);
      fixture.componentRef.setInput('selected', 0);
      await fixture.whenStable();
      return fixture.nativeElement as HTMLElement;
    }

    it('shows why the problem matters, with its source opening in a new tab', async () => {
      const el = await open({ why: WHY, suggestion: 'Use cursor.execute with ? placeholders.' });

      expect(el.querySelector('.tip')?.textContent).toContain('Use cursor.execute with ? placeholders.');
      expect(el.querySelector('.why p')?.textContent).toBe('Why it matters: One quote in a name can read, change or delete other rows.');
      const link = el.querySelector<HTMLAnchorElement>('.why a.source')!;
      expect(link.textContent).toContain('OWASP SQL Injection Prevention');
      expect(link.textContent).toContain('(opens in a new tab)');
      expect(link.href).toBe(WHY.url);
      expect(link.target).toBe('_blank');
      expect(link.rel).toBe('noopener noreferrer');
    });

    it("uses the card's fix when the check gave no suggestion", async () => {
      const el = await open({ why: WHY });

      expect(el.querySelector('.tip')?.textContent).toContain('Pass values as query parameters.');
    });

    it('names a source without an https link but does not link it', async () => {
      const el = await open({ why: { ...WHY, url: 'javascript:alert(1)' } });

      expect(el.querySelector('.why a')).toBeNull();
      expect(el.querySelector('.why .source')?.textContent).toBe('OWASP SQL Injection Prevention');
    });

    it('shows nothing extra for a finding without a card', async () => {
      const el = await open({});

      expect(el.querySelector('.why')).toBeNull();
      expect(el.querySelector('.tip')).toBeNull();
    });
  });
});
