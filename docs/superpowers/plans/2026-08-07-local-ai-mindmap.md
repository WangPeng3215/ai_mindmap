# Local AI Mind Map MVP Implementation Plan

**Goal:** Build a local editable mind-map canvas that receives full documents or incremental operations from Codex, Claude Code, Trae, and WorkBuddy through a stable local protocol.

**Architecture:** A React and XYFlow client renders and edits one normalized mind-map document. An Express server persists the current document, broadcasts changes over SSE, and exposes an agent request queue. A zero-dependency CLI wraps the HTTP protocol for coding agents.

**Tech Stack:** React, Vite, XYFlow, Express, Vitest, native CSS.

## Deliverables

- [ ] Tested document normalization, tree conversion, operations, validation, and layout.
- [ ] REST API for full document replacement and incremental operations.
- [ ] SSE channel that refreshes every open canvas after external updates.
- [ ] Agent request queue for prompts created inside the Web app.
- [ ] Infinite canvas with pan, zoom, drag, inline edit, add, delete, collapse, undo, and redo.
- [ ] JSON import/export, local persistence, CLI, protocol reference, and sample payloads.
- [ ] Automated tests, production build, and browser-based visual verification.

## Verification

Run `npm test`, `npm run build`, start `npm run dev`, then verify the main editing and agent-update flows in a browser.
