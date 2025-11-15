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

    // Strategy: Click the transcript button programmatically and extract from DOM
    const extractTranscriptFromDOM = () => {
      return new Promise((resolve, reject) => {
        console.log('[Content] Looking for transcript button...');

        // If transcript is already visible, read it without changing UI state
        const transcriptAlreadyVisible = document.querySelector('ytd-transcript-segment-renderer') !== null;
        let openedTranscript = false;
        let openerElement: HTMLElement | null = null;
        let openerIsMenuItem = false;

        if (transcriptAlreadyVisible) {
          console.log('[Content] Transcript already visible, extracting without toggling panel');

          // Give the DOM a moment in case YouTube is still rendering items
          setTimeout(() => extractTranscriptSegments(resolve, reject, false, false, null), 0);
          return;
        }

        // Find the "Show transcript" button
        const transcriptButton = document.querySelector('button[aria-label*="transcript" i], button[aria-label*="Show transcript" i]');

        if (!transcriptButton) {
          console.log('[Content] Transcript button not found, searching for it in menu...');

          // Try to find it in the more menu
          const moreButton = document.querySelector('button[aria-label="More actions"]');
          if (moreButton) {
            (moreButton as HTMLElement).click();

            setTimeout(() => {
              const transcriptMenuItem = document.querySelector('ytd-menu-service-item-renderer:has(yt-formatted-string:contains("transcript")) tp-yt-paper-item, [role="menuitem"]:has(*:contains("transcript"))');

              if (transcriptMenuItem) {
                console.log('[Content] Found transcript in menu, clicking...');
                (transcriptMenuItem as HTMLElement).click();

                openedTranscript = true;
                openerElement = transcriptMenuItem as HTMLElement;
                openerIsMenuItem = true;

                // Wait for transcript panel to load
                setTimeout(
                  () => extractTranscriptSegments(resolve, reject, openedTranscript, openerIsMenuItem, openerElement),
                  1000,
                );
              } else {
                reject(new Error('Could not find transcript option in menu'));
              }
            }, 500);
          } else {
            reject(new Error('Transcript button not found'));
          }
        } else {
          console.log('[Content] Found transcript button, clicking...');
          (transcriptButton as HTMLElement).click();

          openedTranscript = true;
          openerElement = transcriptButton as HTMLElement;

          // Wait for transcript panel to load
          setTimeout(
            () => extractTranscriptSegments(resolve, reject, openedTranscript, openerIsMenuItem, openerElement),
            1000,
          );
        }
      });
    };

    const extractTranscriptSegments = (
      resolve: (value: any) => void,
      reject: (reason: any) => void,
      shouldCloseAfter: boolean,
      openerIsMenuItem: boolean,
      openerElement: HTMLElement | null,
    ) => {
      console.log('[Content] Extracting transcript segments from DOM...');

      // Find transcript segments in the panel
      const segments = document.querySelectorAll('ytd-transcript-segment-renderer');

      if (segments.length === 0) {
        reject(new Error('No transcript segments found in DOM'));
        return;
      }

      console.log('[Content] Found', segments.length, 'transcript segments');

      const transcript = Array.from(segments).map(segment => {
        const timeElement = segment.querySelector('[class*="time"]');
        const textElement = segment.querySelector('[class*="segment-text"]');

        const timeText = timeElement?.textContent?.trim() || '0:00';
        const text = textElement?.textContent?.trim() || '';

        // Parse time string (format: "MM:SS" or "H:MM:SS")
        const timeParts = timeText.split(':').map(Number);
        let seconds = 0;
        if (timeParts.length === 2) {
          seconds = timeParts[0] * 60 + timeParts[1];
        } else if (timeParts.length === 3) {
          seconds = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
        }

        return {
          text,
          start: seconds,
          duration: 0, // We don't have duration from DOM, but it's not critical
        };
      });

      if (shouldCloseAfter) {
        try {
          // Prefer the explicit close button in the transcript header if available
          const transcriptHeader = document.querySelector('ytd-transcript-header-renderer');
          let closeButton: HTMLElement | null = null;

          if (transcriptHeader) {
            closeButton = transcriptHeader.querySelector(
              'button[aria-label*="close" i], tp-yt-paper-icon-button[aria-label*="close" i], yt-icon-button[aria-label*="close" i]',
            ) as HTMLElement | null;
          }

          if (!closeButton) {
            closeButton = document.querySelector(
              'button[aria-label*="close transcript" i], tp-yt-paper-icon-button[aria-label*="close transcript" i]',
            ) as HTMLElement | null;
          }

          const firstSegment = segments[0] as Element | undefined;
          const transcriptContainer = firstSegment
            ? (firstSegment.closest(
                'ytd-transcript-renderer, ytd-engagement-panel-section-list-renderer, ytd-transcript-segment-list-renderer',
              ) as HTMLElement | null)
            : null;

          if (closeButton) {
            console.log('[Content] Closing transcript panel via header close button');
            closeButton.click();
          } else if (!openerIsMenuItem && openerElement) {
            console.log('[Content] Closing transcript panel via opener element');
            openerElement.click();
          } else if (transcriptContainer) {
            console.log('[Content] Hiding transcript container element');
            transcriptContainer.style.display = 'none';
          } else {
            console.log('[Content] No close control found for transcript panel');
          }
        } catch (closeError) {
          console.warn('[Content] Failed to close transcript panel:', closeError);
        }
      }

      console.log('[Content] Successfully extracted', transcript.length, 'entries');
      resolve(transcript);
    };

    extractTranscriptFromDOM()
      .then((transcript: any) => {
        sendResponse({ success: true, data: transcript });
      })
      .catch(error => {
        console.error('[Content] Error extracting transcript:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keep channel open for async response
  }

  console.log('[Content] Unknown message type:', message.type);
  return false; // Don't keep channel open for unknown messages
});
