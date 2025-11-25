import {
  openTranscriptPanel,
  closeTranscriptPanel,
  extractTranscriptSegments,
  extractVideoChapters,
} from '@briefly/shared/transcriptDom';
import { parseError } from '@briefly/shared/errors';

console.log('Briefly content script loaded');

// Listen for messages from the background worker / popup.
// This script is responsible for:
// - Controlling the YouTube video element (seek/play/scroll)
// - Driving the DOM-based transcript panel via `transcriptDom.ts`
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[Content] Received message:', message.type);

  if (message.type === 'GET_VIDEO_URL') {
    const currentUrl = window.location.href;
    console.log('[Content] Returning current URL:', currentUrl);
    sendResponse({ success: true, url: currentUrl });
    return false; // Synchronous response
  }

  if (message.type === 'SEEK_VIDEO' && message.time !== undefined) {
    console.log('[Content] Received SEEK_VIDEO message with time:', message.time);

    try {
      const videoElement = document.querySelector('video');
      console.log('[Content] Video element found:', !!videoElement);

      if (!videoElement) {
        console.error('[Content] Video element not found');
        sendResponse({ success: false, error: 'Video element not found' });
        return false;
      }

      // Seek to the specified time
      videoElement.currentTime = message.time;

      // Play the video if it's paused
      if (videoElement.paused) {
        console.log('[Content] Video was paused, playing now');
        videoElement.play()
          .then(() => console.log('[Content] Video playback started'))
          .catch((error) => console.error('[Content] Error playing video:', error));
      }

      // Scroll to the video element
      videoElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });

      console.log('[Content] Seek operation completed successfully');
      sendResponse({ success: true });
    } catch (error) {
      console.error('[Content] Error seeking video:', error);
      sendResponse({ success: false, error: String(error) });
    }

    return false; // Synchronous response
  }

  // NOTE: There used to be a `FETCH_TRANSCRIPT` handler that called YouTube's
  // timedtext / Innertube HTTP endpoints. The current implementation uses the
  // DOM transcript panel exclusively via `GET_TRANSCRIPT_DATA` and
  // `transcriptDom.ts`. If you consider reintroducing HTTP-based fetching,
  // treat it as experimental and keep DOM as the primary path.

  if (message.type === 'GET_TRANSCRIPT_DATA') {
    console.log('[Content] GET_TRANSCRIPT_DATA handler triggered for video:', message.videoId);

    // Use centralized transcript DOM module for all transcript operations
    (async () => {
      try {
        // Step 1: Open the transcript panel (if not already open)
        const openMethod = await openTranscriptPanel();

        // Step 2: Extract transcript segments from the DOM
        const transcript = extractTranscriptSegments();

        // Step 2b: Extract chapters (if available). This is best-effort and
        // should not fail the whole operation if chapters cannot be found.
        const chapters = await extractVideoChapters();

        // Step 3: Close the panel if we opened it
        closeTranscriptPanel(openMethod);

        // Step 4: Send success response
        console.log('[Content] Successfully extracted', transcript.length, 'entries and', chapters.length, 'chapters');
        sendResponse({ success: true, data: transcript, chapters });

      } catch (error) {
        console.error('[Content] Error extracting transcript:', error);

        // Parse error to extract structured error code and message
        const { code, message } = parseError(error);

        sendResponse({
          success: false,
          code: code,
          error: message,
        });
      }
    })();

    return true; // Keep channel open for async response
  }

  console.log('[Content] Unknown message type:', message.type);
  return false; // Don't keep channel open for unknown messages
});
