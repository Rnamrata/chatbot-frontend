/** Plain functions behind the code viewer: a small syntax highlighter and line folding. */

export type TokenKind = 'kw' | 'str' | 'num' | 'type' | 'com' | 'plain';

export interface Token {
  kind: TokenKind;
  text: string;
}

const KEYWORDS: Record<string, string[]> = {
  python: [
    'import', 'from', 'def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'in', 'not', 'and', 'or',
    'with', 'as', 'try', 'except', 'finally', 'None', 'True', 'False', 'lambda', 'pass', 'raise', 'yield',
    'async', 'await', 'global', 'is', 'break', 'continue',
  ],
  js: [
    'import', 'from', 'export', 'default', 'function', 'class', 'extends', 'return', 'if', 'else', 'for', 'while',
    'do', 'const', 'let', 'var', 'new', 'this', 'try', 'catch', 'finally', 'throw', 'async', 'await', 'null',
    'undefined', 'true', 'false', 'typeof', 'instanceof', 'of', 'in', 'switch', 'case', 'break', 'continue',
  ],
  java: [
    'import', 'package', 'public', 'private', 'protected', 'class', 'interface', 'enum', 'extends', 'implements',
    'static', 'final', 'throws', 'throw', 'return', 'boolean', 'int', 'long', 'double', 'float', 'char', 'void',
    'new', 'try', 'catch', 'finally', 'if', 'else', 'for', 'while', 'null', 'true', 'false', 'this', 'super',
  ],
};
KEYWORDS['ts'] = [
  ...KEYWORDS['js'],
  'interface', 'type', 'enum', 'implements', 'private', 'public', 'protected', 'readonly', 'as', 'string', 'number',
  'boolean', 'void', 'any', 'unknown', 'never',
];

const TOKEN = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(#.*$|\/\/.*$|\/\*.*?\*\/)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|([\s\S])/g;

/** Splits one line into coloured pieces. Good enough for reading, not a parser. */
export function tokenize(line: string, language: string | null): Token[] {
  const keywords = new Set(KEYWORDS[language ?? ''] ?? []);
  const hashComments = language === 'python';
  const tokens: Token[] = [];
  const push = (kind: TokenKind, text: string) => {
    const last = tokens.at(-1);
    if (last && last.kind === kind) last.text += text;
    else tokens.push({ kind, text });
  };

  for (const m of line.matchAll(TOKEN)) {
    if (m[1]) push('str', m[1]);
    else if (m[2] && (hashComments ? m[2].startsWith('#') : !m[2].startsWith('#'))) push('com', m[2]);
    else if (m[2]) {
      // '#' in JS/Java, or '//' in Python: not a comment there, so colour the rest normally
      push('plain', m[2][0]);
      tokenize(m[2].slice(1), language).forEach((t) => push(t.kind, t.text));
    } else if (m[3]) push('num', m[3]);
    else if (m[4]) push(keywords.has(m[4]) ? 'kw' : /^[A-Z]/.test(m[4]) && language !== 'python' ? 'type' : 'plain', m[4]);
    else push('plain', m[5]);
  }
  return tokens.length ? tokens : [{ kind: 'plain', text: ' ' }];
}

export type Row = { kind: 'line'; n: number } | { kind: 'fold'; from: number; to: number };

/** Lines within this distance of a finding are always shown. */
export const CONTEXT = 2;
/** Shorter quiet stretches are shown rather than folded. */
const MIN_FOLD = 3;

/**
 * Lines to show: every line near a finding, and folds for long stretches without any.
 * With no findings at all, nothing is folded.
 */
export function buildRows(lineCount: number, flagged: number[], unfolded: ReadonlySet<string>): Row[] {
  if (!flagged.length) return Array.from({ length: lineCount }, (_, i) => ({ kind: 'line', n: i + 1 }));

  const near = (n: number) => flagged.some((line) => Math.abs(line - n) <= CONTEXT);
  const rows: Row[] = [];
  let n = 1;
  while (n <= lineCount) {
    if (near(n)) {
      rows.push({ kind: 'line', n });
      n++;
      continue;
    }
    let end = n;
    while (end + 1 <= lineCount && !near(end + 1)) end++;
    if (end - n + 1 >= MIN_FOLD && !unfolded.has(foldKey(n, end))) {
      rows.push({ kind: 'fold', from: n, to: end });
    } else {
      for (let i = n; i <= end; i++) rows.push({ kind: 'line', n: i });
    }
    n = end + 1;
  }
  return rows;
}

export function foldKey(from: number, to: number): string {
  return `${from}-${to}`;
}