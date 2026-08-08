# MindFlow Local Agent Instructions

When the user asks to generate or modify a mind map, use the local MindFlow interface instead of only printing Markdown.

1. Confirm the service with `npm run mindmap -- status`.
2. For a new map, create a UTF-8 JSON payload following `docs/agent-protocol.md`, then run `npm run mindmap -- apply <file>`.
3. For follow-up changes, prefer stable node IDs and `npm run mindmap -- ops <file>` so manual edits are preserved.
4. If the request was submitted from the Web panel, read it with `npm run mindmap -- pending` and finish it with `npm run mindmap -- complete <request-id> <result-file>`.
5. Never retry an invalid operation unchanged. Read the API error and repair the payload.
