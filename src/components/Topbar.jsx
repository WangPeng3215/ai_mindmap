import { useState } from 'react';
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowsOut,
  ClockCounterClockwise,
  DownloadSimple,
  SidebarSimple,
  TreeStructure,
  UploadSimple,
} from '@phosphor-icons/react';

function IconButton({ label, children, disabled, onClick, showLabel = true, keepLabelOnNarrow = false }) {
  return (
    <button
      className={`icon-button ${keepLabelOnNarrow ? 'keep-label-on-narrow' : ''}`}
      type="button"
      title={label}
      data-tooltip={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
      {showLabel && <span className="icon-button-label">{label}</span>}
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
  layoutMode,
  onLayoutModeChange,
  onFit,
  onImport,
  onExport,
  onHistory,
  panelOpen,
  onTogglePanel,
  readOnly = false,
}) {
  const [exportOpen, setExportOpen] = useState(false);
  const statusLabel = saveStatus === 'saving' ? '正在保存' : saveStatus === 'error' ? '保存失败' : '已保存到本地';
  return (
    <header className={`topbar ${readOnly ? 'is-read-only' : ''}`}>
      <div className="brand-mark"><TreeStructure size={20} weight="bold" /></div>
      <input
        className="document-title"
        aria-label="脑图标题"
        value={title}
        readOnly={readOnly}
        onChange={(event) => onTitleChange(event.target.value)}
      />
      <span className={`save-status status-${saveStatus}`}><i />{statusLabel}</span>
      <div className="topbar-spacer" />
      <div className="tool-group undo-group">
        <IconButton label="撤销" disabled={!canUndo} onClick={onUndo}><ArrowCounterClockwise size={18} /></IconButton>
        <IconButton label="重做" disabled={!canRedo} onClick={onRedo}><ArrowClockwise size={18} /></IconButton>
      </div>
      <div className="tool-group canvas-tool-group">
        <select
          className="layout-select"
          aria-label="思维导图布局"
          value={layoutMode}
          disabled={readOnly}
          onChange={(event) => onLayoutModeChange(event.target.value)}
        >
          <option value="left-right">左右布局</option>
          <option value="top-bottom">上下布局</option>
          <option value="architecture">架构图</option>
        </select>
        <IconButton label="自动布局" onClick={onLayout}><TreeStructure size={18} /></IconButton>
        <IconButton label="适应画布" onClick={onFit}><ArrowsOut size={18} /></IconButton>
        <IconButton label="导入 JSON" keepLabelOnNarrow onClick={onImport}><DownloadSimple size={18} /></IconButton>
        <div className="export-menu-wrap">
          <IconButton label="导出" keepLabelOnNarrow onClick={() => setExportOpen((value) => !value)}><UploadSimple size={18} /></IconButton>
          {exportOpen && (
            <div className="export-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { onExport('json'); setExportOpen(false); }}>JSON 数据</button>
              <button type="button" role="menuitem" onClick={() => { onExport('svg'); setExportOpen(false); }}>SVG 矢量图</button>
              <button type="button" role="menuitem" onClick={() => { onExport('png'); setExportOpen(false); }}>PNG 图片</button>
              <button type="button" role="menuitem" onClick={() => { onExport('markdown'); setExportOpen(false); }}>Markdown 大纲</button>
            </div>
          )}
        </div>
      </div>
      <IconButton label="历史版本" onClick={onHistory}><ClockCounterClockwise size={19} /></IconButton>
      <IconButton label={panelOpen ? '收起 AI 面板' : '打开 AI 面板'} onClick={onTogglePanel}>
        <SidebarSimple size={19} mirrored={!panelOpen} />
      </IconButton>
    </header>
  );
}
