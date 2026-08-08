# 智能体通信协议

默认地址：`http://127.0.0.1:8787/api/v1`

这个协议把“AI 分析”和“脑图渲染”解耦。智能体负责理解用户、确认歧义并生成结构；MindFlow 负责验证、持久化、实时同步和编辑。

## 推荐工作流

1. 用户在 Codex、Claude Code、Trae 或 WorkBuddy 中描述需求。
2. 智能体追问必要信息，并形成层级结构。
3. 第一次生成时发送完整嵌套树。
4. 后续对话优先发送增量操作，保留用户已经手动调整的内容与位置。
5. 若需求来自 Web 面板，先读取请求队列，完成后回写请求结果。

## 完整脑图

`PUT /api/v1/mindmaps/current`

推荐使用对智能体友好的嵌套树：

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

`id` 可以省略，服务会自动生成。若后续准备使用增量操作，建议智能体提供稳定且语义清晰的 ID。

也可以发送 `GET /api/v1/mindmaps/current` 返回的规范化文档。

## 增量操作

`POST /api/v1/mindmaps/operations`

```json
{
  "operations": [
    {
      "type": "add_node",
      "parentId": "users",
      "node": { "id": "teams", "text": "小型团队" }
    },
    {
      "type": "update_node",
      "id": "creators",
      "patch": { "text": "专业内容创作者", "notes": "高频生产内容" }
    },
    {
      "type": "move_node",
      "id": "teams",
      "parentId": "root",
      "index": 1
    },
    {
      "type": "delete_node",
      "id": "obsolete"
    }
  ]
}
```

支持的操作：

- `add_node`: 新增节点，可传 `index` 控制兄弟顺序。
- `update_node`: 更新 `text`、`notes`、`collapsed`、`color` 或 `position`。
- `move_node`: 移动节点及其全部后代，服务会阻止循环引用。
- `delete_node`: 级联删除节点及后代，根节点不可删除。

所有操作在同一个事务中执行；任一操作无效时，整批操作不会保存。

## Web 请求队列

创建请求：`POST /api/v1/requests`

```json
{ "message": "帮我规划一次产品发布" }
```

领取请求：`GET /api/v1/requests?status=pending`

完成请求：`POST /api/v1/requests/:id/complete`

```json
{
  "reply": "已经整理为预热、发布日和复盘三个阶段。",
  "document": {
    "title": "产品发布",
    "root": {
      "text": "产品发布",
      "children": [
        { "text": "预热" },
        { "text": "发布日" },
        { "text": "复盘" }
      ]
    }
  }
}
```

完成请求时可以发送 `document`，也可以发送 `operations`。

## 实时事件

`GET /api/v1/events` 返回 Server-Sent Events：

- `document_updated`
- `request_created`
- `request_completed`

浏览器已经自动订阅，无需平台方管理长连接。

## 错误处理

验证失败返回 HTTP 400：

```json
{ "error": "不能移动到自己的后代节点" }
```

智能体应先读取错误内容，修正原操作后再发送，不应盲目重复相同请求。
