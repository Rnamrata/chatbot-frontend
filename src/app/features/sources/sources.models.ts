export type SourceType = 'file_upload' | 'youtube' | 'web' | 'unknown';

/** ready: searchable · processing: being added · outdated: old data stored without details */
export type SourceStatus = 'ready' | 'processing' | 'outdated';

/** One item of GET /sources. */
export interface LibrarySource {
  id: string;
  name: string;
  type: SourceType;
  /** File name or URL; null for the "older data" item. */
  source: string | null;
  chunks: number;
  status: SourceStatus;
  added_at: string | null;
}

export interface SourcesResponse {
  success: boolean;
  sources: LibrarySource[];
  total: number;
}

/** POST /upload/file, /upload/youtube and /upload/web. Failures come back as HTTP 400 with `error`. */
export interface UploadResponse {
  success: boolean;
  chunks_created?: number;
  source?: LibrarySource | null;
  error?: string;
}

export type AddKind = 'file' | 'youtube' | 'web';

/** What each add card is doing: nothing, uploading, or showing why the last try failed. */
export type Job = { status: 'busy' } | { status: 'error'; message: string } | null;

/** Flask's MAX_UPLOAD_MB default. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const FILE_TYPES = ['.pdf', '.txt', '.md'];