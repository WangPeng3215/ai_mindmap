# MindFlow Local Agent Instructions

When the user asks to generate or modify a mind map, use the local MindFlow interface instead of only printing Markdown.

1. For a new map, start MindFlow, create the canvas, write a compact UTF-8 outline, and run `npm run mindmap -- propose-outline <file>`. Do not read the empty canvas first.
2. For an existing map, read only the required structure with `npm run mindmap -- read --compact` or `npm run mindmap -- read <node-id> --compact`, then use the `mindflow-handoff` Skill for stable-ID incremental operations.
3. Default to Web review. Use `apply-outline` or `apply-safe` only when the user explicitly requests immediate application. Read `docs/agent-protocol.md` only for advanced operations, Web-panel requests, or error recovery.
4. For follow-up changes, prefer stable node IDs and incremental operations so manual edits are preserved.
5. If the request was submitted from the Web panel, read it with `npm run mindmap -- pending` and submit a review proposal with `npm run mindmap -- complete <request-id> <result-file>`; the user applies or rejects it in the Web panel.
6. Respect `scope: branch` and modify only `targetNodeId` and its descendants. If the document revision changed, re-read the compact current map and regenerate the proposal.
7. Never retry an invalid or stale operation unchanged. Read the API error and repair or rebase the payload.
8. Historical versions are recoverable through the Web history panel or `GET /api/v1/mindmaps/snapshots`; restoring always creates a new current revision.
