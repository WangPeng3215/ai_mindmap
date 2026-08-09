import { DEFAULT_NODE_STYLE } from './mindmap.js';

export const DEFAULT_THEME = {
  presetId: 'classic',
  background: '#f7f7f4',
  gridColor: '#d8d9d5',
  fontFamily: '"Segoe UI Variable", "PingFang SC", "Microsoft YaHei", sans-serif',
  palette: ['#ef6a4c', '#df9b34', '#4d9b72', '#4f7dc9', '#8a67b3', '#60645f'],
  branchStrategy: 'global',
  defaultNodeStyle: {},
  rootNodeStyle: {
    fill: '#292b28', border: '#292b28', textColor: '#ffffff',
    width: 178, height: 52, fontSize: 15, fontWeight: 700,
  },
};

export const THEME_PRESETS = [
  { id: 'classic', name: '经典', theme: DEFAULT_THEME },
  {
    id: 'clear', name: '清晰', theme: {
      background: '#eef2f5', gridColor: '#cdd5dc', fontFamily: 'Arial, "PingFang SC", sans-serif',
      palette: ['#d94f4f', '#cc8a25', '#26835f', '#3478c5', '#8157a6', '#52606b'],
      branchStrategy: 'branch',
      defaultNodeStyle: { fill: '#ffffff', border: '#c7d0d8', radius: 6, textColor: '#17212b' },
      rootNodeStyle: { fill: '#17212b', border: '#17212b', textColor: '#ffffff' },
    },
  },
  {
    id: 'night', name: '夜间', theme: {
      background: '#171918', gridColor: '#343936', fontFamily: '"Segoe UI Variable", "PingFang SC", sans-serif',
      palette: ['#ff7661', '#e6ad45', '#5fbc88', '#67a0ef', '#a986d0', '#a1aaa4'],
      branchStrategy: 'rainbow',
      defaultNodeStyle: { fill: '#272b28', border: '#4a504c', radius: 8, textColor: '#f3f5f3' },
      rootNodeStyle: { fill: '#f3f5f3', border: '#f3f5f3', textColor: '#171918' },
    },
  },
];

export function resolveTheme(input = {}) {
  return {
    ...DEFAULT_THEME,
    ...input,
    palette: Array.isArray(input.palette) && input.palette.length ? input.palette : DEFAULT_THEME.palette,
    defaultNodeStyle: { ...DEFAULT_THEME.defaultNodeStyle, ...(input.defaultNodeStyle || {}) },
    rootNodeStyle: { ...DEFAULT_THEME.rootNodeStyle, ...(input.rootNodeStyle || {}) },
  };
}

export function resolveNodeStyle(node, themeInput, isRoot = false) {
  const theme = resolveTheme(themeInput);
  return {
    ...DEFAULT_NODE_STYLE,
    ...(isRoot ? theme.rootNodeStyle : theme.defaultNodeStyle),
    fontFamily: theme.fontFamily,
    ...(node.style || {}),
  };
}

export function rootBranchId(document, id) {
  if (!document.nodes[id] || id === document.rootId) return null;
  let current = document.nodes[id];
  while (current.parentId && current.parentId !== document.rootId) current = document.nodes[current.parentId];
  return current.parentId === document.rootId ? current.id : null;
}

export function resolveBranchColor(document, id, themeInput) {
  const theme = resolveTheme(themeInput);
  const branchId = rootBranchId(document, id);
  const branch = branchId ? document.nodes[branchId] : null;
  if (theme.branchStrategy === 'rainbow' && branchId) {
    const index = document.nodes[document.rootId].children.indexOf(branchId);
    return theme.palette[Math.max(0, index) % theme.palette.length];
  }
  if (theme.branchStrategy === 'branch') return branch?.color || theme.palette[0];
  return document.edgeStyle?.color || '#a7a9a5';
}

export function themeFromPreset(id) {
  const preset = THEME_PRESETS.find((item) => item.id === id) || THEME_PRESETS[0];
  return resolveTheme({ ...preset.theme, presetId: preset.id });
}