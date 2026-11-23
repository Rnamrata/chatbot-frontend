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

/**
 * POST /upload/file, /upload/youtube and /upload/web. Failures come back as HTTP 400 with `error`.
 * A source already in the library comes back with `reused: true` and nothing stored again.
 */
export interface UploadResponse {
  success: boolean;
  chunks_created?: number;
  reused?: boolean;
  source?: LibrarySource | null;
  error?: string;
}

export type AddKind = 'file' | 'youtube' | 'web';

/** Flask's MAX_UPLOAD_MB default. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const FILE_TYPES = ['.pdf', '.txt', '.md'];