import { useState } from 'react';
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowsOut,
  BracketsCurly,
  ClockCounterClockwise,
  CopySimple,
  DownloadSimple,
  DotsThree,
  LinkSimple,
  Palette,
  Plus,
  Package,
  SelectionAll,
  Trash,
  SidebarSimple,
  TreeStructure,
  UploadSimple,
} from '@phosphor-icons/react';

function IconButton({
  label,
  children,
  disabled,
  highlighted = false,
  onClick,
  showLabel = true,
  keepLabelOnNarrow = false,
}) {
  return (
    <button
      className={`icon-button ${keepLabelOnNarrow ? 'keep-label-on-narrow' : ''} ${highlighted ? 'is-highlighted' : ''}`}
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
  canvases,
  activeCanvasId,
  onActivateCanvas,
  onCreateCanvas,
  onDuplicateCanvas,
  onDeleteCanvas,
  onExportWorkspace,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  canAddBoundary,
  canAddSummary,
  canAddRelationship,
  onAddBoundary,
  onAddSummary,
  onAddRelationship,
  onLayout,
  layoutMode,
  onLayoutModeChange,
  onFit,
  onImport,
  onExport,
  onHistory,
  themeOpen,
  onToggleTheme,
  panelOpen,
  onTogglePanel,
  readOnly = false,
}) {
  const [exportOpen, setExportOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
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
      <div className="tool-group canvas-switcher">
        <select aria-label="当前画布" value={activeCanvasId || ''} disabled={readOnly} onChange={(event) => onActivateCanvas(event.target.value)}>
          {(canvases || []).map((canvas) => <option key={canvas.id} value={canvas.id}>{canvas.title}</option>)}
        </select>
        <div className="workspace-menu-wrap">
          <IconButton label="画布菜单" showLabel={false} disabled={readOnly} onClick={() => setWorkspaceOpen((value) => !value)}><DotsThree size={19} weight="bold" /></IconButton>
          {workspaceOpen && (
            <div className="workspace-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { onCreateCanvas(); setWorkspaceOpen(false); }}><Plus size={16} />新建画布</button>
              <button type="button" role="menuitem" disabled={!activeCanvasId} onClick={() => { onDuplicateCanvas(); setWorkspaceOpen(false); }}><CopySimple size={16} />复制画布</button>
              <button type="button" role="menuitem" onClick={() => { onExportWorkspace(); setWorkspaceOpen(false); }}><Package size={16} />导出工作区</button>
              <button type="button" role="menuitem" className="danger-menu-item" disabled={(canvases || []).length <= 1} onClick={() => { onDeleteCanvas(); setWorkspaceOpen(false); }}><Trash size={16} />删除当前画布</button>
            </div>
          )}
        </div>
      </div>
      <div className="topbar-spacer" />
      <div className="tool-group undo-group">
        <IconButton label="撤销" disabled={!canUndo} onClick={onUndo}><ArrowCounterClockwise size={18} /></IconButton>
        <IconButton label="重做" disabled={!canRedo} onClick={onRedo}><ArrowClockwise size={18} /></IconButton>
      </div>
      <div className="tool-group expression-tool-group">
        <IconButton label="外框" disabled={readOnly || !canAddBoundary} highlighted={canAddBoundary} onClick={onAddBoundary}><SelectionAll size={18} /></IconButton>
        <IconButton label="概要" disabled={readOnly || !canAddSummary} highlighted={canAddSummary} onClick={onAddSummary}><BracketsCurly size={18} /></IconButton>
        <IconButton label="连接线" disabled={readOnly || !canAddRelationship} highlighted={canAddRelationship} onClick={onAddRelationship}><LinkSimple size={18} /></IconButton>
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
      <IconButton label={themeOpen ? '关闭主题' : '全局主题'} onClick={onToggleTheme}><Palette size={19} /></IconButton>
      <IconButton label="历史版本" onClick={onHistory}><ClockCounterClockwise size={19} /></IconButton>
      <IconButton label={panelOpen ? '收起 AI 面板' : '打开 AI 面板'} onClick={onTogglePanel}>
        <SidebarSimple size={19} mirrored={!panelOpen} />
      </IconButton>
    </header>
  );
}
