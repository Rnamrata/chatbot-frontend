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