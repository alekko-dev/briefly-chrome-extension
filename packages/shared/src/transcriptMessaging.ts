export interface TranscriptEntry {
  text: string;
  start: number;
  duration: number;
}

/**
 * Extracts YouTube transcript using multiple methods
 * This implementation uses the YouTube timedtext API which is more reliable
 * than the official API for transcript extraction
 */
export async function getYouTubeTranscript(videoId: string): Promise<TranscriptEntry[]> {
  console.log('[YouTube] getYouTubeTranscript called with videoId:', videoId);

  try {
    // Method 1: Try to get transcript from YouTube's timedtext API
    const transcript = await fetchTimedTextTranscript(videoId);
    console.log('[YouTube] fetchTimedTextTranscript returned:', transcript?.length, 'entries');

    if (transcript && transcript.length > 0) {
      return transcript;
    }

    throw new Error('No transcript available for this video');
  } catch (error) {
    console.error('[YouTube] Error fetching transcript:', error);
    throw error;
  }
}

/**
 * Fetches transcript using YouTube's Innertube API via content script
 * This sends a message to content script to use YouTube's internal API
 */
async function fetchTimedTextTranscript(videoId: string): Promise<TranscriptEntry[]> {
  try {
    console.log('[Transcript] Starting fetch using Innertube API for video:', videoId);

    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id) {
      throw new Error('No active tab found');
    }

    console.log('[Transcript] Sending GET_TRANSCRIPT_DATA message to content script');

    // Send message to content script to fetch transcript using Innertube API
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
            console.log('[Transcript] Received transcript data, entries:', response.data?.length);
            resolve(response.data);
          } else {
            reject(new Error(response.error || 'Failed to get transcript from content script'));
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
