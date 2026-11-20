const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'];

/** Returns a message to show, or null when the link looks usable. */
export function checkUrl(kind: 'youtube' | 'web', value: string): string | null {
  const text = value.trim();
  if (!text) return 'Paste a link first.';

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return 'That doesn’t look like a link. It should start with https://';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return 'Use a link that starts with https://';
  }
  if (kind === 'youtube' && !YOUTUBE_HOSTS.includes(url.hostname)) {
    return 'That isn’t a YouTube link. Use the Web page card for other sites.';
  }
  return null;
}