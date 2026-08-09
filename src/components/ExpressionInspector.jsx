import { ArrowsClockwise, Trash, X } from '@phosphor-icons/react';

const TITLES = {
  relationship: '连接线',
  boundary: '外框',
  summary: '概要',
};

export function ExpressionInspector({
  type,
  expression,
  selectedNodeIds,
  canReplaceRange,
  canReplaceRelationship,
  onChange,
  onDelete,
  onClose,
}) {
  if (!expression) return null;
  const isRelationship = type === 'relationship';
  const isSummary = type === 'summary';
  const labelKey = isSummary ? 'text' : 'label';
  const label = expression[labelKey] || '';

  return (
    <aside className="inspector expression-inspector">
      <div className="inspector-header">
        <div><span>关系表达</span><h3>{TITLES[type]}</h3></div>
        <button type="button" aria-label="关闭关系编辑" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="inspector-scroll">
        <section className="inspector-section-body expression-fields">
          <label className="field-label" htmlFor="expression-label">{isSummary ? '概要标题' : '文字'}</label>
          <input
            id="expression-label"
            className="expression-text-input"
            value={label}
            placeholder={isSummary ? '概要' : '可选文字'}
            onChange={(event) => onChange({ [labelKey]: event.target.value })}
          />
          <label className="field-label" htmlFor="expression-color">颜色</label>
          <input
            id="expression-color"
            className="expression-color-input"
            type="color"
            value={expression.color || (type === 'boundary' ? '#8b96a0' : '#ef654f')}
            onChange={(event) => onChange({ color: event.target.value })}
          />
          {isRelationship && (
            <>
              <label className="field-label" htmlFor="relationship-line-type">线型</label>
              <select
                id="relationship-line-type"
                className="theme-select"
                value={expression.lineType || 'dashed'}
                onChange={(event) => onChange({ lineType: event.target.value })}
              >
                <option value="solid">实线</option>
                <option value="dashed">虚线</option>
                <option value="dotted">点线</option>
              </select>
              <label className="expression-checkbox">
                <input
                  type="checkbox"
                  checked={expression.arrow !== false}
                  onChange={(event) => onChange({ arrow: event.target.checked })}
                />
                显示箭头
              </label>
            </>
          )}
          <button
            type="button"
            className="replace-range-button"
            disabled={isRelationship ? !canReplaceRelationship : !canReplaceRange}
            onClick={() => onChange(isRelationship
              ? { sourceId: selectedNodeIds[0], targetId: selectedNodeIds[1] }
              : { nodeIds: selectedNodeIds })}
          >
            <ArrowsClockwise size={15} />
            {isRelationship ? '使用当前两个节点' : '使用当前选择范围'}
          </button>
        </section>
      </div>
      <div className="inspector-actions expression-actions">
        <button type="button" className="danger" onClick={onDelete}><Trash size={15} />删除{TITLES[type]}</button>
      </div>
    </aside>
  );
}
