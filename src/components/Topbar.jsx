import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowsOut,
  DownloadSimple,
  SidebarSimple,
  TreeStructure,
  UploadSimple,
} from '@phosphor-icons/react';

function IconButton({ label, children, disabled, onClick }) {
  return (
    <button className="icon-button" type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

export function Topbar({
  title,
  onTitleChange,
  saveStatus,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onLayout,
  onFit,
  onImport,
  onExport,
  panelOpen,
  onTogglePanel,
}) {
  const statusLabel = saveStatus === 'saving' ? '正在保存' : saveStatus === 'error' ? '保存失败' : '已保存到本地';
  return (
    <header className="topbar">
      <div className="brand-mark"><TreeStructure size={20} weight="bold" /></div>
      <input
        className="document-title"
        aria-label="脑图标题"
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
      />
      <span className={`save-status status-${saveStatus}`}><i />{statusLabel}</span>
      <div className="topbar-spacer" />
      <div className="tool-group">
        <IconButton label="撤销" disabled={!canUndo} onClick={onUndo}><ArrowCounterClockwise size={18} /></IconButton>
        <IconButton label="重做" disabled={!canRedo} onClick={onRedo}><ArrowClockwise size={18} /></IconButton>
      </div>
      <div className="tool-group">
        <IconButton label="自动布局" onClick={onLayout}><TreeStructure size={18} /></IconButton>
        <IconButton label="适应画布" onClick={onFit}><ArrowsOut size={18} /></IconButton>
        <IconButton label="导入 JSON" onClick={onImport}><UploadSimple size={18} /></IconButton>
        <IconButton label="导出 JSON" onClick={onExport}><DownloadSimple size={18} /></IconButton>
      </div>
      <IconButton label={panelOpen ? '收起 AI 面板' : '打开 AI 面板'} onClick={onTogglePanel}>
        <SidebarSimple size={19} mirrored={!panelOpen} />
      </IconButton>
    </header>
  );
}
