# MindFlow Local 部署与使用说明

本部署包适用于在其他电脑上运行 MindFlow，并接入 Codex、Claude Code、TraeCode 或 WorkBuddy。部署包不包含原电脑的画布、历史版本、日志、Git 记录和 `node_modules`。

## 1. 环境要求

- Windows 10/11、macOS 或 Linux
- Node.js 22 LTS（最低建议 Node.js 20.19）
- npm 10 或更高版本
- 首次安装依赖时需要访问 npm 软件源

安装 Node.js 后，在终端确认：

```text
node --version
npm --version
```

## 2. Windows 快速部署

1. 解压整个部署包，路径中可以包含中文，建议放在固定目录。
2. 双击 `install-windows.cmd`。
3. 等待依赖安装、测试和生产构建完成。
4. 以后双击 `start-mindflow.cmd` 启动。
5. 浏览器访问 `http://127.0.0.1:5173/`。

默认 API 地址为 `http://127.0.0.1:8787`。两个服务只监听本机地址，不对局域网或互联网开放。

## 3. 通用命令部署

在解压后的项目根目录执行：

```text
npm install
npm test
npm run build
npm run mindmap -- start
```

服务已运行时，`start` 不会重复启动。查看状态：

```text
npm run mindmap -- status
```

停止服务可以关闭对应终端，或结束 MindFlow 的 Node.js 后台进程。

## 4. 创建和管理画布

新建并切换到画布：

```text
npm run mindmap -- create "产品规划"
```

查看与切换画布：

```text
npm run mindmap -- canvases
npm run mindmap -- switch <canvas-id>
```

读取当前画布：

```text
npm run mindmap -- read
```

## 5. Codex 接入

将以下目录复制到 Codex 个人 Skill 目录：

```text
来源：codex-skills/create-a-mindmap
目标：%USERPROFILE%\.codex\skills\create-a-mindmap
```

项目中的 `mindflow-handoff` 也应安装到同一目录。重新创建 Codex 任务后调用：

```text
$create-a-mindmap 把当前需求分析生成一张新的思维导图
```

Skill 会定位项目。若项目不在 `D:\project\ai_mindmap`，建议设置环境变量：

```text
MINDFLOW_PROJECT_DIR=<解压后的项目绝对路径>
```

## 6. Claude Code 接入

项目已包含：

```text
.claude/skills/create-a-mindmap/SKILL.md
CLAUDE.md
```

从当前项目目录启动 Claude Code，然后要求它“使用 create-a-mindmap 生成思维导图”。

## 7. TraeCode 接入

项目已包含原生入口：

```text
.trae/skills/create-a-mindmap/SKILL.md
```

TraeCode 打开该项目后即可发现。项目还包含 `.agents/skills/` 标准入口；需要在“设置 > 技能与命令”中开启 `.agents` 技能目录后使用。

## 8. WorkBuddy 接入

上传部署包中的：

```text
workbuddy-skills/create-a-mindmap.zip
```

在 WorkBuddy 中进入“技能 > 添加技能 > 上传技能”，上传并启用。WorkBuddy 必须具备访问本机项目目录和执行 Node.js 命令的权限。

## 9. 使用原则

- 默认由 AI 提交审核方案，用户在 MindFlow 页面预览后再应用。
- 只有用户明确要求立即应用时，才使用安全直写。
- AI 修改前必须读取最新画布版本，避免覆盖手动编辑。
- 后续修改优先使用增量操作和稳定节点 ID。

## 10. 数据与备份

运行后，本机数据保存在项目的 `data/` 目录，包括画布、请求和历史快照。迁移到另一台电脑时，可以在关闭 MindFlow 后复制整个 `data/` 目录。

部署包不包含制作电脑上的 `data/`，因此首次运行会创建一个全新的工作区。

## 11. 常见问题

端口被占用：检查 `5173` 和 `8787` 是否已有程序使用，关闭旧进程后重新启动。

找不到 npm：重新安装 Node.js 22 LTS，并确保安装程序已将 Node.js 加入 PATH。

Skill 找不到项目：设置 `MINDFLOW_PROJECT_DIR`，或者从 MindFlow 项目根目录启动智能体应用。

页面没有更新：刷新浏览器，并运行 `npm run mindmap -- status` 检查 API 是否正常。

完整的智能体协议见 `docs/agent-protocol.md`，跨平台说明见 `docs/cross-platform-skill-usage.md`。
