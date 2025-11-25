# Briefly Extensions Monorepo

A monorepo containing Chrome extensions for AI-powered video processing, built with TypeScript, React, and Vite.

## 📦 Packages

### Extensions

- **[briefly-extension](./packages/briefly-extension/)** - AI-powered YouTube video summarizer
  - Extracts transcripts from YouTube videos
  - Generates summaries using OpenAI's GPT models
  - Clickable timestamps for video navigation

- **interruptly-extension** *(coming soon)* - Video translation assistant
  - Will reuse transcript extraction from shared package
  - Focus on real-time translation features

### Shared Libraries

- **[@briefly/shared](./packages/shared/)** - Shared utilities for Chrome extensions
  - YouTube transcript extraction via DOM
  - TypeScript interfaces and types
  - Error handling utilities

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- npm (comes with Node.js)
- Chrome browser

### Installation

```bash
# Install all dependencies for the monorepo
npm install
```

### Development

```bash
# Build all extensions
npm run build:all

# Or build individual extensions
npm run build:briefly
npm run build:interruptly

# Development mode with hot reload
npm run dev:briefly
npm run dev:interruptly
```

### Loading Extensions in Chrome

1. Build the extension you want to load (e.g., `npm run build:briefly`)
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the appropriate dist folder:
   - Briefly: `packages/briefly-extension/dist`
   - Interruptly: `packages/interruptly-extension/dist`

## 🏗️ Monorepo Structure

```
briefly-extensions/
├── packages/
│   ├── briefly-extension/       # YouTube summarizer extension
│   │   ├── src/
│   │   │   ├── background/      # Service worker
│   │   │   ├── content/         # Content script
│   │   │   ├── popup/           # React popup UI
│   │   │   └── utils/           # Extension-specific utilities
│   │   ├── dist/                # Build output (gitignored)
│   │   └── package.json
│   │
│   ├── interruptly-extension/   # Translation extension (coming soon)
│   │   └── ...
│   │
│   └── shared/                  # Shared code for all extensions
│       ├── src/
│       │   ├── transcriptDom.ts      # YouTube DOM extraction
│       │   ├── transcriptMessaging.ts # Chrome message passing
│       │   ├── errors.ts             # Error types
│       │   └── types.ts              # Shared interfaces
│       └── package.json
│
├── package.json                 # Root workspace configuration
├── tsconfig.base.json          # Shared TypeScript config
└── CLAUDE.md                   # AI coding assistant guidance
```

## 📋 Available Scripts

### Root Level Commands

```bash
# Development
npm run dev:briefly              # Start Briefly in dev mode
npm run dev:interruptly          # Start Interruptly in dev mode

# Production builds
npm run build:briefly            # Build Briefly extension
npm run build:interruptly        # Build Interruptly extension
npm run build:all                # Build all extensions

# Install dependencies
npm install                      # Install all workspace dependencies
```

### Package-Specific Commands

You can also run commands in specific packages:

```bash
# Run command in specific workspace
npm run build --workspace=briefly-extension
npm run dev --workspace=briefly-extension

# Or cd into package and run directly
cd packages/briefly-extension
npm run build
npm run dev
```

## 🛠️ Technology Stack

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7 with @crxjs/vite-plugin
- **Styling**: Tailwind CSS v4
- **Chrome APIs**: Manifest V3
- **Monorepo**: npm workspaces

## 📝 Development Guidelines

### Adding a New Extension

1. Create a new directory under `packages/`
2. Add workspace reference to root `package.json`
3. Add build scripts to root `package.json`
4. Import shared utilities from `@briefly/shared`
5. Follow the structure of `packages/briefly-extension/`

### Using Shared Code

The shared package exports utilities that can be imported by any extension:

```typescript
// Import from shared package
import { getYouTubeTranscript } from '@briefly/shared/messaging';
import { TranscriptEntry } from '@briefly/shared/types';
import { createTranscriptError } from '@briefly/shared/errors';
import { openTranscriptPanel } from '@briefly/shared/transcriptDom';
```

### TypeScript Configuration

- `tsconfig.base.json` - Shared compiler options for all packages
- Each package has its own `tsconfig.json` that extends the base
- Path mappings for `@briefly/shared` are configured in each extension's tsconfig

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Build and test the affected extension(s)
4. Run the CI checks locally: `npm run build:all`
5. Commit using clear, descriptive messages
6. Submit a pull request

## 📄 License

ISC

---

For detailed documentation on specific extensions, see their individual README files:
- [Briefly Extension Documentation](./packages/briefly-extension/README.md)
