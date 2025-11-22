/**
 * errors.ts
 *
 * Centralized error types for transcript extraction and summarization.
 * These error codes help distinguish different failure modes and map them
 * to appropriate user-facing messages.
 */

/**
 * Error codes for transcript extraction and summarization failures
 *
 * - NO_TRANSCRIPT: Video doesn't have a transcript available
 * - UI_NOT_FOUND: Transcript button/interface not found in YouTube DOM
 * - MENU_ITEM_NOT_FOUND: Transcript option not found in More Actions menu
 * - SEGMENTS_NOT_FOUND: Transcript panel opened but no segments found
 * - PAGE_NOT_READY: YouTube page not fully loaded
 * - OPENAI_ERROR: Error during OpenAI API call
 * - UNKNOWN: Unexpected/unclassified error
 */
export type TranscriptErrorCode =
  | 'NO_TRANSCRIPT'
  | 'UI_NOT_FOUND'
  | 'MENU_ITEM_NOT_FOUND'
  | 'SEGMENTS_NOT_FOUND'
  | 'PAGE_NOT_READY'
  | 'OPENAI_ERROR'
  | 'UNKNOWN';

/**
 * Structured error payload for transcript operations
 */
export interface TranscriptErrorPayload {
  code: TranscriptErrorCode;
  message: string;
}

/**
 * Custom error class for transcript-related failures
 */
export class TranscriptError extends Error {
  code: TranscriptErrorCode;

  constructor(code: TranscriptErrorCode, message: string) {
    super(message);
    this.name = 'TranscriptError';
    this.code = code;
  }
}

/**
 * Helper to create a TranscriptError
 */
export function createTranscriptError(
  code: TranscriptErrorCode,
  message: string
): TranscriptError {
  return new TranscriptError(code, message);
}

/**
 * Check if an error is a TranscriptError
 */
export function isTranscriptError(error: unknown): error is TranscriptError {
  return error instanceof TranscriptError;
}

/**
 * Extract error code and message from any error type
 */
export function parseError(error: unknown): TranscriptErrorPayload {
  if (isTranscriptError(error)) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      code: 'UNKNOWN',
      message: error.message,
    };
  }

  return {
    code: 'UNKNOWN',
    message: String(error),
  };
}
