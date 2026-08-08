# MindFlow Local Agent Instructions

When the user asks to generate or modify a mind map, use the local MindFlow interface instead of only printing Markdown.

1. Use the `mindflow-handoff` Skill when it is installed; its source lives in `codex-skills/mindflow-handoff`.
2. Confirm the service with `npm run mindmap -- status`, then read the current document with `npm run mindmap -- read`.
3. For Codex-generated changes, create a UTF-8 proposal following `docs/agent-protocol.md`. Default to `npm run mindmap -- propose <file>` for Web review. Use the canvas preview and select individual operations when reviewing an incremental proposal. Use `npm run mindmap -- apply-safe <file>` only when the user explicitly requests immediate application.
4. For follow-up changes, prefer stable node IDs and incremental operations so manual edits are preserved.
5. If the request was submitted from the Web panel, read it with `npm run mindmap -- pending` and submit a review proposal with `npm run mindmap -- complete <request-id> <result-file>`; the user applies or rejects it in the Web panel.
6. Respect `scope: branch` and modify only `targetNodeId` and its descendants. If the document revision changed, re-read the current map and regenerate the proposal.
7. Never retry an invalid or stale operation unchanged. Read the API error and repair or rebase the payload.
8. Historical versions are recoverable through the Web history panel or `GET /api/v1/mindmaps/snapshots`; restoring always creates a new current revision.
