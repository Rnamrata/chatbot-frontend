/** As the review service sends it; 'critical' and 'info' are rare. */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** The three colours the design uses: critical and high share one, low and info share one. */
export type Tone = 'high' | 'medium' | 'low';

export interface Finding {
  file: string;
  line: number;
  severity: Severity | string;
  message: string;
  category?: string;
  /** Which check found it: 'ruff', 'eslint', 'pmd', 'secrets' or 'llm'. */
  source?: string;
  suggestion?: string;
  /** Why this kind of problem matters, matched by the review service; not every finding has one. */
  why?: Why;
}

/** A finding's "why" card: the reason, a fix and a page to read more. */
export interface Why {
  id: string;
  title: string;
  reason: string;
  fix: string;
  /** The page's name, e.g. "OWASP SQL Injection Prevention". */
  source: string;
  url: string;
}

/** A part of the review that had a problem while the rest ran, e.g. the AI reviewer timed out. */
export interface ReviewWarning {
  source: string | null;
  message: string;
}

/** POST /review and GET /review/:id. */
export interface Review {
  review_id: string;
  session_id: string | null;
  filename: string;
  /** 'python' | 'js' | 'ts' | 'java' (llm-chatbot's names). */
  language: string | null;
  code: string;
  findings: Finding[];
  warnings: ReviewWarning[];
  summary: string;
  /** Only when the review service could not be reached at all: nothing was checked. */
  warning?: string;
}

export interface ReviewResponse extends Review {
  success: boolean;
}

/** Why a review could not start; shown as a banner on the start screen. */
export interface StartError {
  kind: 'too-large' | 'rate-limited' | 'unsupported' | 'empty' | 'refused' | 'unreachable' | 'failed';
  title: string;
  body: string;
  /** When another review may start (epoch ms), for 'rate-limited'. */
  retryAt?: number;
}

/** A review started in this tab. The request keeps running after "Stop waiting". */
export interface ReviewJob {
  id: string;
  filename: string;
  language: string | null;
  code: string;
  startedAt: number;
  status: 'running' | 'done' | 'failed';
  /** The person stopped waiting; the result is kept if it arrives. */
  stopped: boolean;
  /** When they stopped, so the clock stops too (epoch ms). */
  stoppedAt?: number;
  review?: Review;
  error?: StartError;
}

/** What the review service accepts (its ALLOWED_EXTENSIONS) and its 1 MB limit. */
export const CODE_EXTENSIONS = ['.py', '.js', '.jsx', '.ts', '.tsx', '.java'];
export const MAX_CODE_BYTES = 1024 * 1024;

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  '.py': 'python',
  '.js': 'js',
  '.jsx': 'js',
  '.ts': 'ts',
  '.tsx': 'ts',
  '.java': 'java',
};

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
}

export function languageOf(filename: string): string | null {
  return LANGUAGE_BY_EXTENSION[extensionOf(filename)] ?? null;
}

export function languageLabel(language: string | null): string {
  switch (language) {
    case 'python':
      return 'Python';
    case 'js':
      return 'JavaScript';
    case 'ts':
      return 'TypeScript';
    case 'java':
      return 'Java';
    default:
      return 'Code';
  }
}

/** Which checks run for a language, as the review service is set up. */
export function analyzersFor(language: string | null): { linter: string | null; source: string | null } {
  switch (language) {
    case 'python':
      return { linter: 'Ruff', source: 'ruff' };
    case 'java':
      return { linter: 'PMD', source: 'pmd' };
    case 'js':
    case 'ts':
      return { linter: 'ESLint', source: 'eslint' };
    default:
      return { linter: null, source: null };
  }
}

export function toneOf(severity: string): Tone {
  if (severity === 'critical' || severity === 'high') return 'high';
  if (severity === 'medium') return 'medium';
  return 'low';
}

const SOURCE_LABELS: Record<string, string> = {
  llm: 'AI reviewer',
  ruff: 'Ruff',
  pmd: 'PMD',
  eslint: 'ESLint',
  secrets: 'Secret scan',
  orchestrator: 'Review service',
};

export function sourceLabel(source: string | null | undefined): string {
  return (source && SOURCE_LABELS[source]) || 'A check';
}