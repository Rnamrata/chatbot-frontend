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
});