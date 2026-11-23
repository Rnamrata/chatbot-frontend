import { splitFences } from './markdown';

describe('splitFences', () => {
  it('splits text and fenced code', () => {
    expect(splitFences('Intro\n```python\nprint(1)\n```\nAfter')).toEqual([
      { kind: 'text', text: 'Intro', lang: '' },
      { kind: 'code', text: 'print(1)', lang: 'python' },
      { kind: 'text', text: 'After', lang: '' },
    ]);
  });

  it('treats an unclosed fence as code', () => {
    expect(splitFences('```\nx = 1')).toEqual([{ kind: 'code', text: 'x = 1', lang: '' }]);
  });
});
describe('inNewTab', () => {
  it('opens web links beside Lens and leaves other links alone', async () => {
    const { inNewTab } = await import('./markdown-answer');

    expect(inNewTab('<p><a href="https://peps.python.org/">PEP 8</a> and <a href="#top">top</a></p>')).toBe(
      '<p><a target="_blank" rel="noopener noreferrer" href="https://peps.python.org/">PEP 8</a> and <a href="#top">top</a></p>',
    );
  });
});
