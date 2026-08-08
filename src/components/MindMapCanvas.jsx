import { useCallback, useEffect, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { createFlowModel, lockNodeChangesToColumns } from '../domain/flow.js';
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
  onReady,
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
      },
    })),
    [model.nodes, onAddChild, onEditNode, onToggleCollapse, selectedId],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(decoratedNodes);

  useEffect(() => setNodes(decoratedNodes), [decoratedNodes, setNodes]);

  const onAlignedNodesChange = useCallback((changes) => {
    onNodesChange(lockNodeChangesToColumns(changes, decoratedNodes, document.rootId));
  }, [decoratedNodes, document.rootId, onNodesChange]);

  return (
    <div className="canvas-wrap">
      <ReactFlow
        nodes={nodes}
        edges={model.edges}
        nodeTypes={nodeTypes}
        onNodesChange={onAlignedNodesChange}
        onNodeClick={(_event, node) => onSelect(node.id)}
        onPaneClick={() => onSelect(null)}
        onNodeDragStop={(_event, node) => onReorderNode(node.id, node.position.y)}
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
      <div className="canvas-hint">
        双击编辑 · Tab 添加子节点 · Enter 添加同级 · 纵向拖动排序
      </div>
    </div>
  );
}
