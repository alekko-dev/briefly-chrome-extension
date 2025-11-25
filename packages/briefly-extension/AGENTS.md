# Repository Guidelines

## Project Structure & Module Organization
- This extension is part of a **monorepo** at `../../` (repository root).
- Extension source lives in `src/`: background (`src/background`), content script (`src/content`), popup UI (`src/popup`), extension-specific utilities (`src/utils`), and icons (`src/icons` / `public/icons`).
- Shared utilities live in `packages/shared/` and are imported via `@briefly/shared`.
- The built Chrome extension is output to `dist/` via Vite and `@crxjs/vite-plugin`; load `packages/briefly-extension/dist/` in `chrome://extensions`.
- For new features, place DOM-facing logic in the content script, Chrome API / orchestration in the popup, extension-specific logic in `src/utils`, and reusable cross-extension logic in `packages/shared/`.

## Build, Test, and Development Commands

### From Repository Root (Recommended)
- Install dependencies: `npm install` (installs all workspace packages)
- Run dev server: `npm run dev:briefly`
- Production build: `npm run build:briefly`

### From This Package Directory
- Install dependencies: `npm install` (from repo root first!)
- Run dev server (popup + extension): `npm run dev`
- Production build to `dist/`: `npm run build`
- Preview production build locally: `npm run preview`

## Coding Style & Naming Conventions
- Language: TypeScript + React function components with hooks; follow patterns in `src/popup/App.tsx` and `src/utils/*.ts`.
- Indentation: 2 spaces, no tabs; keep lines reasonably short and self-explanatory.
- Prefer explicit types and strict null handling; avoid `any` unless there is a clear, documented reason.
- Name files by role and context (e.g. `TranscriptDom`, `SummaryView`, `openai.ts`); keep Chrome-specific code under `background`, `content`, or `popup`.
- Use `@briefly/shared` imports for shared utilities (transcript extraction, types, errors) rather than duplicating code.

## Testing Guidelines
- No automated test runner is configured yet; manually verify changes by building (`npm run build`) and exercising flows in Chrome (summarization, timestamp clicking, settings).
- When adding tests, co-locate them next to source files as `*.test.ts` / `*.test.tsx` and favor Vitest + React Testing Library.

## Commit & Pull Request Guidelines
- Use concise, imperative commit messages similar to existing history, e.g. `Add structured error types` or `Centralize transcript DOM logic`.
- For pull requests, include: a short summary, key implementation notes (especially DOM selector or manifest changes), manual test steps, and screenshots/GIFs of the popup when UI changes.

## Security & Configuration Tips
- Never commit API keys or secrets; keys are entered and stored via the popup using `chrome.storage.local`.
- When adjusting OpenAI or YouTube integration, keep user-facing error messages clear and non-technical, following patterns in `@briefly/shared/errors` and `src/popup/App.tsx`.
- Transcript extraction logic is shared across extensions; changes to YouTube DOM selectors should be made in `packages/shared/src/transcriptDom.ts`.

