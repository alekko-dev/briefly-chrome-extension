# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Briefly** is a Chrome extension (Manifest V3) that generates AI-powered summaries of YouTube videos by extracting transcripts and processing them with OpenAI's GPT models. This codebase was reverse-engineered from minified production code and rebuilt with modern TypeScript, React 19, and Vite 7.

## Build Commands

```bash
# Install dependencies
npm install

# Development build with hot reload
npm run dev

# Production build (outputs to dist/)
npm run build

# Preview production build
npm run preview
```

**After building**, load the extension in Chrome:
1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `dist/` folder
4. After code changes, click the reload icon on the extension card

## Architecture

### Chrome Extension Structure

This is a **Manifest V3** extension with three isolated execution contexts that communicate via Chrome's message passing API:

1. **Background Service Worker** (`src/background/index.ts`)
   - Minimal message handler
   - Runs in background, not tied to any tab
   - Currently used only for logging; most logic is in popup

2. **Content Script** (`src/content/index.ts`)
   - Injected into all `youtube.com` pages
   - Has direct DOM access to the YouTube page
   - Handles two types of messages:
     - `GET_TRANSCRIPT_DATA`: Clicks transcript button and extracts transcript from DOM
     - `SEEK_VIDEO`: Controls video playback (seek, play, scroll)
   - Cannot access Chrome extension APIs or popup state

3. **Popup UI** (`src/popup/`)
   - React application shown when clicking extension icon
   - Main orchestrator: calls YouTube API, OpenAI API, and sends messages to content script
   - Has access to Chrome APIs but NOT to page DOM
   - Persists settings to `chrome.storage.local`

### Message Passing Pattern

Communication between popup and content script uses Chrome's message passing:

```typescript
// Popup sends message to content script
chrome.tabs.sendMessage(tabId, {
  type: 'SEEK_VIDEO',
  time: timeInSeconds
});

// Content script receives and responds
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SEEK_VIDEO') {
    // Manipulate video element
    sendResponse({ success: true });
  }
  return true; // Keep channel open for async response
});
```

### Data Flow

1. **User clicks "Summarize This Video"** in popup
2. **Popup** extracts video ID from active tab URL
3. **YouTube Transcript Extraction** (`src/utils/youtube.ts`):
   - Sends `GET_TRANSCRIPT_DATA` message to content script
   - Content script clicks "Show transcript" button on YouTube
   - Waits for transcript panel to load
   - Extracts transcript segments from DOM (`ytd-transcript-segment-renderer` elements)
   - Parses timestamps (MM:SS or H:MM:SS format) and text
   - Returns `TranscriptEntry[]` with timestamped text
4. **OpenAI Summary Generation** (`src/utils/openai.ts`):
   - Formats transcript with timestamps
   - Calls OpenAI Chat Completions API (GPT-4o-mini)
   - Returns markdown-formatted summary with clickable timestamps
5. **User clicks timestamp** in summary
6. **Popup** sends `SEEK_VIDEO` message to content script
7. **Content script** seeks video, plays if paused, scrolls into view

### State Management

No external state library - all state in `App.tsx` using React hooks:
- `settings`: API keys loaded from `chrome.storage.local`
- `summary`: Generated summary object (includes videoId, title, content, timestamp)
- `loading`: Boolean for async operations
- `error`: String for error messages
- `showSettings`: Boolean to control settings modal visibility

## Key Implementation Details

### YouTube Transcript Extraction

**Critical**: The extension extracts transcripts by interacting with YouTube's native transcript UI:

1. Popup sends `GET_TRANSCRIPT_DATA` message to content script with video ID
2. Content script searches for transcript button using DOM selectors:
   - `button[aria-label*="transcript" i]` or `button[aria-label*="Show transcript" i]`
   - If not found directly, looks in the "More actions" menu
3. Clicks the transcript button programmatically
4. Waits 1 second for transcript panel to load
5. Extracts all `ytd-transcript-segment-renderer` elements from DOM
6. For each segment:
   - Extracts time element (class contains "time")
   - Extracts text element (class contains "segment-text")
   - Parses timestamp string (MM:SS or H:MM:SS) to seconds
   - Returns structured `{ text, start, duration }` objects

**Advantages of this approach**:
- More reliable than API methods (uses same data YouTube shows users)
- Doesn't depend on undocumented APIs or URL structures
- Works as long as YouTube's transcript UI exists
- No authentication or rate limiting issues

**If YouTube changes their DOM structure**, the selectors may need updating. Key elements to look for:
- Transcript button: Check aria-label attributes
- Transcript segments: Look for transcript-related element tags
- Time/text elements: Inspect class names in transcript panel

### Styling with Tailwind CSS v4

**Important**: This project uses Tailwind CSS **v4**, which has different syntax than v3:

- **CSS Import**: Use `@import "tailwindcss";` NOT `@tailwind base/components/utilities;`
- **No config file needed**: Tailwind v4 auto-detects source files (no `tailwind.config.js`)
- **PostCSS plugin**: Uses `@tailwindcss/postcss` in `postcss.config.js`

### Vite Build Configuration

**Critical settings** in `vite.config.ts`:

```typescript
export default defineConfig({
  plugins: [
    react(),
    crx({ manifest: manifest as any }) // @crxjs/vite-plugin handles Chrome extension bundling
  ],
  base: './', // REQUIRED: Chrome extensions need relative paths, not absolute /assets/
  build: {
    outDir: 'dist',
  }
});
```

The `base: './'` is essential - without it, CSS/JS paths will be `/assets/...` which fail in Chrome extensions (must be relative like `../../assets/...`).

### Manifest V3 Specifics

- Service worker is TypeScript (`src/background/index.ts`), Vite compiles to JS
- Content script runs on `https://www.youtube.com/*` only
- Permissions: `activeTab`, `scripting`, `storage`, `windows`
- Icons must be in `public/icons/` for @crxjs to copy them correctly

## Common Gotchas

1. **CSS not loading**: Verify `base: './'` in vite.config.ts and check generated HTML has relative paths (`../../assets/` not `/assets/`)

2. **Content script can't access popup state**: They're isolated contexts. Use `chrome.tabs.sendMessage()` to communicate.

3. **API keys not persisting**: Ensure `chrome.storage.local.set()` is called with both keys as an object, not separately.

4. **Transcript extraction fails**:
   - Check if YouTube changed their DOM structure for the transcript button or panel
   - Inspect the transcript button's aria-label attribute
   - Check if `ytd-transcript-segment-renderer` elements still exist in the transcript panel
   - Open DevTools on YouTube page and check console for `[Content]` logs to debug

5. **Extension doesn't reload**: After `npm run build`, you must:
   - Click the reload icon in `chrome://extensions/`
   - **Hard refresh the YouTube page** (Ctrl+Shift+R / Cmd+Shift+R) to load new content script
   - The old content script code may be cached until page refresh

6. **Settings modal black areas**: The overlay div should not have `bg-black bg-opacity-50` classes - these create dark areas on the sides of the fixed-width popup.

## File Organization

- **`src/popup/App.tsx`**: Main orchestrator, handles all business logic
- **`src/popup/components/`**: Presentational components (SettingsModal, SummaryView)
- **`src/utils/youtube.ts`**: YouTube transcript extraction orchestration (sends message to content script)
- **`src/utils/openai.ts`**: OpenAI Chat Completions API integration
- **`src/content/index.ts`**: DOM manipulation (transcript extraction, video seeking, playback control)
- **`src/background/index.ts`**: Minimal background service worker
- **`public/icons/`**: Extension icons (copied to dist/ by @crxjs)

## External Dependencies

- **Runtime**: OpenAI API (GPT-4o-mini), YouTube's native transcript UI
- **User-provided**: OpenAI API key (required), YouTube API key (optional, not currently used)
- **Cost**: ~$0.01-0.05 per summary via OpenAI API

## Recent Major Changes

### Transcript Extraction Rewrite (2025)
The transcript extraction was completely rewritten to use DOM extraction instead of YouTube's timedtext API:
- **Old approach**: Scraped video page HTML, parsed JSON for captionTracks, fetched timedtext XML
- **Problem**: YouTube's timedtext API returned empty responses (200 OK with 0 bytes)
- **New approach**: Content script clicks transcript button and extracts from DOM
- **Result**: More reliable, no API dependencies, works as long as transcript UI exists
