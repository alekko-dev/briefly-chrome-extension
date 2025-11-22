/**
 * transcriptDom.ts
 *
 * Centralized module for all YouTube transcript DOM interactions.
 * This isolates DOM selectors and timing logic for easier maintenance when YouTube changes.
 *
 * Key responsibilities:
 * - Finding transcript UI entry points (buttons, menu items)
 * - Opening the transcript panel programmatically
 * - Extracting transcript segments from the DOM
 * - Closing the transcript panel when needed
 */

import { createTranscriptError } from '../utils/errors';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Represents a single transcript entry with timestamp and text
 */
export interface TranscriptEntry {
  text: string;
  start: number;      // Start time in seconds
  duration: number;   // Duration in seconds (may be 0 if not available)
}

/**
 * Entry points for accessing the transcript UI
 */
export interface TranscriptEntryPoints {
  transcriptButton: HTMLElement | null;  // Direct transcript button (preferred)
  moreActionsButton: HTMLElement | null; // "More actions" menu button (fallback)
}

// ============================================================================
// Constants
// ============================================================================

/**
 * ID of the transcript engagement panel in YouTube's DOM
 */
const TRANSCRIPT_PANEL_ID = 'engagement-panel-searchable-transcript';

/**
 * Selector for the transcript panel container
 */
const TRANSCRIPT_PANEL_SELECTOR = `ytd-engagement-panel-section-list-renderer[target-id="${TRANSCRIPT_PANEL_ID}"]`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the transcript panel element if it exists in the DOM
 */
function getTranscriptPanel(): HTMLElement | null {
  return document.querySelector<HTMLElement>(TRANSCRIPT_PANEL_SELECTOR);
}

/**
 * Check if an element references the transcript panel via its attributes
 */
function referencesTranscriptPanel(element: Element | null): boolean {
  if (!element) {
    return false;
  }

  const attributesToInspect = [
    'target-id',
    'data-target-id',
    'aria-controls',
    'href',
    'data-params',
    'js-panel-id',
  ];

  return attributesToInspect.some(attributeName => {
    const value = element.getAttribute(attributeName);
    return typeof value === 'string' && value.includes(TRANSCRIPT_PANEL_ID);
  });
}

/**
 * Find the closest clickable ancestor element (button or menu item)
 */
function findClickableAncestor(element: Element | null): HTMLElement | null {
  if (!element) {
    return null;
  }

  if (element instanceof HTMLElement && element.matches('button, tp-yt-paper-item, ytd-menu-service-item-renderer, ytd-button-renderer, yt-button-shape')) {
    return element;
  }

  return (element.closest(
    'button, tp-yt-paper-item, ytd-menu-service-item-renderer, ytd-button-renderer, yt-button-shape',
  ) as HTMLElement | null);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Find all possible entry points into the transcript UI
 *
 * Searches for:
 * 1. Direct transcript button (preferred method)
 * 2. "More actions" menu button (fallback when transcript button is in menu)
 *
 * @returns Object containing found entry points (may be null if not found)
 */
export function findTranscriptEntryPoints(): TranscriptEntryPoints {
  console.log('[TranscriptDOM] Finding transcript entry points...');

  // Try to find direct transcript button using structural selectors
  const structuralSelectors = [
    `[aria-controls="${TRANSCRIPT_PANEL_ID}"]`,
    `[target-id="${TRANSCRIPT_PANEL_ID}"]`,
    `[data-target-id="${TRANSCRIPT_PANEL_ID}"]`,
    `[href*="${TRANSCRIPT_PANEL_ID}"]`,
    'ytd-video-description-transcript-section-renderer ytd-button-renderer button',
    'ytd-video-description-transcript-section-renderer yt-button-shape button',
  ];

  let transcriptButton: HTMLElement | null = null;

  // Check structural selectors first
  for (const selector of structuralSelectors) {
    const element = document.querySelector(selector);
    if (referencesTranscriptPanel(element) || element?.closest('ytd-video-description-transcript-section-renderer')) {
      const clickable = findClickableAncestor(element);
      if (clickable) {
        transcriptButton = clickable;
        console.log('[TranscriptDOM] Found transcript button via structural selector:', selector);
        break;
      }
    }
  }

  // If not found, try generic button search
  if (!transcriptButton) {
    const genericButtons = document.querySelectorAll('button, yt-button-shape button, ytd-button-renderer button');
    for (const button of Array.from(genericButtons)) {
      if (referencesTranscriptPanel(button) || referencesTranscriptPanel(button.closest('[target-id]'))) {
        const clickable = findClickableAncestor(button);
        if (clickable) {
          transcriptButton = clickable;
          console.log('[TranscriptDOM] Found transcript button via generic search');
          break;
        }
      }
    }
  }

  // Find "More actions" button (needed if transcript is in menu)
  const moreActionsButton =
    document.querySelector<HTMLElement>('ytd-watch-metadata ytd-menu-renderer button[aria-haspopup="true"]') ||
    document.querySelector<HTMLElement>('button[aria-label*="more" i][aria-haspopup="true"]');

  if (moreActionsButton) {
    console.log('[TranscriptDOM] Found "More actions" button');
  }

  return {
    transcriptButton,
    moreActionsButton,
  };
}

/**
 * Find transcript menu item within an open menu
 *
 * @returns The menu item element or null if not found
 */
function findTranscriptMenuItem(): HTMLElement | null {
  console.log('[TranscriptDOM] Searching for transcript menu item...');

  const menuContainers = document.querySelectorAll('ytd-menu-popup-renderer, tp-yt-iron-dropdown');

  for (const container of Array.from(menuContainers)) {
    const items = container.querySelectorAll<HTMLElement>(
      'tp-yt-paper-item, ytd-menu-service-item-renderer, button[role="menuitem"], a[role="menuitem"]',
    );

    for (const item of Array.from(items)) {
      // Check if item directly references transcript panel
      if (referencesTranscriptPanel(item)) {
        console.log('[TranscriptDOM] Found transcript menu item (direct reference)');
        return item;
      }

      // Check if item's container references transcript panel
      const targetCarrier = item.closest('[target-id], [data-target-id], [aria-controls]');
      if (referencesTranscriptPanel(targetCarrier)) {
        console.log('[TranscriptDOM] Found transcript menu item (container reference)');
        return item;
      }

      // Check if item contains an element that references transcript panel
      const panelTarget = item.querySelector('[target-id], [data-target-id], [aria-controls], [href]');
      if (referencesTranscriptPanel(panelTarget)) {
        console.log('[TranscriptDOM] Found transcript menu item (child reference)');
        return item;
      }
    }
  }

  console.log('[TranscriptDOM] Transcript menu item not found');
  return null;
}

/**
 * Open the YouTube transcript panel
 *
 * Strategy:
 * 1. Check if transcript is already visible - if so, do nothing
 * 2. Try clicking direct transcript button if available
 * 3. Otherwise, open "More actions" menu and click transcript menu item
 *
 * @returns Promise that resolves with info about how the panel was opened
 * @throws Error with specific message if transcript UI cannot be found or opened
 */
export async function openTranscriptPanel(): Promise<{
  wasAlreadyOpen: boolean;
  openedViaMenu: boolean;
  openerElement: HTMLElement | null;
}> {
  console.log('[TranscriptDOM] Opening transcript panel...');

  // Check if transcript is already visible in the dedicated transcript panel
  const existingPanel = getTranscriptPanel();
  const transcriptAlreadyVisible =
    !!existingPanel && existingPanel.querySelector('ytd-transcript-segment-renderer') !== null;

  if (transcriptAlreadyVisible) {
    console.log('[TranscriptDOM] Transcript already visible, no action needed');
    return {
      wasAlreadyOpen: true,
      openedViaMenu: false,
      openerElement: null,
    };
  }

  // Find entry points
  const { transcriptButton, moreActionsButton } = findTranscriptEntryPoints();

  // Try direct transcript button first
  if (transcriptButton) {
    console.log('[TranscriptDOM] Clicking transcript button...');
    transcriptButton.click();

    // Wait for panel to open
    await new Promise(resolve => setTimeout(resolve, 1000));

    const openerIsMenuItem = transcriptButton.closest('ytd-menu-popup-renderer') !== null;

    return {
      wasAlreadyOpen: false,
      openedViaMenu: openerIsMenuItem,
      openerElement: transcriptButton,
    };
  }

  // Fallback: Try opening via "More actions" menu
  if (moreActionsButton) {
    console.log('[TranscriptDOM] Transcript button not found, opening "More actions" menu...');
    moreActionsButton.click();

    // Wait for menu to appear
    await new Promise(resolve => setTimeout(resolve, 500));

    const transcriptMenuItem = findTranscriptMenuItem();

    if (transcriptMenuItem) {
      console.log('[TranscriptDOM] Clicking transcript menu item...');
      transcriptMenuItem.click();

      // Wait for panel to open
      await new Promise(resolve => setTimeout(resolve, 1000));

      return {
        wasAlreadyOpen: false,
        openedViaMenu: true,
        openerElement: transcriptMenuItem,
      };
    } else {
      throw createTranscriptError(
        'MENU_ITEM_NOT_FOUND',
        'Could not find transcript option in menu'
      );
    }
  }

  // Neither method worked
  throw createTranscriptError(
    'UI_NOT_FOUND',
    'Transcript button not found'
  );
}

/**
 * Close the transcript panel
 *
 * @param openMethod - Information about how the panel was opened (from openTranscriptPanel)
 */
export function closeTranscriptPanel(openMethod: {
  wasAlreadyOpen: boolean;
  openedViaMenu: boolean;
  openerElement: HTMLElement | null;
}): void {
  // Don't close if it was already open when we started
  if (openMethod.wasAlreadyOpen) {
    console.log('[TranscriptDOM] Panel was already open, leaving it open');
    return;
  }

  console.log('[TranscriptDOM] Closing transcript panel...');

  try {
    const panel = getTranscriptPanel();

    if (!panel) {
      console.log('[TranscriptDOM] Panel not found, nothing to close');
      return;
    }

    // Try to find explicit close button in panel header
    const explicitCloseButton = panel.querySelector<HTMLElement>(
      '#visibility-button ytd-button-renderer button',
    );

    if (explicitCloseButton) {
      console.log('[TranscriptDOM] Closing via explicit close button');
      explicitCloseButton.click();
      return;
    }

    // Try other structural close buttons
    const header = panel.querySelector<HTMLElement>('ytd-transcript-header-renderer, #header');
    const structuralSelectors = [
      '#close-button',
      '#dismiss-button',
      '#visibility-button button',
      '#visibility-button ytd-button-renderer button',
      'yt-icon-button#close-button',
      'tp-yt-paper-icon-button#close-button',
      'yt-icon-button[aria-haspopup="false"]',
      'tp-yt-paper-icon-button[aria-haspopup="false"]',
      'button[aria-haspopup="false"]',
    ];

    for (const selector of structuralSelectors) {
      const candidate = (header || panel).querySelector<HTMLElement>(selector);
      if (candidate) {
        console.log('[TranscriptDOM] Closing via structural selector:', selector);
        candidate.click();
        return;
      }
    }

    // Fallback: try any button in header
    const fallbackButton = header?.querySelector<HTMLElement>('yt-icon-button, tp-yt-paper-icon-button, button');
    if (fallbackButton) {
      console.log('[TranscriptDOM] Closing via fallback header button');
      fallbackButton.click();
      return;
    }

    // If opened via direct button (not menu), toggle it again
    if (!openMethod.openedViaMenu && openMethod.openerElement) {
      console.log('[TranscriptDOM] Closing by toggling opener element');
      openMethod.openerElement.click();
      return;
    }

    // Last resort: hide the panel
    console.log('[TranscriptDOM] Hiding panel via display:none');
    panel.style.display = 'none';

  } catch (error) {
    console.warn('[TranscriptDOM] Failed to close transcript panel:', error);
  }
}

/**
 * Extract transcript segments from the DOM
 *
 * Scrapes all transcript entries from YouTube's transcript panel and parses them
 * into structured data with timestamps.
 *
 * @returns Array of transcript entries with text and timestamps
 * @throws Error if no transcript segments are found
 */
export function extractTranscriptSegments(): TranscriptEntry[] {
  console.log('[TranscriptDOM] Extracting transcript segments from DOM...');

  // Find the active transcript panel
  const panel = getTranscriptPanel();

  if (!panel) {
    throw createTranscriptError(
      'UI_NOT_FOUND',
      'Transcript panel not found in DOM'
    );
  }

  // Find all transcript segment elements within the active panel only.
  // This avoids accidentally including hidden/duplicate panels or legacy
  // transcript UIs that may still be present elsewhere in the document.
  const segments = panel.querySelectorAll('ytd-transcript-segment-renderer');

  if (segments.length === 0) {
    throw createTranscriptError(
      'SEGMENTS_NOT_FOUND',
      'No transcript segments found in DOM'
    );
  }

  console.log('[TranscriptDOM] Found', segments.length, 'transcript segments');

  // Parse each segment
  const transcript = Array.from(segments).map(segment => {
    // Find time and text elements within segment
    const timeElement = segment.querySelector('[class*="time"]');
    const textElement = segment.querySelector('[class*="segment-text"]');

    const timeText = timeElement?.textContent?.trim() || '0:00';
    const text = textElement?.textContent?.trim() || '';

    // Parse timestamp (format: "MM:SS" or "H:MM:SS")
    const timeParts = timeText.split(':').map(Number);
    let seconds = 0;

    if (timeParts.length === 2) {
      // MM:SS format
      seconds = timeParts[0] * 60 + timeParts[1];
    } else if (timeParts.length === 3) {
      // H:MM:SS format
      seconds = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
    }

    return {
      text,
      start: seconds,
      duration: 0, // Duration not available from DOM, but not critical for summarization
    };
  });

  console.log('[TranscriptDOM] Successfully extracted', transcript.length, 'entries');
  return transcript;
}
