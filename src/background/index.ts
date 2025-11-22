import { getYouTubeTranscriptWithChapters } from '../utils/youtube';
import { generateSummary } from '../utils/openai';
import { isTranscriptError } from '../utils/errors';

console.log('Briefly background service worker loaded');

// Types for messages
interface StartSummaryMessage {
  type: 'START_SUMMARY';
  videoId: string;
  videoTitle: string;
  tabId: number;
  openaiApiKey: string;
  comfortableLanguages?: string[];
}

interface SummaryProgressMessage {
  type: 'SUMMARY_PROGRESS';
  videoId: string;
  stage: 'extracting_transcript' | 'generating_summary';
  message: string;
}

interface SummaryDoneMessage {
  type: 'SUMMARY_DONE';
  videoId: string;
  summary: string;
  videoTitle: string;
}

interface SummaryErrorMessage {
  type: 'SUMMARY_ERROR';
  videoId: string;
  error: string;
  code?: string;
}

interface ClearBadgeMessage {
  type: 'CLEAR_BADGE';
  tabId: number;
}

type BackgroundMessage = StartSummaryMessage | SummaryProgressMessage | SummaryDoneMessage | SummaryErrorMessage | ClearBadgeMessage;

// Track active summary generation to avoid duplicates
const activeSummaries = new Set<string>();

/**
 * Update the action badge for a specific tab based on stored summary state.
 * Shows a green checkmark when a summary exists for the tab's video and has
 * not been marked as viewed by the user; otherwise clears the badge.
 */
async function updateBadgeForTab(tabId: number): Promise<void> {
  try {
    const tab = await chrome.tabs.get(tabId);
    const url = tab.url || '';

    let videoId: string | null = null;
    if (url.includes('youtube.com/watch')) {
      try {
        const parsed = new URL(url);
        videoId = parsed.searchParams.get('v');
      } catch (error) {
        console.error('[Background] Failed to parse URL for badge update:', error);
      }
    }

    if (!videoId) {
      chrome.action.setBadgeText({ text: '', tabId });
      chrome.action.setTitle({ title: 'Briefly', tabId });
      return;
    }

    const key = `summary-${videoId}`;
    const result = await chrome.storage.local.get([key]);
    const storedSummary = result[key];

    // If there is a summary and it hasn't been viewed yet, show the badge
    if (storedSummary && storedSummary.viewedByUser !== true) {
      chrome.action.setBadgeText({ text: '✓', tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#10B981', tabId });
      chrome.action.setTitle({ title: 'Briefly - Summary ready!', tabId });
    } else {
      chrome.action.setBadgeText({ text: '', tabId });
      chrome.action.setTitle({ title: 'Briefly', tabId });
    }
  } catch (error) {
    console.error('[Background] Failed to update badge for tab:', tabId, error);
    chrome.action.setBadgeText({ text: '', tabId });
    chrome.action.setTitle({ title: 'Briefly', tabId });
  }
}

/**
 * Send a message to all extension contexts (popup, etc.)
 */
function broadcastMessage(message: BackgroundMessage): void {
  chrome.runtime.sendMessage(message).catch((error) => {
    // Popup might be closed, which is fine
    console.log('[Background] No listener for message:', error.message);
  });
}

/**
 * Orchestrate transcript extraction and summary generation
 */
async function generateSummaryInBackground(
  videoId: string,
  videoTitle: string,
  tabId: number,
  openaiApiKey: string,
  comfortableLanguages?: string[]
): Promise<void> {
  // Prevent duplicate processing
  if (activeSummaries.has(videoId)) {
    console.log('[Background] Summary already in progress for:', videoId);
    return;
  }

  activeSummaries.add(videoId);

  try {
    // Set badge to show work in progress (tab-specific)
    chrome.action.setBadgeText({ text: '⋯', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#4F46E5', tabId }); // Indigo
    chrome.action.setTitle({ title: 'Briefly - Generating summary...', tabId });

    // Update storage to show in-progress state
    await chrome.storage.local.set({
      summaryInProgress: {
        videoId,
        videoTitle,
        stage: 'extracting_transcript',
        timestamp: Date.now(),
      },
    });

    // Stage 1: Extract transcript
    console.log('[Background] Extracting transcript for:', videoId);
    broadcastMessage({
      type: 'SUMMARY_PROGRESS',
      videoId,
      stage: 'extracting_transcript',
      message: 'Extracting transcript...',
    });

    const { transcript, chapters } = await getYouTubeTranscriptWithChapters(videoId);

    if (!transcript || transcript.length === 0) {
      throw new Error('Could not extract transcript from this video');
    }

    // Stage 2: Generate summary
    console.log('[Background] Generating summary for:', videoId);
    broadcastMessage({
      type: 'SUMMARY_PROGRESS',
      videoId,
      stage: 'generating_summary',
      message: 'Generating summary with AI...',
    });

    const summaryContent = await generateSummary(transcript, openaiApiKey, {
      comfortableLanguages,
      videoTitle,
      chapters,
    });

    // Success! Store and broadcast
    const summary = {
      videoId,
      videoTitle,
      content: summaryContent,
      timestamp: Date.now(),
    };

    // Store summary with videoId-specific key to support multiple summaries
    await chrome.storage.local.set({
      [`summary-${videoId}`]: summary,
      summary, // Also keep as latest summary for backwards compat
      summaryInProgress: null,
    });
    console.log('[Background] Summary generation complete for:', videoId);

    // Set / refresh badge for this tab based on stored summary
    await updateBadgeForTab(tabId);

    // Check if notifications are enabled
    const settings = await chrome.storage.local.get(['enableNotifications']);
    const enableNotifications = settings.enableNotifications !== false; // Default to true

    if (enableNotifications) {
      // Show system notification with tabId embedded in notification ID
      chrome.notifications.create(`summary-done-${tabId}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Summary Ready!',
        message: `Summary for "${videoTitle}" is complete. Click to view.`,
        priority: 2,
      });
    }

    broadcastMessage({
      type: 'SUMMARY_DONE',
      videoId,
      summary: summaryContent,
      videoTitle,
    });

  } catch (error) {
    console.error('[Background] Error generating summary:', error);

    // Clear in-progress state
    await chrome.storage.local.set({ summaryInProgress: null });

    // Set badge to error (tab-specific)
    chrome.action.setBadgeText({ text: '✗', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#EF4444', tabId }); // Red
    chrome.action.setTitle({ title: 'Briefly - Error generating summary', tabId });

    // Clear badge after 10 seconds (tab-specific)
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '', tabId });
      chrome.action.setTitle({ title: 'Briefly', tabId });
    }, 10000);

    // Extract error details
    let errorMessage = 'An error occurred while generating the summary';
    let errorCode: string | undefined;

    if (isTranscriptError(error)) {
      errorMessage = error.message;
      errorCode = error.code;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    // Check if notifications are enabled
    const settings = await chrome.storage.local.get(['enableNotifications']);
    const enableNotifications = settings.enableNotifications !== false; // Default to true

    if (enableNotifications) {
      // Show error notification with tabId embedded in notification ID
      chrome.notifications.create(`summary-error-${tabId}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Summary Failed',
        message: errorMessage,
        priority: 2,
      });
    }

    broadcastMessage({
      type: 'SUMMARY_ERROR',
      videoId,
      error: errorMessage,
      code: errorCode,
    });

  } finally {
    activeSummaries.delete(videoId);
  }
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[Background] Received message:', message.type);

  if (message.type === 'START_SUMMARY') {
    const { videoId, videoTitle, tabId, openaiApiKey, comfortableLanguages } = message as StartSummaryMessage;

    // Start generation asynchronously
    generateSummaryInBackground(videoId, videoTitle, tabId, openaiApiKey, comfortableLanguages);

    // Respond immediately to acknowledge
    sendResponse({ success: true });
    return false; // Synchronous response
  }

  if (message.type === 'CLEAR_BADGE') {
    const { tabId } = message as ClearBadgeMessage;
    console.log('[Background] Clearing badge for tab:', tabId);

    // Re-evaluate badge state for this tab based on stored summary
    void updateBadgeForTab(tabId);

    sendResponse({ success: true });
    return false; // Synchronous response
  }

  // Unknown message type
  sendResponse({ success: false, error: 'Unknown message type' });
  return false;
});

// Handle notification clicks
chrome.notifications.onClicked.addListener(async (notificationId) => {
  console.log('[Background] Notification clicked:', notificationId);

  // Clear the notification
  chrome.notifications.clear(notificationId);

  // Extract tabId from notification ID (format: "summary-done-{tabId}" or "summary-error-{tabId}")
  const match = notificationId.match(/^summary-(?:done|error)-(\d+)$/);
  if (!match) {
    console.log('[Background] Could not extract tabId from notification ID');
    return;
  }

  const tabId = parseInt(match[1], 10);
  console.log('[Background] Extracted tabId:', tabId);

  try {
    // Get the specific tab
    const tab = await chrome.tabs.get(tabId);

    if (tab.windowId) {
      // Focus the window
      await chrome.windows.update(tab.windowId, { focused: true });
      // Focus the tab
      await chrome.tabs.update(tabId, { active: true });
      console.log('[Background] Focused specific YouTube tab:', tabId);
    }
  } catch (error) {
    console.error('[Background] Error focusing tab:', error);
    console.log('[Background] Tab may have been closed');
  }
});

// Optional: Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Briefly extension installed');
  } else if (details.reason === 'update') {
    console.log('Briefly extension updated');
  }
});

// Keep badge state in sync when the active tab changes or a tab finishes loading
chrome.tabs.onActivated.addListener(({ tabId }) => {
  void updateBadgeForTab(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    void updateBadgeForTab(tabId);
  }
});
