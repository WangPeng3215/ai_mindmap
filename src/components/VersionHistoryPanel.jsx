import { useState } from 'react';
import {
  ArrowCounterClockwise,
  ClockCounterClockwise,
  X,
} from '@phosphor-icons/react';

const SOURCE_LABELS = {
  manual: '手动编辑',
  codex: 'Codex',
  agent: '页面 AI',
  restore: '历史恢复',
  unknown: '系统更新',
};

function formatTime(value) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function VersionHistoryPanel({
  snapshots,
  currentRevision,
  loading,
  busyId,
  onRefresh,
  onRestore,
  onClose,
}) {
  const [confirmId, setConfirmId] = useState(null);

  return (
    <aside className="version-history" aria-label="历史版本">
      <div className="version-history-header">
        <div>
          <span>历史版本</span>
          <h3>当前版本 v{currentRevision}</h3>
        </div>
        <button type="button" aria-label="关闭历史版本" onClick={onClose}><X size={17} /></button>
      </div>

      <div className="history-current">
        <ClockCounterClockwise size={18} />
        <div>
          <strong>自动快照已开启</strong>
          <span>每次写入前保存上一版本</span>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading}>刷新</button>
      </div>

      <div className="history-list">
        {loading && <div className="history-empty">正在读取历史版本…</div>}
        {!loading && snapshots.length === 0 && (
          <div className="history-empty">完成下一次编辑后，这里会出现可恢复的历史版本。</div>
        )}
        {!loading && snapshots.map((snapshot) => (
          <article className="history-item" key={snapshot.id}>
            <div className="history-item-top">
              <strong>v{snapshot.revision}</strong>
              <span>{SOURCE_LABELS[snapshot.source] || snapshot.source}</span>
            </div>
            <h4>{snapshot.title}</h4>
            <p>{snapshot.reason}</p>
            <div className="history-meta">
              <span>{formatTime(snapshot.createdAt)}</span>
              <span>{snapshot.nodeCount} 个节点</span>
            </div>
            {confirmId === snapshot.id ? (
              <div className="history-confirm">
                <span>恢复前会先保存当前版本</span>
                <div>
                  <button type="button" onClick={() => setConfirmId(null)}>取消</button>
                  <button
                    type="button"
                    className="restore-confirm-button"
                    disabled={Boolean(busyId)}
                    onClick={async () => {
                      await onRestore(snapshot.id);
                      setConfirmId(null);
                    }}
                  >确认恢复</button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="restore-button"
                disabled={Boolean(busyId)}
                onClick={() => setConfirmId(snapshot.id)}
              ><ArrowCounterClockwise size={14} />恢复此版本</button>
            )}
          </article>
        ))}
      </div>
    </aside>
  );
}
