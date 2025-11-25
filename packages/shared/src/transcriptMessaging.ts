import { createTranscriptError, type TranscriptErrorCode } from './errors';
import type { TranscriptEntry, VideoChapter, TranscriptWithChapters } from './types';

// Re-export types for convenience
export type { TranscriptEntry, VideoChapter, TranscriptWithChapters };

/**
 * Extracts a YouTube transcript for the active tab.
 *
 * This is a thin wrapper around the DOM-based transcript panel:
 * - Sends `GET_TRANSCRIPT_DATA` to the content script.
 * - Content script opens the transcript panel and scrapes segments from the DOM.
 * - Errors are returned as structured `TranscriptError` instances where possible.
 */
export async function getYouTubeTranscript(videoId: string): Promise<TranscriptEntry[]> {
  const { transcript } = await getYouTubeTranscriptWithChapters(videoId);
  return transcript;
}

/**
 * Extracts a YouTube transcript and any available chapters for the active tab.
 *
 * Returns both transcript entries and a best-effort list of chapters.
 */
export async function getYouTubeTranscriptWithChapters(
  videoId: string
): Promise<TranscriptWithChapters> {
  console.log('[YouTube] getYouTubeTranscriptWithChapters called with videoId:', videoId);

  try {
    // DOM-based transcript and chapter extraction via content script
    const result = await fetchTranscriptAndChapters(videoId);
    console.log(
      '[YouTube] DOM transcript fetch returned:',
      result?.transcript?.length,
      'entries and',
      result?.chapters?.length,
      'chapters'
    );

    if (result.transcript && result.transcript.length > 0) {
      return result;
    }

    throw new Error('No transcript available for this video');
  } catch (error) {
    console.error('[YouTube] Error fetching transcript and chapters:', error);
    throw error;
  }
}

/**
 * Requests transcript data from the content script.
 *
 * The content script uses `src/content/transcriptDom.ts` to:
 * - Open YouTube's transcript panel.
 * - Scrape `ytd-transcript-segment-renderer` elements from the DOM.
 * - Parse timestamps into `TranscriptEntry` objects.
 *
 * Any DOM / timing failures are wrapped into `TranscriptError` with a specific
 * `TranscriptErrorCode` (e.g. `UI_NOT_FOUND`, `MENU_ITEM_NOT_FOUND`,
 * `SEGMENTS_NOT_FOUND`, `PAGE_NOT_READY`).
 */
async function fetchTranscriptAndChapters(videoId: string): Promise<TranscriptWithChapters> {
  try {
    console.log('[Transcript] Starting DOM-based transcript and chapter fetch for video:', videoId);

    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id) {
      throw new Error('No active tab found');
    }

    console.log('[Transcript] Sending GET_TRANSCRIPT_DATA message to content script');

    // Ask content script to open the transcript panel and extract segments + chapters
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tab.id!,
        { type: 'GET_TRANSCRIPT_DATA', videoId },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('[Transcript] Chrome runtime error:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!response) {
            reject(new Error('No response from content script'));
            return;
          }

          if (response.success) {
            console.log(
              '[Transcript] Received transcript data, entries:',
              response.data?.length,
              'chapters:',
              response.chapters?.length ?? 0
            );

            const transcript: TranscriptEntry[] = Array.isArray(response.data)
              ? response.data
              : [];

            const chapters: VideoChapter[] = Array.isArray(response.chapters)
              ? response.chapters
              : [];

            resolve({ transcript, chapters });
          } else {
            // Preserve error code from content script if available
            const errorCode = (response.code as TranscriptErrorCode) || 'UNKNOWN';
            const errorMessage = response.error || 'Failed to get transcript from content script';
            reject(createTranscriptError(errorCode, errorMessage));
          }
        }
      );
    });
  } catch (error) {
    console.error('[Transcript] Error fetching transcript:', error);
    if (error instanceof Error) {
      console.error('[Transcript] Error message:', error.message);
      console.error('[Transcript] Error stack:', error.stack);
    }
    throw error;
  }
}

/**
 * Formats transcript entries into a readable text format
 */
export function formatTranscript(transcript: TranscriptEntry[]): string {
  return transcript
    .map((entry) => {
      const timestamp = formatTimestamp(entry.start);
      return `[${timestamp}] ${entry.text}`;
    })
    .join('\n');
}

/**
 * Formats seconds into MM:SS or HH:MM:SS
 */
export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
