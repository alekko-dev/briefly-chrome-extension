/**
 * Shared TypeScript types for YouTube transcript extraction
 */

/**
 * Represents a single transcript entry with timestamp and text
 */
export interface TranscriptEntry {
  text: string;
  start: number;      // Start time in seconds
  duration: number;   // Duration in seconds (may be 0 if not available)
}

/**
 * Represents a video chapter with title and timestamp
 */
export interface VideoChapter {
  title: string;
  start: number; // Start time in seconds
}

/**
 * Combined transcript and chapters result
 */
export interface TranscriptWithChapters {
  transcript: TranscriptEntry[];
  chapters: VideoChapter[];
}

/**
 * Entry points for accessing the transcript UI
 */
export interface TranscriptEntryPoints {
  transcriptButton: HTMLElement | null;  // Direct transcript button (preferred)
  moreActionsButton: HTMLElement | null; // "More actions" menu button (fallback)
}
