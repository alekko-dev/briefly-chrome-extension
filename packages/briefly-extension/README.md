# Briefly - AI-Powered YouTube Video Summarizer

A Chrome extension that generates AI-powered summaries of YouTube videos using transcript analysis.

## Overview

This extension was **reverse-engineered and rebuilt from scratch** using modern TypeScript, React, and Vite. The original minified code has been replaced with clean, maintainable source code.

## Key Features

- Extract transcripts from YouTube videos
- Generate AI-powered summaries using OpenAI's GPT models
- Click timestamps in summaries to jump to specific video moments
- Clean, modern UI matching the original design
- Secure API key storage in Chrome's local storage

## Prerequisites

To use this extension, you'll need:

1. **OpenAI API Key** - Get one from [OpenAI Platform](https://platform.openai.com/api-keys)
2. **YouTube API Key** (optional) - Get one from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

## Installation

### For Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build the extension**:
   ```bash
   npm run build
   ```

3. **Load in Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist` folder from this project

4. **Configure API keys**:
   - Click the extension icon in Chrome
   - Click the settings (gear) icon
   - Enter your OpenAI API key (required)
   - Enter your YouTube API key (optional, for enhanced features)
   - Click "Save Settings"

### For Production

```bash
npm run build
```

The production-ready extension will be in the `dist` folder. You can package this folder and distribute or publish it to the Chrome Web Store.

## Usage

1. Navigate to any YouTube video
2. Click the Briefly extension icon
3. Click "Summarize This Video"
4. Wait for the AI to generate a summary
5. Click on timestamps in the summary to jump to that point in the video

## Project Structure

```
src/
├── background/          # Background service worker
│   └── index.ts
├── content/             # Content script for YouTube pages
│   └── index.ts
├── popup/               # Extension popup UI
│   ├── components/      # React components
│   │   ├── SettingsModal.tsx
│   │   └── SummaryView.tsx
│   ├── App.tsx          # Main app component
│   ├── index.tsx        # React entry point
│   ├── index.html       # HTML template
│   └── index.css        # Global styles
├── utils/               # Utility functions
│   ├── youtube.ts       # YouTube transcript extraction
│   └── openai.ts        # OpenAI API integration
├── icons/               # Extension icons
└── manifest.json        # Chrome extension manifest
```

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build production extension
- `npm run preview` - Preview production build

### Technology Stack

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7 with @crxjs/vite-plugin
- **Styling**: TailwindCSS 4
- **Markdown Rendering**: react-markdown
- **Chrome APIs**: Manifest V3

## How It Works

### Transcript Extraction

The extension extracts transcripts directly from YouTube's interface:

1. Content script programmatically clicks the "Show transcript" button
2. Waits for the transcript panel to load
3. Extracts transcript segments from the DOM (`ytd-transcript-segment-renderer` elements)
4. Parses timestamps and text from each segment
5. Returns timestamped text entries

This approach is more reliable than API methods because it uses the same transcript data YouTube displays to users.

### AI Summarization

Summaries are generated using OpenAI's GPT-4o-mini model:

1. Formats transcript with timestamps
2. Sends to OpenAI with custom prompts for structured summaries
3. Filters out promotional content and sponsor messages
4. Returns markdown-formatted summary with clickable timestamps

### Video Control

The content script enables timestamp navigation and transcript extraction:

1. **Transcript Extraction**: Listens for `GET_TRANSCRIPT_DATA` messages
   - Clicks transcript button on YouTube
   - Extracts data from transcript panel DOM
   - Returns structured transcript entries

2. **Video Seeking**: Listens for `SEEK_VIDEO` messages
   - Finds the video element on the page
   - Seeks to the specified time
   - Plays video if paused
   - Scrolls video into view

## Known Limitations

- Requires videos to have captions/subtitles available
- OpenAI API usage incurs costs (typically $0.01-0.05 per summary)
- Extension only works on youtube.com domain

## Troubleshooting

### "No transcript available"

- Ensure the video has captions enabled
- Check that captions are not auto-generated in an unsupported language
- Try a different video

### "OpenAI API error"

- Verify your API key is correct
- Check you have sufficient API credits
- Ensure your API key has access to chat completions

### Extension not loading

- Ensure you've built the extension (`npm run build`)
- Check that Developer Mode is enabled in Chrome
- Try removing and re-loading the extension

## License

ISC

---

**Note**: This extension requires active API keys to function. Keep your API keys secure and never commit them to version control.
