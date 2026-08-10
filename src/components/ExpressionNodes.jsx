import { memo, useEffect, useRef, useState } from 'react';

function BoundaryNodeComponent({ data, selected }) {
  const { boundary } = data;
  return (
    <div
      className={`boundary-decoration ${selected ? 'is-selected' : ''}`}
      style={{ '--expression-color': boundary.color || '#8b96a0' }}
    >
      {boundary.label && <span>{boundary.label}</span>}
    </div>
  );
}

function SummaryNodeComponent({ data, selected }) {
  const { summary, side, onEditExpression, onFinishExpressionEdit, onStartSummaryEdit, previewMode, forceEditing } = data;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(summary.text || '概要');
  const inputRef = useRef(null);
  const editingStartedAtRef = useRef(0);

  useEffect(() => setDraft(summary.text || '概要'), [summary.text]);
  useEffect(() => { if (forceEditing) startEditing(); }, [forceEditing]);
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commit() {
    const value = draft.trim() || '概要';
    setEditing(false);
    onFinishExpressionEdit?.();
    if (value !== summary.text) onEditExpression?.('summary', summary.id, { text: value });
  }

  function startEditing() {
    editingStartedAtRef.current = Date.now();
    setEditing(true);
  }

  return (
    <div
      className={`summary-decoration side-${side} ${selected ? 'is-selected' : ''}`}
      style={{ '--expression-color': summary.color || '#ef654f' }}
      onDoubleClick={(event) => {
        onStartSummaryEdit?.();
        if (!previewMode) startEditing();
      }}
    >
      <i aria-hidden="true" />
      {editing ? (
        <input
          ref={inputRef}
          className="summary-edit-input nodrag"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (Date.now() - editingStartedAtRef.current < 250) {
              requestAnimationFrame(() => inputRef.current?.focus());
              return;
            }
            commit();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
            if (event.key === 'Escape') {
              setDraft(summary.text || '概要');
              setEditing(false);
              onFinishExpressionEdit?.();
            }
          }}
        />
      ) : (
        <span>{summary.text || '概要'}</span>
      )}
    </div>
  );
}

export const BoundaryNode = memo(BoundaryNodeComponent);
export const SummaryNode = memo(SummaryNodeComponent);
