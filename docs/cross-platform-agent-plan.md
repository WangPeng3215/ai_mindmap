# MindFlow 跨平台智能体接入计划

目标：用户在 Codex、Claude Code、WorkBuddy 或 Trae 中调用 `create-a-mindmap` 后，智能体能够自动启动 MindFlow、新建或选择画布、生成可审核的思维导图，并继续支持手动编辑。

## P0：统一运行入口

- [x] CLI 增加 `start`，服务未运行时在后台启动 MindFlow
- [x] `start` 等待健康检查完成，并返回 Web 与 API 地址
- [x] CLI 增加 `create <title>`，新建并切换到画布
- [x] 保持 `MINDFLOW_API_URL` 自定义服务地址兼容
- [x] 为新增命令补充参数解析和自动化测试

## P0：Create A Mind Map Skill

- [x] 创建 `create-a-mindmap` Skill 源码
- [x] 调用时自动执行 `status`，失败后执行 `start`
- [x] 根据用户意图决定新建画布或使用当前画布
- [x] 复用 `mindflow-handoff` 的读取、提案、审核和冲突保护协议
- [x] 用户只调用 Skill、未提供主题时，询问思维导图主题
- [x] 使用 Skill 校验工具验证目录和元数据
- [x] 安装到 Codex 个人 Skill 目录
- [x] 在新的 Codex 任务中进行真实 Skill 调用验证

## P1：Claude Code 适配

- [x] 更新 `CLAUDE.md`，声明 `create-a-mindmap` 入口流程
- [x] 提供 Claude Code 可发现的 Skill/Command 配置
- [ ] 验证服务未启动时能够拉起项目并提交审核方案

## P1：WorkBuddy 适配

- [x] 确认 WorkBuddy 当前支持的 Skill、Rule 或 Command 规范
- [x] 创建对应入口配置，仅复用统一 CLI，不复制业务协议
- [ ] 验证自然语言触发、自动启动和提案审核流程

## P1：Trae 适配

- [x] 确认 Trae 当前支持的 Skill、Rule 或 Agent 规范
- [x] 创建对应入口配置，仅复用统一 CLI，不复制业务协议
- [ ] 验证自然语言触发、自动启动和提案审核流程

## P1：文档与验收

- [x] 更新 README 中的跨平台使用示例
- [x] 更新 `docs/agent-protocol.md` 的启动和新建画布命令
- [x] 验证“服务已运行”场景
- [ ] 验证“服务未运行”场景
- [x] 运行完整自动化测试与生产构建
- [x] 记录各平台已完成能力和仍需人工配置的部分

## 设计约束

- 启动、画布管理和协议处理由项目 CLI 统一实现。
- 各平台入口只描述触发方式和调用顺序，不维护重复业务逻辑。
- 默认提交 Web 审核方案；只有用户明确要求立即应用时才使用安全直写。
- 每次生成或修改前读取最新 `revision`，发生冲突后重新读取并重建方案。
- 后续修改优先使用稳定节点 ID 和增量操作，保护用户手动编辑。
