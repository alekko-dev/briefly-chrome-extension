# Refactor Plan: Transcript Extraction & UX Improvements

This plan focuses on:

- Providing the best user experience for YouTube summarization
- Minimizing ongoing maintenance
- Staying within the current extension-only architecture (no backend)

The core strategy is to keep the DOM-based transcript extraction as the **primary** method, then harden it and the summarization pipeline around it.

---

## 1. Context & Goals

### Current Approach (Keep as Primary)

- Manifest V3 extension with:
  - Background service worker (`src/background/index.ts`)
  - Content script for YouTube DOM access (`src/content/index.ts`)
  - Popup React app (`src/popup/`)
- Transcript extraction:
  - Popup sends `GET_TRANSCRIPT_DATA` to content script.
  - Content script opens the YouTube transcript panel, scrapes `ytd-transcript-segment-renderer` elements, and parses timestamps.
  - `src/utils/youtube.ts` orchestrates transcript retrieval and formatting.
- Summarization:
  - `src/utils/openai.ts` uses OpenAI Chat Completions (GPT-4o-mini) with a detailed prompt.
  - `SummaryView` turns `[MM:SS]` timestamps into clickable links that seek the video.

### Goals

- **UX**
  - Reliable transcript extraction where YouTube provides transcripts.
  - Clear error messages when things fail (no transcript, DOM changes, OpenAI issues).
  - Reasonable performance for both short and long videos.
- **Maintenance**
  - Single obvious place to update selectors when YouTube changes DOM.
  - Minimal duplication of fragile logic (avoid maintaining multiple brittle paths).
  - Clear documentation for future contributors.

---

## 2. Future Alternatives (Not in Scope for This Refactor)

For clarity, these are intentionally **not** included in this refactor because they add complexity or maintenance burden:

- **Timedtext / Innertube HTTP APIs only**
  - Previously attempted; known to return empty responses and are undocumented/unstable.
  - Would require ongoing reverse-engineering when YouTube changes private APIs.
- **Hybrid HTTP + DOM**
  - HTTP-first with DOM fallback increases complexity with two fragile paths.
  - Reasonable in theory but adds more code and debugging burden for a small project.
- **Backend transcript service (yt-dlp, etc.)**
  - Requires running and maintaining a server, handling ToS, monitoring, etc.
- **Audio-based STT (Whisper, etc.)**
  - Great coverage but far more complex and costly, and typically requires backend infrastructure.

The plan below assumes we stay with a **pure browser extension** and DOM-based transcript extraction as the primary mechanism.

---

## 3. Centralize DOM Transcript Logic

**Objective:** Make DOM changes cheap to fix by isolating selectors and timing logic into a single helper module.

### 3.1. Add `src/content/transcriptDom.ts`

Create a new module to encapsulate all transcript-related DOM interaction:

- `findTranscriptEntryPoints()`
  - Returns possible entry points into the transcript UI:
    - Primary: dedicated transcript button (e.g., aria-label containing "transcript").
    - Fallback: "More actions" menu button.
  - Example signature:
    ```ts
    interface TranscriptEntryPoints {
      transcriptButton: HTMLElement | null;
      moreActionsButton: HTMLElement | null;
    }

    export function findTranscriptEntryPoints(): TranscriptEntryPoints;
    ```

- `openTranscriptPanel()`
  - Uses `findTranscriptEntryPoints()` internally.
  - Clicks the transcript button directly when available.
  - Otherwise opens the "More actions" menu, finds the transcript menu item, and clicks it.
  - Handles necessary delays with `setTimeout` or a small `waitForSelector`-style utility.
  - Throws typed errors (see section 4) on:
    - Transcript UI not found.
    - Menu item not found.

- `extractTranscriptSegments()`
  - Scrapes transcript entries from the DOM:
    - Selects `ytd-transcript-segment-renderer` (or updated equivalent).
    - For each segment, finds time and text elements.
    - Parses timestamps (`MM:SS` or `H:MM:SS`) to seconds.
  - Returns `TranscriptEntry[]`:
    ```ts
    export interface TranscriptEntry {
      text: string;
      start: number;
      duration: number; // can remain 0 if not available
    }
    ```
  - Throws a typed error (e.g., `NO_TRANSCRIPT` or `SEGMENTS_NOT_FOUND`) when no segments exist.

### 3.2. Use `transcriptDom.ts` in `src/content/index.ts`

- Replace the inline DOM logic in the `GET_TRANSCRIPT_DATA` handler with:
  ```ts
  import {
    openTranscriptPanel,
    extractTranscriptSegments,
  } from './transcriptDom';
  ```
- Handler flow:
  1. Call `openTranscriptPanel()` and wait for completion.
  2. Call `extractTranscriptSegments()` to get `TranscriptEntry[]`.
  3. Return `{ success: true, data: transcript }` on success.
  4. On error, catch and return `{ success: false, code, message }`.

This ensures any YouTube DOM changes are handled by editing a single file (`transcriptDom.ts`), not scattered selectors.

---

## 4. Better Error Types & User-Facing Messages

**Objective:** Improve UX and debuggability by distinguishing failure modes and mapping them to clear messages.

### 4.1. Define Error Codes

Add a small shared error type, e.g. in `src/utils/errors.ts` (or `src/utils/youtube.ts` if you prefer fewer files):

```ts
export type TranscriptErrorCode =
  | 'NO_TRANSCRIPT'
  | 'UI_NOT_FOUND'
  | 'MENU_ITEM_NOT_FOUND'
  | 'SEGMENTS_NOT_FOUND'
  | 'PAGE_NOT_READY'
  | 'OPENAI_ERROR'
  | 'UNKNOWN';

export interface TranscriptErrorPayload {
  code: TranscriptErrorCode;
  message: string;
}
```

### 4.2. Use Error Codes in Content Script

- When transcript DOM operations fail in `transcriptDom.ts`, throw/reject with a `TranscriptErrorPayload`.
- In `src/content/index.ts`:
  - Catch these errors and send responses like:
    ```ts
    sendResponse({ success: false, code: error.code, error: error.message });
    ```
  - For unexpected errors, use `code: 'UNKNOWN'`.

### 4.3. Map Error Codes to UX in Popup (`App.tsx`)

- In `handleSummarize`, when `getYouTubeTranscript` rejects:
  - Inspect the error and, if it contains a `code`, map to user-friendly messages:
    - `NO_TRANSCRIPT` → “This video doesn’t appear to have a YouTube transcript.”
    - `UI_NOT_FOUND` or `MENU_ITEM_NOT_FOUND` →
      - “YouTube’s transcript interface couldn’t be found. Briefly may need an update to support this version of YouTube.”
    - `SEGMENTS_NOT_FOUND` →
      - “The transcript panel opened, but no transcript segments were found. This may be a YouTube bug or layout change.”
    - `OPENAI_ERROR` →
      - “There was a problem generating the summary with OpenAI: ...”
    - fallback → “An unexpected error occurred while extracting the transcript.”

This gives users clearer guidance about what went wrong and helps maintainers quickly identify DOM vs. API failures.

---

## 5. Long-Video / Chunked Summarization

**Objective:** Improve reliability and UX for long videos by avoiding OpenAI context/token limits while keeping the API surface simple.

### 5.1. New High-Level API in `src/utils/openai.ts`

- Introduce a single entry point:
  ```ts
  export async function summarizeTranscript(
    transcript: TranscriptEntry[],
    apiKey: string
  ): Promise<string>;
  ```

- Behavior:
  - Compute a rough “length” of the transcript:
    - For example, join all `entry.text` with `\n` and check `totalChars`.
  - If `totalChars` is below a threshold (e.g. 10,000–12,000 characters), call the existing summarization logic (current `generateSummary`) as-is.
  - If above threshold:
    1. Split the transcript into chunks.
    2. Summarize each chunk.
    3. Summarize the set of chunk summaries into a final summary.

### 5.2. Chunking Strategy

Keep it simple to start:

- **Chunking by number of entries**:
  - E.g. group transcript entries into chunks of ~N segments (tuned so typical chunk text stays within a safe token range).
  - Maintain timestamps from original transcript (no extra processing required).

Alternatively:

- **Chunking by total characters**:
  - Build chunks until `currentChunkLength >= maxChunkChars` then start a new chunk.

### 5.3. Summarization Workflow

- `summarizeTranscript` outline:
  1. If short transcript:
     - Call existing summary generator and return.
  2. If long transcript:
     - Build `chunks: TranscriptEntry[][]`.
     - For each chunk:
       - Call a helper similar to current `generateSummary` but clearly named (e.g. `generateChunkSummary`).
     - Collect chunk summaries into an array.
     - Call a final summarization pass with a prompt like:
       - “Here are summaries of sequential parts of a YouTube video. Produce a coherent overall summary with key timestamps etc.”
     - Return that final overall summary.

The popup (`App.tsx`) then uses only `summarizeTranscript`, with no UI changes required.

---

## 6. Optional Future: Background-Orchestrated Summarization

**Objective:** Improve resilience for long-running operations by moving work out of the popup, while keeping this as a *second phase*.

> NOTE: This is intentionally not part of the immediate refactor, but worth keeping in mind as a next step if popup lifetime issues become common.

High-level idea:

- Background worker:
  - Receives a `START_SUMMARY` message `{ videoId, openaiApiKey }`.
  - Orchestrates transcript extraction (via tab + content script) and OpenAI calls.
  - Sends progress updates (`SUMMARY_PROGRESS`, `SUMMARY_DONE`, `SUMMARY_ERROR`) back to the popup via `chrome.runtime.sendMessage`.
- Popup:
  - Sends start message and subscribes to updates.
  - Shows progress state / spinner while work continues.

This would make the extension more robust to users closing the popup during long summaries but does add complexity and should be done after the simpler refactors in sections 3–5.

---

## 7. Align Comments & Documentation

**Objective:** Reduce confusion by ensuring docs and comments match the current, DOM-based behavior and new error/summary model.

### 7.1. Update `CLAUDE.md`

- Clearly describe:
  - DOM-based transcript extraction as the primary method.
  - Location of DOM selectors (`src/content/transcriptDom.ts`).
  - Error codes and their meanings at a high level.
  - Long-video chunking behavior (when it kicks in and how it works conceptually).
- Mark any references to timedtext/Innertube as historical/background context, not the current implementation.

### 7.2. Update Inline Comments

- `src/utils/youtube.ts`
  - Ensure comments reference “DOM transcript panel” instead of “timedtext API” where applicable.
  - Document where error codes may come from and how they’re propagated.
- `src/content/index.ts` and `src/content/transcriptDom.ts`
  - Add concise comments around:
    - Transcript entry point selectors.
    - Segment selectors (time/text).
    - Any timing assumptions (delays after button clicks).

### 7.3. Brief Maintenance Notes

In `CLAUDE.md` or a small “Maintenance” section:

- “If transcript extraction breaks after a YouTube UI change:
  1. Inspect the transcript button and panel in DevTools.
  2. Update selectors in `src/content/transcriptDom.ts`.
  3. Ensure error codes remain accurate (e.g., `UI_NOT_FOUND` vs `SEGMENTS_NOT_FOUND`).”

---

## 8. Implementation Order

Suggested order to keep changes incremental and testable:

1. **Centralize DOM logic** (`transcriptDom.ts`) and wire it into `src/content/index.ts`.
2. **Introduce error codes** and map them to user-friendly messages in `App.tsx`.
3. **Add `summarizeTranscript` with chunking** and swap `App.tsx` to use it.
4. **Align comments and docs** (`CLAUDE.md`, inline comments).
5. Optionally, revisit background orchestration if long-running operations become a UX problem.

This keeps the project extension-only, improves UX, and clusters maintenance into a small, well-documented surface area. 

