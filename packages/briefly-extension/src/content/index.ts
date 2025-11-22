import {
  openTranscriptPanel,
  closeTranscriptPanel,
  extractTranscriptSegments,
} from './transcriptDom';

console.log('Briefly content script loaded');

// Listen for messages from the popup
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

  if (message.type === 'FETCH_TRANSCRIPT') {
    console.log('[Content] FETCH_TRANSCRIPT handler triggered');
    console.log('[Content] Fetching transcript from:', message.url);

    // Fetch transcript from content script context with proper headers
    fetch(message.url, {
      method: 'GET',
      credentials: 'include', // Include cookies
      headers: {
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': window.location.href,
        'X-YouTube-Client-Name': '1',
        'X-YouTube-Client-Version': '2.0',
      },
    })
      .then(response => {
        console.log('[Content] Transcript fetch status:', response.status);
        console.log('[Content] Response content-type:', response.headers.get('content-type'));
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.text();
      })
      .then(transcriptXml => {
        console.log('[Content] Transcript XML length:', transcriptXml.length);
        if (transcriptXml.length > 0) {
          console.log('[Content] Transcript XML preview:', transcriptXml.substring(0, 500));
        } else {
          console.log('[Content] WARNING: Empty transcript response');
        }
        sendResponse({ success: true, data: transcriptXml });
      })
      .catch(error => {
        console.error('[Content] Error fetching transcript:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // MUST return true for async response
  }

  if (message.type === 'GET_TRANSCRIPT_DATA') {
    console.log('[Content] GET_TRANSCRIPT_DATA handler triggered for video:', message.videoId);

    // Use centralized transcript DOM module for all transcript operations
    (async () => {
      try {
        // Step 1: Open the transcript panel (if not already open)
        const openMethod = await openTranscriptPanel();

        // Step 2: Extract transcript segments from the DOM
        const transcript = extractTranscriptSegments();

        // Step 3: Close the panel if we opened it
        closeTranscriptPanel(openMethod);

        // Step 4: Send success response
        console.log('[Content] Successfully extracted', transcript.length, 'entries');
        sendResponse({ success: true, data: transcript });

      } catch (error) {
        console.error('[Content] Error extracting transcript:', error);

        // Parse error message to extract error code if present
        const errorMessage = error instanceof Error ? error.message : String(error);
        const code = errorMessage.split(':')[0]; // Extract code like "UI_NOT_FOUND" or "SEGMENTS_NOT_FOUND"

        sendResponse({
          success: false,
          code: code,
          error: errorMessage,
        });
      }
    })();

    return true; // Keep channel open for async response
  }

  console.log('[Content] Unknown message type:', message.type);
  return false; // Don't keep channel open for unknown messages
});
