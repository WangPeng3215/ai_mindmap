import { useMemo, useState } from 'react';
import {
  CheckCircle,
  Clock,
  Copy,
  PaperPlaneRight,
  PlugsConnected,
  Robot,
} from '@phosphor-icons/react';

export function AgentPanel({ requests, connected, onSubmit }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const sortedRequests = useMemo(() => [...requests].reverse(), [requests]);

  async function submit() {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      await onSubmit(message.trim());
      setMessage('');
    } finally {
      setSending(false);
    }
  }

  return (
    <aside className="agent-panel">
      <div className="agent-header">
        <div className="agent-avatar"><Robot size={20} weight="fill" /></div>
        <div>
          <h2>AI 分析工作台</h2>
          <p className={connected ? 'is-online' : ''}>
            <span />{connected ? '本地接口已连接' : '正在连接本地接口'}
          </p>
        </div>
      </div>

      <div className="conversation">
        <div className="assistant-message">
          <div className="message-icon"><PlugsConnected size={16} /></div>
          <div>
            <p>描述你的目标、背景和约束。我会把需求放进本地队列，供 Codex、Claude Code 等智能体分析并回传脑图。</p>
            <button
              type="button"
              className="copy-command"
              onClick={() => navigator.clipboard?.writeText('npm run mindmap -- pending')}
            >
              <Copy size={14} />复制领取命令
            </button>
          </div>
        </div>

        {sortedRequests.map((request) => (
          <div className="request-thread" key={request.id}>
            <div className="user-message">{request.message}</div>
            <div className={`request-state state-${request.status}`}>
              {request.status === 'completed' ? <CheckCircle size={15} weight="fill" /> : <Clock size={15} />}
              <span>{request.status === 'completed' ? request.reply || '脑图已更新' : '等待智能体处理'}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="composer-wrap">
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="例如：帮我拆解一个 AI 写作产品的 MVP…"
          rows={4}
        />
        <div className="composer-footer">
          <span>Enter 发送 · Shift + Enter 换行</span>
          <button type="button" aria-label="发送需求" onClick={submit} disabled={!message.trim() || sending}>
            <PaperPlaneRight size={17} weight="fill" />
          </button>
        </div>
      </div>
    </aside>
  );
}
