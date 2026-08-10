---
name: create-a-mindmap
description: Start the local MindFlow application and turn the user's topic, requirements analysis, notes, or current conversation into an editable mind map. Use when the user invokes create-a-mindmap, asks to start MindFlow and draw a mind map, requests a new mind map from the current discussion, or wants to continue an existing MindFlow canvas.
---

# Create A Mind Map

Launch MindFlow and use the compact protocol by default. New maps are submitted as indented outlines; existing maps use compact reads and stable-ID operations.

## Workflow

1. Determine the mind-map topic from the invocation and conversation. If no topic or source material exists, ask for it before creating a canvas.
2. Locate the `mindflow-local` project:
   - Prefer the current directory or an ancestor whose `package.json` has `name: "mindflow-local"`.
   - Otherwise use `MINDFLOW_PROJECT_DIR` when set.
   - On this Windows installation, try `D:\project\ai_mindmap`.
   - If no valid project exists, ask the user for its location.
3. Run `npm run mindmap -- start`. Use the returned `webUrl`; do not launch a duplicate service.
4. For a new map:
   - Run `npm run mindmap -- create <title>`.
   - Write `.mindflow/<topic>.outline.txt` as a compact indented outline. The first line is the root; indentation defines descendants. Optional first line: `@layout left-right`, `@layout top-bottom`, or `@layout architecture`.
   - Run `npm run mindmap -- propose-outline <file>`. The command reads the revision and generates node IDs locally, so do not run `read` first.
5. For an existing map:
   - Keep or deliberately switch the active canvas.
   - Run `npm run mindmap -- read --compact`, or `read <node-id> --compact` for one branch.
   - Load `mindflow-handoff` only now, then submit stable-ID incremental operations.
6. Default to Web review. Use `apply-outline` or `apply-safe` only when the user explicitly requests immediate application.
7. Present the returned `webUrl`, canvas title, and review status.

## Guardrails

- Do not create an empty canvas before the user provides a topic.
- Do not replace a useful existing map for a follow-up request; prefer incremental operations.
- Do not load the full agent protocol for ordinary new-map creation.
- Re-read compact data after every canvas switch and revision conflict.
- Never retry a stale or invalid payload unchanged.
- Preserve manual edits, node IDs, styles, notes, branch sides, and unrelated content.
