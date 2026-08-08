import { useCallback, useEffect, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { createFlowModel, lockNodeChangesToLayout } from '../domain/flow.js';
import { MindNode } from './MindNode.jsx';

const nodeTypes = { mindNode: MindNode };

export function MindMapCanvas({
  document,
  selectedId,
  onSelect,
  onEditNode,
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
  const decoratedNodes = useMemo(
    () => model.nodes.map((node) => ({
      ...node,
      selected: node.id === selectedId,
      data: {
        ...node.data,
        onEdit: onEditNode,
        onAddChild,
        onToggleCollapse,
        previewMode,
        changeType: previewChanges[node.id] || null,
      },
      draggable: previewMode ? false : node.draggable,
    })),
    [model.nodes, onAddChild, onEditNode, onToggleCollapse, previewChanges, previewMode, selectedId],
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
    <div className="canvas-wrap">
      <ReactFlow
        nodes={nodes}
        edges={model.edges}
        nodeTypes={nodeTypes}
        onNodesChange={onAlignedNodesChange}
        onNodeClick={(_event, node) => onSelect(node.id)}
        onPaneClick={() => onSelect(null)}
        onNodeDrag={previewMode ? undefined : onBranchDrag}
        onNodeDragStop={previewMode ? undefined : (_event, node) => onReorderNode(node.id, node.position)}
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
        <Background color="#d8d9d5" gap={24} size={1} variant={BackgroundVariant.Dots} />
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
      <div className="canvas-hint">
        双击编辑 · Tab 添加子节点 · Enter 添加同级 · 纵向拖动排序
      </div>
    </div>
  );
}
