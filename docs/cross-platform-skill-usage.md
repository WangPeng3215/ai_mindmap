# Create A Mind Map 跨平台使用

`create-a-mindmap` 使用统一的 `SKILL.md` 和 MindFlow CLI。平台适配文件由以下命令从 `codex-skills/create-a-mindmap/SKILL.md` 同步：

```powershell
npm run sync:agent-skills
```

## Codex

个人 Skill 安装目录：

```text
%USERPROFILE%\.codex\skills\create-a-mindmap
```

调用示例：

```text
$create-a-mindmap 把当前需求分析生成一张新的思维导图
```

## Claude Code

项目 Skill 位于 `.claude/skills/create-a-mindmap/SKILL.md`。在项目内要求 Claude Code 使用 `create-a-mindmap`，或直接描述“启动 MindFlow 并生成思维导图”。

## TraeCode

项目 Skill 位于 `.trae/skills/create-a-mindmap/SKILL.md`，TraeCode 会原生发现该目录。项目同时提供标准 `.agents/skills/create-a-mindmap/`；使用此目录前需要在 TraeCode 的“设置 > 技能与命令”中启用 `.agents` 技能目录。

## WorkBuddy

将 `workbuddy-skills/create-a-mindmap.zip` 作为本地技能包上传：

1. 打开“技能”。
2. 选择“添加技能 > 上传技能”。
3. 选择 `create-a-mindmap.zip` 并启用。
4. 在任务中输入“使用 create-a-mindmap，把当前讨论生成思维导图”。

WorkBuddy 必须能访问本机项目目录并执行 Node.js。默认项目路径为 `D:\project\ai_mindmap`，也可以通过 `MINDFLOW_PROJECT_DIR` 指定。

## 统一行为

- `start`：检查服务，未运行时后台启动 Web 与 API。
- `create <title>`：新建并切换画布。
- `read --compact`：读取当前画布的精简结构和最新 revision。
- `propose-outline`：新建整图时从缩进大纲生成审核方案，无需先读取空画布。
- `propose`：默认提交页面审核。
- `apply-safe`：仅在用户明确要求立即应用时使用。
