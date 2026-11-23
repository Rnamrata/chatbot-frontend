import { HttpErrorResponse } from '@angular/common/http';
import { AddKind } from './sources.models';

/** Why adding a source failed: what happened and what to do, plus the server's own words. */
export interface AddError {
  message: string;
  /** What the chat server said, shortened; shown under "Details" for anyone debugging. */
  detail?: string;
}

interface Rule {
  /** Matches the server's error text (case-insensitive). */
  test: RegExp;
  /** Only for these kinds of source; all kinds when left out. */
  kinds?: AddKind[];
  message: string;
}

// The first rule that matches wins, so the specific ones come first.
const RULES: Rule[] = [
  {
    // Ollama's own address or calls. Not a bare "EOF": a damaged PDF says "EOF marker not found",
    // and a site refusing a connection is a different problem too.
    test: /ollama|:11434|\/api\/(?:tokenize|embed)/i,
    message: 'Ollama stopped answering while Lens was reading this source. Check that Ollama is running, then add it again.',
  },
  {
    test: /ffmpeg|ffprobe/i,
    kinds: ['youtube'],
    message: 'Transcribing a video needs FFmpeg on this computer. Install it (brew install ffmpeg), then add the video again.',
  },
  {
    test: /private video|sign in|age-restricted|confirm your age|members-only|video unavailable|removed|copyright|not available/i,
    kinds: ['youtube'],
    message: "Lens couldn't download this video. It may be private, age-restricted or removed: check that it plays without signing in.",
  },
  {
    test: /download|yt-dlp|youtube|unable to extract|http error/i,
    kinds: ['youtube'],
    message: "Lens couldn't download this video. Check the link, then try again; if it keeps failing, yt-dlp may need an update (pip install -U yt-dlp).",
  },
  {
    test: /no scheme|invalid url|missing schema/i,
    kinds: ['web'],
    message: "That isn't a full web address. Paste the whole link, starting with https://.",
  },
  {
    test: /no readable text/i,
    kinds: ['web'],
    message: 'That page has no text Lens can read. It may need you to sign in, or build its content with JavaScript. Try another link to the same article.',
  },
  {
    test: /40[13]|forbidden|unauthori[sz]ed/i,
    kinds: ['web'],
    message: "That site doesn't let Lens read the page (it answered “forbidden”). Try another link to the same article.",
  },
  {
    test: /404|not found/i,
    kinds: ['web'],
    message: "That page doesn't exist any more (“not found”). Check the link in your browser.",
  },
  {
    test: /max retries|name or service|nodename|resolve|timed? ?out|ssl|certificate|connection/i,
    kinds: ['web'],
    message: "Lens couldn't reach that site. Check your internet connection and that the link opens in your browser.",
  },
  {
    test: /unsupported file type/i,
    kinds: ['file'],
    message: 'Lens can add PDF, TXT and Markdown (.md) files.',
  },
  {
    test: /no content extracted|failed to create chunks/i,
    kinds: ['file'],
    message: 'Lens found no text in this file. A scanned PDF holds pictures of pages, not text: try a PDF where you can select the words.',
  },
  {
    test: /crypt|password/i,
    kinds: ['file'],
    message: "This PDF is protected with a password, so Lens can't read it. Save an unprotected copy and add that.",
  },
  {
    test: /pdf|eof marker|startxref|xref/i,
    kinds: ['file'],
    message: 'This PDF looks damaged, so Lens could not read it. Try opening and saving it again, or export a new copy.',
  },
];

const FALLBACK: Record<AddKind, string> = {
  file: 'Lens could not add this file.',
  youtube: 'Lens could not add this video.',
  web: 'Lens could not add this page.',
};

/** Turns a failed upload into a message that says what happened and what to do. */
export function explainAddError(kind: AddKind, err: unknown): AddError {
  if (!(err instanceof HttpErrorResponse)) return { message: `${FALLBACK[kind]} Try again.` };
  if (err.status === 0) {
    return { message: "Lens can't reach the chat server. Check that llm-chatbot is running on :5001, then try again." };
  }
  if (err.status === 413) {
    return { message: 'This file is larger than the chat server allows (20 MB). Split it, or add a smaller part.' };
  }

  const raw = (err.error as { error?: string } | null)?.error;
  const detail = raw ? clean(raw) : undefined;
  const rule = detail ? RULES.find((r) => (!r.kinds || r.kinds.includes(kind)) && r.test.test(detail)) : undefined;
  return { message: rule?.message ?? `${FALLBACK[kind]} Try again; if it keeps failing, the details below say why.`, detail };
}

/** yt-dlp errors can carry terminal colour codes and run long. */
function clean(message: string): string {
  const text = message.replace(/\u001b\[[0-9;]*m/g, '').trim();
  return text.length > 240 ? `${text.slice(0, 239)}…` : text;
}
