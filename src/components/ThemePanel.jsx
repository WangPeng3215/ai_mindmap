import { ArrowCounterClockwise, X } from '@phosphor-icons/react';
import { THEME_PRESETS, resolveTheme } from '../domain/theme.js';

const FONT_OPTIONS = [
  { label: '系统字体', value: '"Segoe UI Variable", "PingFang SC", "Microsoft YaHei", sans-serif' },
  { label: '现代无衬线', value: 'Arial, "PingFang SC", sans-serif' },
  { label: '人文无衬线', value: 'Verdana, "Microsoft YaHei", sans-serif' },
  { label: '衬线字体', value: 'Georgia, "Songti SC", serif' },
];

export function ThemePanel({ theme: inputTheme, onChange, onPreset, onClose }) {
  const theme = resolveTheme(inputTheme);

  function updateDefaultNodeStyle(patch) {
    onChange({ defaultNodeStyle: { ...theme.defaultNodeStyle, ...patch } });
  }

  function updatePalette(index, color) {
    const palette = theme.palette.slice();
    palette[index] = color;
    onChange({ palette });
  }

  return (
    <aside className="theme-panel" aria-label="全局主题">
      <div className="inspector-header">
        <div><span>全局</span><h3>主题与配色</h3></div>
        <button type="button" aria-label="关闭主题面板" onClick={onClose}><X size={17} /></button>
      </div>

      <span className="field-label">主题预设</span>
      <div className="theme-presets">
        {THEME_PRESETS.map((preset) => (
          <button key={preset.id} type="button" className={theme.presetId === preset.id ? 'is-active' : ''} onClick={() => onPreset(preset.id)}>
            <i style={{ background: preset.theme.background }} />{preset.name}
          </button>
        ))}
      </div>

      <div className="style-grid">
        <label>画布背景<input type="color" value={theme.background} onChange={(event) => onChange({ background: event.target.value, presetId: 'custom' })} /></label>
        <label>网格颜色<input type="color" value={theme.gridColor} onChange={(event) => onChange({ gridColor: event.target.value, presetId: 'custom' })} /></label>
      </div>

      <label className="field-label" htmlFor="theme-font">全局字体</label>
      <select id="theme-font" className="theme-select" value={theme.fontFamily} onChange={(event) => onChange({ fontFamily: event.target.value, presetId: 'custom' })}>
        {FONT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>

      <label className="field-label" htmlFor="branch-strategy">分支线策略</label>
      <select id="branch-strategy" className="theme-select" value={theme.branchStrategy} onChange={(event) => onChange({ branchStrategy: event.target.value, presetId: 'custom' })}>
        <option value="global">统一颜色</option>
        <option value="branch">分支颜色</option>
        <option value="rainbow">彩虹分支</option>
      </select>

      <span className="field-label">主题配色</span>
      <div className="theme-palette">
        {theme.palette.map((color, index) => <input key={`${index}-${color}`} type="color" aria-label={`主题颜色 ${index + 1}`} value={color} onChange={(event) => updatePalette(index, event.target.value)} />)}
      </div>

      <span className="field-label">默认节点</span>
      <div className="style-grid">
        <label>填充<input type="color" value={theme.defaultNodeStyle.fill || '#ffffff'} onChange={(event) => updateDefaultNodeStyle({ fill: event.target.value })} /></label>
        <label>文字<input type="color" value={theme.defaultNodeStyle.textColor || '#20221f'} onChange={(event) => updateDefaultNodeStyle({ textColor: event.target.value })} /></label>
        <label>边框<input type="color" value={theme.defaultNodeStyle.border || '#d9dad5'} onChange={(event) => updateDefaultNodeStyle({ border: event.target.value })} /></label>
        <label>圆角<input type="number" min="0" max="40" value={theme.defaultNodeStyle.radius ?? 10} onChange={(event) => updateDefaultNodeStyle({ radius: Number(event.target.value) || 0 })} /></label>
      </div>

      <div className="inspector-actions">
        <button type="button" onClick={() => onPreset('classic')}><ArrowCounterClockwise size={16} />恢复经典主题</button>
      </div>
    </aside>
  );
}