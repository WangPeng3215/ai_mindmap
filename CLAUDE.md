# MindFlow Local

Follow [AGENTS.md](AGENTS.md) whenever the user asks to create or change a mind map. The full HTTP and CLI contract is in [docs/agent-protocol.md](docs/agent-protocol.md).

When the user invokes `create-a-mindmap` or asks to start MindFlow and create a map, load `.claude/skills/create-a-mindmap/SKILL.md` and follow it before the handoff protocol.
