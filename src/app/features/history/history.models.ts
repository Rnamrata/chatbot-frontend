/** One session as GET /chat/sessions returns it. */
export interface SessionSummary {
  session_id: string;
  type: 'docs' | 'code_review';
  title: string;
  preview: string;
  pinned: boolean;
  created_at: string;
  last_activity: string;
  /** Questions asked. */
  message_count: number;
  /** All messages, answers and the review summary included. */
  messages: number;
  source_count: number;
  review_id: string | null;
  filename: string | null;
  language: string | null;
}

export interface SessionsResponse {
  sessions: SessionSummary[];
  total_sessions: number;
}

export type HistoryKind = 'chat' | 'code';

/** A session ready to show in History and the sidebar. */
export interface HistoryItem {
  id: string;
  kind: HistoryKind;
  title: string;
  preview: string;
  pinned: boolean;
  /** Last used. */
  at: Date;
  /** Where the row opens: the chat, or the review page for a code review. */
  link: string[];
  meta: string;
  reviewId: string | null;
  filename: string | null;
}

export type GroupLabel = 'Pinned' | 'Today' | 'Yesterday' | 'Earlier this week' | 'Older';

export interface HistoryGroup {
  label: GroupLabel;
  items: HistoryItem[];
}

const LANGUAGES: Record<string, string> = { python: 'Python', js: 'JavaScript', ts: 'TypeScript', java: 'Java' };

export function toItem(s: SessionSummary): HistoryItem {
  const code = s.type === 'code_review';
  const parts = code
    ? ['Code Review', LANGUAGES[s.language ?? ''] ?? null, count(s.messages, 'message')]
    : ['Document Q&A', count(s.messages, 'message'), s.source_count ? count(s.source_count, 'source') : null];
  return {
    id: s.session_id,
    kind: code ? 'code' : 'chat',
    title: s.title || (code ? 'Code review' : 'Chat'),
    preview: s.preview ?? '',
    pinned: !!s.pinned,
    at: new Date(s.last_activity),
    link: code && s.review_id ? ['/review', s.review_id] : ['/chat', s.session_id],
    meta: parts.filter(Boolean).join(' · '),
    reviewId: s.review_id ?? null,
    filename: s.filename ?? null,
  };
}

function count(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

const ORDER: GroupLabel[] = ['Pinned', 'Today', 'Yesterday', 'Earlier this week', 'Older'];

/** Pinned first, then by day; within a group newest first. */
export function groupItems(items: HistoryItem[], now: Date): HistoryGroup[] {
  const groups = new Map<GroupLabel, HistoryItem[]>();
  for (const item of [...items].sort((a, b) => b.at.getTime() - a.at.getTime())) {
    const label = item.pinned ? 'Pinned' : dayGroup(item.at, now);
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }
  return ORDER.filter((label) => groups.has(label)).map((label) => ({ label, items: groups.get(label)! }));
}

function dayGroup(at: Date, now: Date): GroupLabel {
  const days = daysBetween(at, now);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'Earlier this week';
  return 'Older';
}

/** Calendar days from `at` to `now` (0 = same day). */
export function daysBetween(at: Date, now: Date): number {
  const start = new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((end - start) / 86_400_000);
}

/**
 * The time column in History: "9:25 PM" today and yesterday, "Mon" this week, then "Nov 3".
 * In the Pinned group, where the day isn't in the heading, yesterday reads "Yesterday".
 */
export function rowTime(at: Date, now: Date, pinned = false): string {
  const days = daysBetween(at, now);
  if (days === 1 && pinned) return 'Yesterday';
  if (days <= 1) return at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (days < 7) return at.toLocaleDateString([], { weekday: 'short' });
  const sameYear = at.getFullYear() === now.getFullYear();
  return at.toLocaleDateString([], { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** The sidebar's "2 min ago", "1 h ago", "Yesterday". */
export function ago(at: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const days = daysBetween(at, now);
  if (days === 0) return `${Math.floor(minutes / 60)} h ago`;
  if (days === 1) return 'Yesterday';
  return rowTime(at, now);
}

/** What History's search looks at. */
export function matches(item: HistoryItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [item.title, item.preview, item.filename ?? ''].some((text) => text.toLowerCase().includes(q));
}