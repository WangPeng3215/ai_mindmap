import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { createFlowModel, lockNodeChangesToLayout } from '../domain/flow.js';
import { BoundaryNode, SummaryNode } from './ExpressionNodes.jsx';
import { MindNode } from './MindNode.jsx';

const nodeTypes = {
  mindNode: MindNode,
  boundaryNode: BoundaryNode,
  summaryNode: SummaryNode,
};
const layoutLabels = { 'left-right': '思维导图', 'top-bottom': '上下布局', architecture: '架构图' };

export function MindMapCanvas({
  document,
  selectedIds = [],
  selectedExpression = null,
  onSelectNode,
  onSelectExpression,
  onClearSelection,
  onEditNode,
  onEditExpression,
  onAddChild,
  onToggleCollapse,
  onReorderNode,
  layoutMode,
  onReady,
  previewMode = false,
  previewChanges = {},
  previewKind = null,
  previewDeletedCount = 0,
  onExitPreview,
}) {
  const model = useMemo(() => createFlowModel(document), [document]);
  const [editingSummaryId, setEditingSummaryId] = useState(null);
  const selectedNodeSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const decoratedNodes = useMemo(
    () => model.nodes.map((node) => {
      const kind = node.data?.kind;
      const selected = kind
        ? selectedExpression?.type === kind && selectedExpression.id === node.data.expressionId
        : selectedNodeSet.has(node.id);
      return {
        ...node,
        selected,
        data: {
          ...node.data,
          onEdit: onEditNode,
          onEditExpression,
          forceEditing: kind === 'summary' && editingSummaryId === node.data.expressionId,
          onFinishExpressionEdit: () => setEditingSummaryId(null),
          onAddChild,
          onToggleCollapse,
          previewMode,
          changeType: previewChanges[node.id] || null,
        },
        draggable: previewMode ? false : node.draggable,
      };
    }),
    [
      model.nodes,
      onAddChild,
      onEditExpression,
      onEditNode,
      onToggleCollapse,
      previewChanges,
      previewMode,
      selectedExpression,
      selectedNodeSet,
    ],
  );
  const decoratedEdges = useMemo(
    () => model.edges.map((edge) => {
      const isRelationship = edge.data?.kind === 'relationship';
      const selected = isRelationship
        && selectedExpression?.type === 'relationship'
        && selectedExpression.id === edge.data.expressionId;
      return selected
        ? { ...edge, selected: true, style: { ...edge.style, strokeWidth: 3 } }
        : edge;
    }),
    [model.edges, selectedExpression],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(decoratedNodes);

  useEffect(() => setNodes(decoratedNodes), [decoratedNodes, setNodes]);

  const onBranchDrag = useCallback((_event, node) => {
    if (!node.data?.isRootChild) return;
    const baseNode = model.nodes.find((item) => item.id === node.id);
    if (!baseNode) return;
    const delta = {
      x: node.position.x - baseNode.position.x,
      y: node.position.y - baseNode.position.y,
    };
    const descendants = new Set();
    const stack = [...document.nodes[node.id].children];
    while (stack.length) {
      const id = stack.pop();
      descendants.add(id);
      stack.push(...document.nodes[id].children);
    }
    setNodes((current) => current.map((item) => {
      if (!descendants.has(item.id)) return item;
      const base = model.nodes.find((candidate) => candidate.id === item.id);
      return base
        ? { ...item, position: { x: base.position.x + delta.x, y: base.position.y + delta.y } }
        : item;
    }));
  }, [document.nodes, model.nodes, setNodes]);

  const onAlignedNodesChange = useCallback((changes) => {
    onNodesChange(lockNodeChangesToLayout(changes, decoratedNodes, document.rootId, layoutMode));
  }, [decoratedNodes, document.rootId, layoutMode, onNodesChange]);

  return (
    <div className="canvas-wrap" style={{ background: model.theme.background, fontFamily: model.theme.fontFamily }}>
      <ReactFlow
        nodes={nodes}
        edges={decoratedEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onAlignedNodesChange}
        onNodeClick={(event, node) => {
          if (node.data?.kind) {
            onSelectExpression(node.data.kind, node.data.expressionId);
            return;
          }
          onSelectNode(node.id, event.ctrlKey || event.metaKey);
        }}
        onNodeDoubleClick={(_event, node) => {
          if (!previewMode && node.data?.kind === 'summary') {
            onSelectExpression('summary', node.data.expressionId);
            setEditingSummaryId(node.data.expressionId);
          }
        }}
        onEdgeClick={(_event, edge) => {
          if (edge.data?.kind === 'relationship') {
            onSelectExpression('relationship', edge.data.expressionId);
          }
        }}
        onPaneClick={onClearSelection}
        onNodeDrag={previewMode ? undefined : onBranchDrag}
        onNodeDragStop={previewMode ? undefined : (_event, node) => {
          if (document.nodes[node.id]) onReorderNode(node.id, node.position);
        }}
        nodesDraggable={!previewMode}
        nodesConnectable={false}
        onInit={onReady}
        minZoom={0.18}
        maxZoom={2.2}
        fitView
        fitViewOptions={{ padding: 0.22, maxZoom: 1 }}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={null}
      >
        <Background color={model.theme.gridColor} gap={24} size={1} variant={BackgroundVariant.Dots} />
        <Controls position="bottom-right" showInteractive={false} />
      </ReactFlow>
      {previewMode && (
        <div className="preview-banner">
          <div>
            <strong>{previewKind === 'document' ? '整图方案预览' : '增量修改预览'}</strong>
            <span>{previewDeletedCount ? `另有 ${previewDeletedCount} 个节点将在应用后删除` : '当前画布处于只读预览状态'}</span>
          </div>
          <button type="button" onClick={onExitPreview}>退出预览</button>
        </div>
      )}
      <div className="canvas-statusbar">
        <span className="canvas-mode">{layoutLabels[layoutMode] || '思维导图'}</span>
        <span className="canvas-hint">双击编辑 · Ctrl/Command 多选 · Tab 添加子节点 · Enter 添加同级 · 纵向拖动排序</span>
        <span className="canvas-status">本地画布</span>
      </div>
    </div>
  );
}
