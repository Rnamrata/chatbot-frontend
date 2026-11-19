export interface Part {
  kind: 'text' | 'code';
  text: string;
  /** Language after the opening fence, e.g. "python"; empty for text or unlabelled code. */
  lang: string;
}

/**
 * Splits an answer into plain markdown and fenced code blocks, so code blocks can be
 * real components with a Copy button. An unclosed fence (cut-off answer) still counts as code.
 */
export function splitFences(source: string): Part[] {
  const parts: Part[] = [];
  let text: string[] = [];
  let code: string[] | null = null;
  let lang = '';

  const flushText = () => {
    const joined = text.join('\n');
    if (joined.trim()) parts.push({ kind: 'text', text: joined.trim(), lang: '' });
    text = [];
  };

  for (const line of source.split('\n')) {
    if (code === null) {
      const open = line.match(/^\s*```\s*([\w#+.-]*)/);
      if (open) {
        flushText();
        code = [];
        lang = open[1];
      } else {
        text.push(line);
      }
    } else if (/^\s*```\s*$/.test(line)) {
      parts.push({ kind: 'code', text: code.join('\n'), lang });
      code = null;
    } else {
      code.push(line);
    }
  }

  if (code !== null) parts.push({ kind: 'code', text: code.join('\n'), lang });
  flushText();
  return parts;
}