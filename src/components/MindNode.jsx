import { memo, useEffect, useRef, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { CaretRight, Plus } from '@phosphor-icons/react';

function MindNodeComponent({ data, selected }) {
  const {
    mindNode, isRoot, side, nodeStyle, onEdit, onAddChild, onToggleCollapse, previewMode, changeType,
  } = data;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(mindNode.text);
  const inputRef = useRef(null);

  useEffect(() => setDraft(mindNode.text), [mindNode.text]);
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commit() {
    const value = draft.trim();
    setEditing(false);
    if (value && value !== mindNode.text) onEdit(mindNode.id, { text: value });
    else setDraft(mindNode.text);
  }

  return (
    <div
      style={{ background: nodeStyle?.fill, borderColor: nodeStyle?.border, borderRadius: nodeStyle?.shape === 'pill' ? 999 : nodeStyle?.radius, color: nodeStyle?.textColor, textAlign: nodeStyle?.textAlign, fontSize: nodeStyle?.fontSize, fontWeight: nodeStyle?.fontWeight, fontStyle: nodeStyle?.fontStyle, textDecoration: nodeStyle?.textDecoration, fontFamily: nodeStyle?.fontFamily, '--node-font-size': String(nodeStyle?.fontSize) + 'px', '--node-font-weight': nodeStyle?.fontWeight, '--node-text-align': nodeStyle?.textAlign, '--node-fill': nodeStyle?.fill, '--node-border': nodeStyle?.border }}
      className={`mind-node shape-${nodeStyle?.shape || 'rounded'} ${isRoot ? 'mind-node-root' : ''} ${selected ? 'is-selected' : ''} ${previewMode ? 'is-preview' : ''} ${changeType ? `change-${changeType}` : ''}`}
      onDoubleClick={() => { if (!previewMode) setEditing(true); }}
    >
      <Handle id="target-left" type="target" position={Position.Left} className="node-handle" />
      <Handle id="source-left" type="source" position={Position.Left} className="node-handle" />
      <Handle id="target-right" type="target" position={Position.Right} className="node-handle" />
      <Handle id="source-right" type="source" position={Position.Right} className="node-handle" />
      <Handle id="target-top" type="target" position={Position.Top} className="node-handle" />
      <Handle id="source-top" type="source" position={Position.Top} className="node-handle" />
      <Handle id="target-bottom" type="target" position={Position.Bottom} className="node-handle" />
      <Handle id="source-bottom" type="source" position={Position.Bottom} className="node-handle" />

      {editing ? (
        <input
          ref={inputRef}
          className="node-edit-input nodrag"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
            if (event.key === 'Escape') {
              setDraft(mindNode.text);
              setEditing(false);
            }
          }}
        />
      ) : (
        <span className="node-label">{mindNode.text}</span>
      )}

      {mindNode.children.length > 0 && (
        <button
          type="button"
          className={`collapse-button nodrag collapse-${side}`}
          aria-label={mindNode.collapsed ? '展开子节点' : '折叠子节点'}
          onClick={(event) => {
            event.stopPropagation();
            onToggleCollapse(mindNode.id);
          }}
        >
          <CaretRight size={12} weight="bold" className={mindNode.collapsed ? '' : 'is-open'} />
          {mindNode.collapsed && <span>{mindNode.children.length}</span>}
        </button>
      )}

      {selected && !previewMode && (
        <button
          type="button"
          className={`node-add-button nodrag add-${side}`}
          aria-label="添加子节点"
          onClick={(event) => {
            event.stopPropagation();
            onAddChild(mindNode.id);
          }}
        >
          <Plus size={13} weight="bold" />
        </button>
      )}
    </div>
  );
}

export const MindNode = memo(MindNodeComponent);
