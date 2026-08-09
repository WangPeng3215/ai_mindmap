import { ArrowCounterClockwise, Plus, Trash, X } from '@phosphor-icons/react';

const COLORS = ['#ef6a4c', '#df9b34', '#4d9b72', '#4f7dc9', '#8a67b3', '#60645f'];

export function NodeInspector({ node, isRoot, edgeStyle, onClose, onChange, onEdgeStyleChange, onAddChild, onDelete }) {
  if (!node) return null;
  return (
    <aside className="inspector">
      <div className="inspector-header">
        <div><span>检查器</span><h3>节点</h3></div>
        <button type="button" aria-label="关闭节点面板" onClick={onClose}><X size={17} /></button>
      </div>

      <div className="inspector-scroll">
        <details className="inspector-section" open>
          <summary>内容</summary>
          <div className="inspector-section-body">
            <label className="field-label" htmlFor="node-text">标题</label>
            <textarea id="node-text" value={node.text} rows={3} onChange={(event) => onChange(node.id, { text: event.target.value })} />
            <label className="field-label" htmlFor="node-notes">备注</label>
            <textarea id="node-notes" value={node.notes || ''} rows={4} placeholder="补充背景、链接或说明" onChange={(event) => onChange(node.id, { notes: event.target.value })} />
          </div>
        </details>

        <details className="inspector-section" open>
          <summary>节点样式</summary>
          <div className="inspector-section-body">
            <span className="field-label">分支颜色</span>
            <div className="color-row">
              {COLORS.map((color) => (
                <button key={color} type="button" aria-label={`设置颜色 ${color}`} className={node.color === color ? 'is-active' : ''} style={{ '--swatch': color }} onClick={() => onChange(node.id, { color })} />
              ))}
            </div>
            <span className="field-label">节点形状</span>
            <div className="style-row">
              {['rounded', 'rectangle', 'pill', 'diamond'].map((shape) => (
                <button type="button" key={shape} className={`style-choice ${node.style?.shape === shape ? 'is-active' : ''}`} onClick={() => onChange(node.id, { style: { ...(node.style || {}), shape } })}>{shape === 'rounded' ? '圆角' : shape === 'rectangle' ? '矩形' : shape === 'pill' ? '胶囊' : '菱形'}</button>
              ))}
            </div>
            <div className="style-grid">
              <label>填充<input type="color" value={node.style?.fill || '#ffffff'} onChange={(event) => onChange(node.id, { style: { ...(node.style || {}), fill: event.target.value } })} /></label>
              <label>边框<input type="color" value={node.style?.border || '#d9dad5'} onChange={(event) => onChange(node.id, { style: { ...(node.style || {}), border: event.target.value } })} /></label>
              <label>宽度<input type="number" min="90" max="420" value={node.style?.width || 148} onChange={(event) => onChange(node.id, { style: { ...(node.style || {}), width: Number(event.target.value) || 148 } })} /></label>
              <label>高度<input type="number" min="32" max="180" value={node.style?.height || 48} onChange={(event) => onChange(node.id, { style: { ...(node.style || {}), height: Number(event.target.value) || 48 } })} /></label>
              <label>文字<input type="color" value={node.style?.textColor || '#20221f'} onChange={(event) => onChange(node.id, { style: { ...(node.style || {}), textColor: event.target.value } })} /></label>
              <label>字号<input type="number" min="10" max="32" value={node.style?.fontSize || 12.5} onChange={(event) => onChange(node.id, { style: { ...(node.style || {}), fontSize: Number(event.target.value) || 12.5 } })} /></label>
            </div>
          </div>
        </details>

        <details className="inspector-section">
          <summary>连接线</summary>
          <div className="inspector-section-body">
            <div className="style-grid">
              <label>颜色<input type="color" value={edgeStyle?.color || '#a7a9a5'} onChange={(event) => onEdgeStyleChange({ color: event.target.value })} /></label>
              <label>线宽<input type="number" min="1" max="8" step="0.5" value={edgeStyle?.width || 1.8} onChange={(event) => onEdgeStyleChange({ width: Number(event.target.value) || 1.8 })} /></label>
              <label>线型<select value={edgeStyle?.type || 'smoothstep'} onChange={(event) => onEdgeStyleChange({ type: event.target.value })}><option value="smoothstep">折线</option><option value="solid">直线</option><option value="dashed">虚线</option><option value="dotted">点线</option></select></label>
              <label className="checkbox-field"><input type="checkbox" checked={Boolean(edgeStyle?.arrow)} onChange={(event) => onEdgeStyleChange({ arrow: event.target.checked })} />箭头</label>
            </div>
          </div>
        </details>
      </div>

      <div className="inspector-actions">
        <button type="button" onClick={() => onChange(node.id, { style: undefined, color: undefined })}><ArrowCounterClockwise size={16} />恢复默认</button>
        <button type="button" className="primary-action" onClick={() => onAddChild(node.id)}><Plus size={16} />添加子节点</button>
        {!isRoot && <button type="button" className="danger icon-only-action" aria-label="删除节点" title="删除节点" onClick={() => onDelete(node.id)}><Trash size={16} /></button>}
      </div>
    </aside>
  );
}