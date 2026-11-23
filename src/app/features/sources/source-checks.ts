import { FILE_TYPES, MAX_FILE_BYTES, SourceType } from './sources.models';

const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'];

/** Why Lens can't take this file, or null when it can. */
export function checkFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!FILE_TYPES.some((ext) => name.endsWith(ext))) return `Lens can read PDF, TXT and Markdown files, not ${file.name}.`;
  if (file.size > MAX_FILE_BYTES) return `${file.name} is larger than 20 MB.`;
  if (file.size === 0) return `${file.name} is empty.`;
  return null;
}

/** The first web or YouTube link in a message, and the message without it. */
export function findLink(text: string): { kind: 'youtube' | 'web'; url: string; rest: string } | null {
  const match = /\bhttps?:\/\/[^\s<>"']+/i.exec(text);
  if (!match) return null;
  // Punctuation that ends the sentence isn't part of the link; a closing bracket is when the link
  // has its opening one (Wikipedia's ".../Python_(programming_language)")
  let url = match[0].replace(/[.,;:!?]+$/, '');
  while (url.endsWith(')') && (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0)) {
    url = url.slice(0, -1).replace(/[.,;:!?]+$/, '');
  }
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  const rest = (text.slice(0, match.index) + text.slice(match.index + url.length))
    .replace(/\s+/g, ' ')
    .replace(/\s+([?.,!;:])/g, '$1') // no space before the punctuation the link left behind
    .trim();
  return { kind: YOUTUBE_HOSTS.includes(host) ? 'youtube' : 'web', url, rest };
}

/** The short type name shown in the library and the chat's source list. */
export function typeLabel(type: SourceType, source: string | null, name = ''): string {
  switch (type) {
    case 'youtube':
      return 'YouTube';
    case 'web':
      return 'Web page';
    case 'file_upload': {
      const file = (source ?? name).toLowerCase();
      if (file.endsWith('.pdf')) return 'PDF';
      if (file.endsWith('.md')) return 'Markdown';
      if (file.endsWith('.txt')) return 'Text';
      return 'File';
    }
    default:
      return '—';
  }
}

/** "Today, 6:49 PM", "Yesterday, 9:02 AM", or "Nov 20" (with the year when it isn't this one). */
export function addedLabel(iso: string | null, now = new Date()): string {
  if (!iso) return '—';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '—';
  const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(now) - day(at)) / 86_400_000);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  return at.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(at.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

/** The short badge shown before a source's name in the chat: PDF, TXT, MD, WEB or YT. */
export function badgeLabel(type: SourceType, source: string | null, name = ''): string {
  if (type === 'youtube') return 'YT';
  if (type === 'web') return 'WEB';
  const label = typeLabel(type, source, name);
  return label === 'Markdown' ? 'MD' : label === 'Text' ? 'TXT' : label === 'PDF' ? 'PDF' : 'FILE';
}
