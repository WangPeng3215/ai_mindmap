import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle,
  Clock,
  Copy,
  Eye,
  EyeSlash,
  GitBranch,
  PaperPlaneRight,
  PlugsConnected,
  Robot,
  TreeStructure,
  WarningCircle,
  X,
} from '@phosphor-icons/react';

const OPERATION_LABELS = {
  add_node: '新增',
  update_node: '修改',
  move_node: '移动',
  delete_node: '删除',
  add_relationship: '新增连接线',
  update_relationship: '修改连接线',
  delete_relationship: '删除连接线',
  add_boundary: '新增外框',
  update_boundary: '修改外框',
  delete_boundary: '删除外框',
  add_summary: '新增概要',
  update_summary: '修改概要',
  delete_summary: '删除概要',
};

function operationText(operation, document) {
  const current = document?.nodes?.[operation.id];
  if (operation.type === 'add_node') return `新增：${operation.node?.text || operation.node?.id || '节点'}`;
  if (operation.type === 'update_node') {
    const nextText = operation.patch?.text;
    return nextText && current?.text ? `${current.text} → ${nextText}` : `更新：${current?.text || operation.id}`;
  }
  if (operation.type === 'move_node') return `移动：${current?.text || operation.id}`;
  if (operation.type === 'delete_node') return `删除：${current?.text || operation.id}`;
  if (operation.type.includes('relationship')) {
    return `${OPERATION_LABELS[operation.type]}：${operation.relationship?.label || operation.patch?.label || operation.id || '节点关系'}`;
  }
  if (operation.type.includes('boundary')) {
    return `${OPERATION_LABELS[operation.type]}：${operation.boundary?.label || operation.patch?.label || operation.id || '节点范围'}`;
  }
  if (operation.type.includes('summary')) {
    return `${OPERATION_LABELS[operation.type]}：${operation.summary?.text || operation.patch?.text || operation.id || '节点概要'}`;
  }
  return operation.id || '未知修改';
}

function selectedIndexesFor(request, selectedOperations) {
  if (!request.proposal?.operations) return undefined;
  return selectedOperations[request.id]
    || request.proposal.operations.map((_operation, index) => index);
}

function ProposalSummary({ request, document, selectedIndexes, onToggleOperation }) {
  const summary = request.summary;
  if (!summary) return null;
  if (summary.kind === 'document') {
    return (
      <div className="proposal-summary proposal-warning">
        <WarningCircle size={15} />
        <span>{summary.label}{summary.nodeCount ? ` · ${summary.nodeCount} 个节点` : ''}</span>
      </div>
    );
  }

  const operations = request.proposal?.operations || [];
  const visibleOperations = operations.slice(0, 40);
  return (
    <div className="proposal-summary">
      <div className="proposal-counts">
        {Object.entries(summary.counts || {}).filter(([, count]) => count > 0).map(([type, count]) => (
          <span key={type}>{OPERATION_LABELS[type] || type} {count}</span>
        ))}
      </div>
      <div className="proposal-items">
        {visibleOperations.map((operation, index) => {
          const checked = selectedIndexes?.includes(index);
          return (
            <label className={`proposal-operation ${checked ? '' : 'is-skipped'}`} key={`${operation.type}-${operation.id || operation.node?.id}-${index}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleOperation?.(request, index)}
              />
              <b>{OPERATION_LABELS[operation.type] || operation.type}</b>
              <span>{operationText(operation, document)}</span>
            </label>
          );
        })}
        {operations.length > 40 && <small>还有 {operations.length - 40} 项修改</small>}
      </div>
    </div>
  );
}

export function AgentPanel({
  requests,
  connected,
  selectedNode,
  document,
  previewRequestId,
  onSubmit,
  onPreview,
  onExitPreview,
  onApply,
  onReject,
}) {
  const [message, setMessage] = useState('');
  const [scope, setScope] = useState('map');
  const [busyId, setBusyId] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedOperations, setSelectedOperations] = useState({});
  const sortedRequests = useMemo(() => [...requests].reverse(), [requests]);

  useEffect(() => {
    setSelectedOperations((current) => {
      const next = { ...current };
      for (const request of requests) {
        if (request.status === 'review' && request.proposal?.operations && !next[request.id]) {
          next[request.id] = request.proposal.operations.map((_operation, index) => index);
        }
      }
      return next;
    });
  }, [requests]);

  useEffect(() => {
    if (!selectedNode && scope === 'branch') setScope('map');
  }, [scope, selectedNode]);

  async function submit() {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      await onSubmit(message.trim(), {
        scope,
        ...(scope === 'branch' ? { targetNodeId: selectedNode.id } : {}),
      });
      setMessage('');
    } finally {
      setSending(false);
    }
  }

  async function runAction(id, action, indexes) {
    setBusyId(id);
    try {
      await action(id, indexes);
    } finally {
      setBusyId('');
    }
  }

  function toggleOperation(request, index) {
    const current = selectedIndexesFor(request, selectedOperations) || [];
    const next = current.includes(index)
      ? current.filter((item) => item !== index)
      : [...current, index].sort((left, right) => left - right);
    setSelectedOperations((items) => ({ ...items, [request.id]: next }));
    if (previewRequestId === request.id) onPreview(request, next);
  }

  return (
    <aside className="agent-panel">
      <div className="agent-header">
        <div className="agent-avatar"><Robot size={20} weight="fill" /></div>
        <div>
          <h2>备用 AI 分析入口</h2>
          <p className={connected ? 'is-online' : ''}>
            <span />{connected ? '本地接口已连接' : '正在连接本地接口'}
          </p>
        </div>
      </div>

      <div className="conversation">
        <div className="assistant-message">
          <div className="message-icon"><PlugsConnected size={16} /></div>
          <div>
            <p>此入口用于未接入 Codex 时提交需求。当前不会自动调用模型；Codex 提交的方案也会在这里等待你审核。</p>
            <button
              type="button"
              className="copy-command"
              onClick={() => navigator.clipboard?.writeText('npm run mindmap -- pending')}
            >
              <Copy size={14} />复制领取命令
            </button>
          </div>
        </div>

        {sortedRequests.map((request) => {
          const selectedIndexes = selectedIndexesFor(request, selectedOperations);
          const isPreviewing = previewRequestId === request.id;
          const isOperationProposal = request.proposal?.operations;
          return (
            <div className="request-thread" key={request.id}>
              <div className="request-scope">
                {request.scope === 'branch' ? <GitBranch size={12} /> : <TreeStructure size={12} />}
                <span>{request.source === 'codex' ? 'Codex' : '页面请求'}</span>
                <span>·</span>
                {request.scope === 'branch' ? `分支：${request.targetNodeText || request.targetNodeId}` : '整张脑图'}
              </div>
              <div className="user-message">{request.message}</div>

              {request.status === 'review' ? (
                <div className="review-panel">
                  <div className="request-state state-review"><WarningCircle size={15} /><span>AI 修改待确认</span></div>
                  {request.reply && <p className="proposal-reply">{request.reply}</p>}
                  <ProposalSummary
                    request={request}
                    document={document}
                    selectedIndexes={selectedIndexes}
                    onToggleOperation={isOperationProposal ? toggleOperation : undefined}
                  />
                  <div className="review-actions">
                    <button
                      type="button"
                      className={isPreviewing ? '' : 'apply-button'}
                      disabled={busyId === request.id}
                      onClick={() => isPreviewing ? onExitPreview() : onPreview(request, selectedIndexes)}
                    >
                      {isPreviewing ? <EyeSlash size={14} /> : <Eye size={14} />}
                      {isPreviewing ? '退出预览' : '预览变化'}
                    </button>
                    <button
                      type="button"
                      className="apply-button"
                      disabled={busyId === request.id || (isOperationProposal && !selectedIndexes?.length)}
                      onClick={() => runAction(request.id, onApply, selectedIndexes)}
                    ><Check size={14} weight="bold" />{isOperationProposal ? '应用所选' : '整体应用'}</button>
                    <button
                      type="button"
                      disabled={busyId === request.id}
                      onClick={() => runAction(request.id, onReject)}
                    ><X size={14} weight="bold" />拒绝</button>
                  </div>
                </div>
              ) : (
                <div className={`request-state state-${request.status}`}>
                  {request.status === 'completed' && <CheckCircle size={15} weight="fill" />}
                  {request.status === 'rejected' && <X size={15} weight="bold" />}
                  {request.status === 'pending' && <Clock size={15} />}
                  <span>
                    {request.status === 'completed' && (request.reply || '修改已应用')}
                    {request.status === 'rejected' && '已拒绝本次修改'}
                    {request.status === 'pending' && '等待 AI 分析'}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="composer-wrap">
        <div className="scope-switch" aria-label="AI 分析范围">
          <button type="button" className={scope === 'map' ? 'is-active' : ''} disabled={Boolean(previewRequestId)} onClick={() => setScope('map')}>
            <TreeStructure size={14} />整图
          </button>
          <button
            type="button"
            className={scope === 'branch' ? 'is-active' : ''}
            disabled={!selectedNode || Boolean(previewRequestId)}
            title={selectedNode ? `分析分支：${selectedNode.text}` : '请先选择一个节点'}
            onClick={() => setScope('branch')}
          >
            <GitBranch size={14} />选中分支
          </button>
        </div>
        {scope === 'branch' && selectedNode && <div className="scope-target">{selectedNode.text}</div>}
        <textarea
          value={message}
          disabled={Boolean(previewRequestId)}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={scope === 'branch' ? '例如：扩展这个分支，补充风险和行动项' : '例如：帮我拆解一个 AI 产品的 MVP'}
          rows={4}
        />
        <div className="composer-footer">
          <span>Enter 发送 · Shift + Enter 换行</span>
          <button type="button" aria-label="发送请求" onClick={submit} disabled={!message.trim() || sending}>
            <PaperPlaneRight size={17} weight="fill" />
          </button>
        </div>
      </div>
    </aside>
  );
}
