# MindFlow Local

MindFlow Local 是一个可由 Codex、Claude Code、Trae、WorkBuddy 等智能体驱动的本地思维导图工具。用户可以在 AI 对话中分析需求，由智能体通过 HTTP 或 CLI 推送脑图；浏览器中的无限画布会实时更新，并支持继续手动编辑。

## 已实现的 MVP

- 双侧无限画布、缩放、平移和拖拽节点
- 双击改名，Tab 添加子节点，Enter 添加同级节点
- 删除、折叠、分支颜色、备注、自动布局、撤销和重做
- JSON 导入与导出，本地文件持久化
- 完整脑图替换与增量操作 API
- SSE 实时更新多个浏览器窗口
- Web 端 AI 请求队列，外部智能体可领取并回写结果
- 零额外依赖的 CLI 适配层

## 启动

```powershell
npm install
npm run dev
```

打开 [http://127.0.0.1:5173](http://127.0.0.1:5173)。本地 API 默认运行在 `http://127.0.0.1:8787`。

生产构建：

```powershell
npm run build
npm start
```

生产服务会在已有 `dist` 时同时托管网页和 API，访问 [http://127.0.0.1:8787](http://127.0.0.1:8787)。

## 智能体调用

推送完整脑图：

```powershell
npm run mindmap -- apply examples/product-plan.json
```

发送增量修改：

```powershell
npm run mindmap -- ops examples/add-branch.operations.json
```

查看 Web 页面提交的待处理需求：

```powershell
npm run mindmap -- pending
```

详细协议见 [docs/agent-protocol.md](docs/agent-protocol.md)。

## 验证

```powershell
npm run check
```
