---
name: mindflow-handoff
description: Safely hand structured analysis from Codex or a requirements-analysis skill to the local MindFlow editable mind-map canvas. Use when the user asks to generate, visualize, replace, expand, or modify a mind map from Codex analysis; when updating a selected MindFlow branch; or when sending a result to MindFlow for review or direct application.
---

# MindFlow Handoff

Send Codex analysis to MindFlow as a full editable map or stable-ID incremental operations. Protect manual edits with revision checks.

## Workflow

1. Work from the `ai_mindmap` project root. Run `npm run mindmap -- status`. If `npm` is unavailable, load the workspace Node.js dependency and run `node scripts/mindmap-cli.mjs status` with that executable.
2. Run `npm run mindmap -- read` before every submission. For a selected branch, run `npm run mindmap -- read <node-id>`.
3. Convert the analysis into one payload described in [references/payloads.md](references/payloads.md). Put the exact `revision` returned by `read` into `baseRevision`.
4. Prefer incremental `operations` when a map already contains useful content or manual edits. Use a complete `document` only for an intentional whole-map creation or replacement.
5. Default to review: run `npm run mindmap -- propose <proposal.json>`. This displays a preview in the Web panel without changing the canvas.
6. Use `npm run mindmap -- apply-safe <proposal.json>` only when the user explicitly asks to apply immediately. This still checks `baseRevision` before changing the map.
7. Confirm the returned request status and revision. Report whether the result is awaiting review or already applied.

Create temporary payloads under `.mindflow/`; this directory is ignored by Git.

## Preserve User Work

- Reuse current node IDs for updates, moves, and deletes.
- Do not replace the entire document for a small follow-up change.
- Do not set `position` unless the user explicitly asks for fixed coordinates. Let the selected layout calculate positions.
- Preserve existing notes, colors, collapse state, branch side, and unrelated nodes.
- For `scope: "branch"`, modify only `targetNodeId` and its descendants. Use operations; a full document is invalid.
- Add parent nodes before their children when one operation batch creates multiple levels.
- For root children in `left-right`, use `side: "left"` or `"right"` when direction matters. In `top-bottom`, use `"top"` or `"bottom"`. Ignore side in `architecture`.

## Handle Conflicts

If the command returns `code: "REVISION_CONFLICT"`, treat the included `document` as the latest source of truth. Rebuild the proposal against `currentRevision`, preserving the new manual changes, then submit once more. Never resend the stale payload unchanged.

If validation fails, repair the payload from the error. Never bypass validation with the legacy `apply` or `ops` commands.

## Chain From Requirements Analysis

Treat the requirements-analysis output as source material, not as a fixed visual tree. Preserve its goals, actors, constraints, decisions, risks, and actions; group them into concise nodes suited to scanning. Use `notes` for necessary detail that would make a node label too long. After a requirements-analysis skill finishes, perform this handoff without asking the user to restate the analysis.
