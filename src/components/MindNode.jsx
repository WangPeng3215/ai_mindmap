import { memo, useEffect, useRef, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { CaretRight, Plus } from '@phosphor-icons/react';

function MindNodeComponent({ data, selected }) {
  const { mindNode, isRoot, side, onEdit, onAddChild, onToggleCollapse } = data;
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
      className={`mind-node ${isRoot ? 'mind-node-root' : ''} ${selected ? 'is-selected' : ''}`}
      onDoubleClick={() => setEditing(true)}
    >
      <Handle id="target-left" type="target" position={Position.Left} className="node-handle" />
      <Handle id="source-left" type="source" position={Position.Left} className="node-handle" />
      <Handle id="target-right" type="target" position={Position.Right} className="node-handle" />
      <Handle id="source-right" type="source" position={Position.Right} className="node-handle" />

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
          className={`collapse-button nodrag ${side === 'left' ? 'collapse-left' : 'collapse-right'}`}
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

      {selected && (
        <button
          type="button"
          className={`node-add-button nodrag ${side === 'left' && !isRoot ? 'add-left' : 'add-right'}`}
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
