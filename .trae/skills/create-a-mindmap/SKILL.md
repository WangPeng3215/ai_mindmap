---
name: create-a-mindmap
description: Start the local MindFlow application and turn the user's topic, requirements analysis, notes, or current conversation into an editable mind map. Use when the user invokes create-a-mindmap, asks to start MindFlow and draw a mind map, requests a new mind map from the current discussion, or wants to continue an existing MindFlow canvas.
---

# Create A Mind Map

Launch MindFlow when needed, choose the target canvas, then hand the user's analysis to the editable canvas through the safe proposal workflow.

## Workflow

1. Determine the mind-map topic from the invocation and conversation. If no topic or source material exists, ask for it before creating a canvas.
2. Locate the `mindflow-local` project:
   - Prefer the current directory or an ancestor whose `package.json` has `name: "mindflow-local"`.
   - Otherwise use `MINDFLOW_PROJECT_DIR` when set.
   - On this Windows installation, try `D:\project\ai_mindmap`.
   - If no valid project exists, ask the user for its location.
3. From the project root, run `npm run mindmap -- start`. If `npm` is unavailable but Node.js is available, run `node scripts/mindmap-cli.mjs start`. Use the returned `webUrl`; do not launch a duplicate service.
4. Choose the canvas deliberately:
   - When the user asks for a new map, run `npm run mindmap -- create <title>`.
   - When the user asks to update, expand, or continue the current map, keep the active canvas.
   - When intent is ambiguous and creating another canvas could duplicate work, list canvases and ask which one to use.
5. Run `npm run mindmap -- read` after the final canvas is active. Never reuse a revision read before a canvas switch.
6. Follow the installed `mindflow-handoff` Skill for payload generation, stable node IDs, branch scope, review proposals, safe direct application, and revision conflicts. If that Skill is unavailable, read `codex-skills/mindflow-handoff/SKILL.md` and its referenced payload guide from the project.
7. Default to `npm run mindmap -- propose <file>` so the result appears in Web review. Use `apply-safe` only when the user explicitly requests immediate application.
8. Open or present the returned `webUrl` when browser control is available, then report the canvas title and whether the proposal is awaiting review or already applied.

## Guardrails

- Do not create an empty canvas before the user provides a topic.
- Do not replace a useful existing map for a follow-up request; prefer incremental operations.
- Re-read after every canvas switch and after any revision conflict.
- Never retry a stale or invalid payload unchanged.
- Preserve manual edits, node IDs, styles, notes, branch sides, and unrelated content.
