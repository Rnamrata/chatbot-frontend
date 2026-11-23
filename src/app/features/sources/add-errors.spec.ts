import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { explainAddError } from './add-errors';

const server = (error: string, status = 400) => new HttpErrorResponse({ status, error: { success: false, error } });

describe('explainAddError', () => {
  it.each([
    ['file', 'Post "http://127.0.0.1:11434/api/tokenize": EOF', /Ollama stopped answering/],
    ['youtube', 'Post "http://localhost:11434/api/embed": EOF', /Ollama stopped answering/],
    ['youtube', 'ERROR: [youtube] abc: Private video. Sign in if you’ve been granted access', /private, age-restricted or removed/],
    ['youtube', 'ffmpeg not found. Please install or provide the path', /needs FFmpeg/],
    ['youtube', 'Failed to download audio from YouTube', /couldn't download this video/],
    ['web', "Invalid URL 'not a link': No scheme supplied.", /full web address/],
    ['web', 'No readable text found on that page', /no text Lens can read/],
    ['web', '403 Client Error: Forbidden for url: https://x.com', /doesn't let Lens read/],
    ['web', '404 Client Error: Not Found for url: https://x.com/a', /doesn't exist any more/],
    ['web', "HTTPSConnectionPool(host='nope.example', port=443): Max retries exceeded", /couldn't reach that site/],
    ['file', 'Unsupported file type', /PDF, TXT and Markdown/],
    ['file', 'No content extracted from file', /no text in this file/],
    ['file', 'File has not been decrypted', /protected with a password/],
    ['file', 'EOF marker not found', /looks damaged/],
  ] as const)('explains a %s failure: %s', (kind, error, expected) => {
    const result = explainAddError(kind, server(error));

    expect(result.message).toMatch(expected);
    expect(result.detail).toBe(error);
  });

  it('does not take a web page refusing a connection for Ollama', () => {
    const result = explainAddError('web', server("HTTPSConnectionPool(host='a.com', port=443): Connection refused"));

    expect(result.message).toMatch(/couldn't reach that site/);
  });

  it('does not read "age" inside other words as an age limit', () => {
    expect(explainAddError('youtube', server('Unable to extract page data')).message).toMatch(/Check the link/);
  });

  it('says the chat server is unreachable when there is no answer at all', () => {
    expect(explainAddError('web', new HttpErrorResponse({ status: 0 })).message).toMatch(/can't reach the chat server.*:5001/);
  });

  it('names the size limit for a file that is too large', () => {
    expect(explainAddError('file', new HttpErrorResponse({ status: 413 })).message).toMatch(/20 MB/);
  });

  it('falls back to a plain message, keeping the server text as the detail', () => {
    const result = explainAddError('web', server('Something nobody expected'));

    expect(result.message).toBe('Lens could not add this page. Try again; if it keeps failing, the details below say why.');
    expect(result.detail).toBe('Something nobody expected');
  });

  it('applies a rule only to its kind of source', () => {
    expect(explainAddError('file', server('Invalid URL: No scheme supplied')).message).toMatch(/could not add this file/);
  });

  it('removes terminal colour codes and shortens long details', () => {
    const result = explainAddError('youtube', server(`\u001b[0;31mERROR:\u001b[0m ${'x'.repeat(400)}`));

    expect(result.detail?.startsWith('ERROR:')).toBe(true);
    expect(result.detail?.length).toBe(240);
  });
});
