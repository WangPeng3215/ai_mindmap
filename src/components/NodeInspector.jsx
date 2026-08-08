import { Plus, Trash, X } from '@phosphor-icons/react';

const COLORS = ['#ef6a4c', '#df9b34', '#4d9b72', '#4f7dc9', '#8a67b3', '#60645f'];

export function NodeInspector({ node, isRoot, onClose, onChange, onAddChild, onDelete }) {
  if (!node) return null;
  return (
    <aside className="inspector">
      <div className="inspector-header">
        <div><span>节点</span><h3>内容与样式</h3></div>
        <button type="button" aria-label="关闭节点面板" onClick={onClose}><X size={17} /></button>
      </div>
      <label className="field-label" htmlFor="node-text">标题</label>
      <textarea
        id="node-text"
        value={node.text}
        rows={3}
        onChange={(event) => onChange(node.id, { text: event.target.value })}
      />
      <label className="field-label" htmlFor="node-notes">备注</label>
      <textarea
        id="node-notes"
        value={node.notes || ''}
        rows={5}
        placeholder="补充背景、链接或说明"
        onChange={(event) => onChange(node.id, { notes: event.target.value })}
      />
      <span className="field-label">分支颜色</span>
      <div className="color-row">
        {COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`设置颜色 ${color}`}
            className={node.color === color ? 'is-active' : ''}
            style={{ '--swatch': color }}
            onClick={() => onChange(node.id, { color })}
          />
        ))}
      </div>
      <div className="inspector-actions">
        <button type="button" onClick={() => onAddChild(node.id)}><Plus size={16} />添加子节点</button>
        {!isRoot && <button type="button" className="danger" onClick={() => onDelete(node.id)}><Trash size={16} />删除节点</button>}
      </div>
    </aside>
  );
}
