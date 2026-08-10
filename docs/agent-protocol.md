# 智能体通信协议

默认地址：`http://127.0.0.1:8787/api/v1`

## 启动服务与创建画布

智能体可以先确保本地服务已经运行：

```text
npm run mindmap -- start
```

命令会在服务已运行时直接返回地址；服务未运行时，会在后台启动 API 与 Web 服务并等待健康检查完成。使用自定义服务地址时设置 `MINDFLOW_API_URL`，CLI 不会为不可用的远程地址启动本地服务。

创建并切换到一张新画布：

```text
npm run mindmap -- create "画布名称"
```

创建或切换画布后必须重新读取当前文档和 `revision`。

## Codex 主链路

Codex 不需要先创建 Web 请求。先读取当前导图：

```text
npm run mindmap -- read
npm run mindmap -- read <node-id>
```

随后把 `baseRevision`、`document` 或 `operations` 提交到 `POST /api/v1/proposals`。默认审核模式：

```text
npm run mindmap -- propose <proposal.json>
```

用户明确要求立即写入时使用安全直写：

```text
npm run mindmap -- apply-safe <proposal.json>
```

两种模式都检查 `baseRevision`。版本过期返回 HTTP 409、`code: REVISION_CONFLICT`、`currentRevision` 和最新 `document`；Codex 必须基于最新文档重建方案，不得原样重试。

```json
{
  "baseRevision": 3,
  "scope": "map",
  "message": "把需求分析生成思维导图",
  "reply": "已按目标、用户、范围、风险和行动整理",
  "operations": [
    { "type": "add_node", "parentId": "root", "node": { "id": "risks", "text": "风险", "side": "left" } }
  ]
}
```

局部更新使用 `scope: "branch"` 和 `targetNodeId`，并且只能提交 `operations`。

## 历史版本与恢复

每次真正写入导图前，服务端会在 `data/snapshots/` 保存上一版本的完整文档。页面可以读取历史列表：

```text
GET /api/v1/mindmaps/snapshots
```

恢复历史版本：

```text
POST /api/v1/mindmaps/snapshots/:id/restore
```

恢复会先把当前版本保存为快照，再以新的 `revision` 写入被选中的历史文档，因此恢复操作本身也可以继续被恢复回来。

MindFlow 负责验证、持久化、实时同步和人工编辑；Codex 等智能体负责理解需求并生成结构。完整生成可提交嵌套树，后续修改必须优先使用稳定节点 ID 和增量操作。

## 推荐工作流

1. 使用 `GET /api/v1/mindmaps/current` 读取最新脑图和 `revision`。
2. 使用 `GET /api/v1/requests?status=pending` 领取请求。
3. 根据请求的 `scope` 和 `targetNodeId` 生成方案。
4. 使用 `POST /api/v1/requests/:id/complete` 提交方案。
5. 方案进入 `review` 状态，不会立即修改脑图。
6. 用户在 Web 页面预览并选择应用或拒绝。

请求包含创建时的 `baseRevision`。如果期间用户修改了脑图，旧方案会被拒绝，智能体必须重新读取最新文档后生成，不能覆盖人工修改。

## 完整脑图

`PUT /api/v1/mindmaps/current`

```json
{
  "title": "产品规划",
  "root": {
    "id": "root",
    "text": "产品规划",
    "children": [
      {
        "id": "users",
        "text": "目标用户",
        "children": [
          { "id": "creators", "text": "内容创作者" }
        ]
      }
    ]
  }
}
```

## 增量操作

`POST /api/v1/mindmaps/operations`

```json
{
  "operations": [
    { "type": "add_node", "parentId": "users", "node": { "id": "teams", "text": "小型团队" } },
    { "type": "update_node", "id": "creators", "patch": { "text": "专业内容创作者" } },
    { "type": "move_node", "id": "teams", "parentId": "root", "index": 1 },
    { "type": "delete_node", "id": "obsolete" }
  ]
}
```

所有操作在同一事务中执行。任何操作无效时，整批操作都不会保存。增量更新不会删除未涉及节点的人工位置和样式。
新增的关系表达操作同样可通过 API、CLI 和提案使用：

```json
{
  "operations": [
    {
      "type": "add_relationship",
      "relationship": {
        "id": "rel-risk-value",
        "sourceId": "risks",
        "targetId": "value",
        "label": "影响",
        "color": "#ef654f",
        "lineType": "dashed",
        "arrow": true
      }
    },
    {
      "type": "add_boundary",
      "boundary": {
        "id": "boundary-users",
        "nodeIds": ["creators", "teams"],
        "label": "目标用户"
      }
    },
    {
      "type": "add_summary",
      "summary": {
        "id": "summary-users",
        "nodeIds": ["creators", "teams"],
        "text": "核心用户群"
      }
    }
  ]
}
```

更新和删除分别使用 `update_relationship` / `delete_relationship`、`update_boundary` / `delete_boundary`、`update_summary` / `delete_summary`。外框和概要的 `nodeIds` 必须是两个以上连续同级节点。

## Web 请求

创建整图请求：

```json
{ "message": "规划一次产品发布", "scope": "map" }
```

创建分支请求：

```json
{
  "message": "扩展风险和行动项",
  "scope": "branch",
  "targetNodeId": "risks"
}
```

分支请求必须返回 `operations`，且只能修改选中节点及其后代。

提交 AI 方案：`POST /api/v1/requests/:id/complete`

```json
{
  "reply": "建议补充两个风险节点",
  "operations": [
    { "type": "add_node", "parentId": "risks", "node": { "id": "schedule-risk", "text": "进度风险" } }
  ]
}
```

应用方案：`POST /api/v1/requests/:id/apply`

增量方案可以只应用选中的操作项：

```json
{ "operationIndexes": [0, 2, 4] }
```

序号按照提案中 `operations` 的原始顺序计算。完整文档方案不支持拆分应用。应用结果会返回 `appliedOperationIndexes` 和 `skippedOperationIndexes`。

拒绝方案：`POST /api/v1/requests/:id/reject`

## 实时事件

`GET /api/v1/events` 返回 Server-Sent Events：

- `document_updated`
- `request_created`
- `request_updated`
- `request_completed`

验证失败返回 HTTP 400。智能体应读取错误、重新获取最新脑图并修复方案，不得原样重试。

## 多画布工作区

现有 `GET /api/v1/mindmaps/current`、提案和增量操作始终指向当前活动画布，因此 Codex 默认无需传画布 ID。查看和切换活动画布：

```text
npm run mindmap -- canvases
npm run mindmap -- switch <canvas-id>
```

工作区 API：

- `GET /api/v1/canvases`：画布列表和活动画布 ID
- `POST /api/v1/canvases`：新建并切换画布
- `POST /api/v1/canvases/:id/activate`：切换活动画布
- `PATCH /api/v1/canvases/:id`：重命名画布
- `POST /api/v1/canvases/:id/duplicate`：复制并切换画布
- `DELETE /api/v1/canvases/:id`：删除画布，工作区至少保留一张
- `GET /api/v1/workspace/export`：导出整个工作区

每张画布拥有独立文档、AI 请求队列和历史版本。切换画布后必须重新读取当前文档及 revision，再生成提案；旧画布的 revision 不能用于新活动画布。
