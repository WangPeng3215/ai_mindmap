import { getLayoutMode, layoutDocument, LAYOUT_MODES } from '../domain/layout.js';
import { resolveBranchColor, resolveNodeStyle, resolveTheme } from '../domain/theme.js';

const NODE_GAP = 26;
const OUTER_PADDING = 42;
const MIN_NODE_WIDTH = 126;
const MAX_NODE_WIDTH = 220;

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function textLines(value, maxChars) {
  const text = String(value || '').trim() || '未命名节点';
  const lines = [];
  let line = '';
  for (const character of text) {
    if (line.length >= maxChars) {
      lines.push(line);
      line = '';
    }
    line += character;
  }
  if (line) lines.push(line);
  return lines;
}

function nodeMetrics(node, isRoot, style) {
  const lines = textLines(node.text, isRoot ? 18 : 16);
  const longest = Math.max(...lines.map((line) => line.length), 1);
  return {
    width: Number(style.width) || Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, longest * (isRoot ? 15 : 13) + (isRoot ? 36 : 30))),
    height: Math.max(Number(style.height) || 0, (isRoot ? 52 : 38) + Math.max(0, lines.length - 1) * 18),
    lines,
  };
}

function visibleIds(document) {
  const result = [];
  function visit(id) {
    result.push(id);
    const node = document.nodes[id];
    if (!node.collapsed) node.children.forEach(visit);
  }
  visit(document.rootId);
  return result;
}

function createExportModel(document) {
  const layout = getLayoutMode(document);
  const positions = layoutDocument(document, { force: true, layout });
  const ids = visibleIds(document);
  const theme = resolveTheme(document.theme);
  const nodes = ids.map((id) => {
    const node = document.nodes[id];
    const isRoot = id === document.rootId;
    const nodeStyle = resolveNodeStyle(node, theme, isRoot);
    const metrics = nodeMetrics(node, isRoot, nodeStyle);
    return { id, node, nodeStyle, ...metrics, x: positions[id].x, y: positions[id].y, isRoot };
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges = [];
  for (const item of nodes) {
    if (!item.node.parentId || !byId.has(item.node.parentId)) continue;
    edges.push({ from: byId.get(item.node.parentId), to: item, color: resolveBranchColor(document, item.id, theme) });
  }
  function rangeBounds(nodeIds) {
    const items = nodeIds.map((id) => byId.get(id)).filter(Boolean);
    if (items.length !== nodeIds.length) return null;
    const minX = Math.min(...items.map((node) => node.x));
    const minY = Math.min(...items.map((node) => node.y));
    const maxX = Math.max(...items.map((node) => node.x + node.width));
    const maxY = Math.max(...items.map((node) => node.y + node.height));
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  const relationships = (document.relationships || [])
    .filter((item) => byId.has(item.sourceId) && byId.has(item.targetId))
    .map((item) => ({ ...item, from: byId.get(item.sourceId), to: byId.get(item.targetId) }));
  const boundaries = (document.boundaries || [])
    .map((item) => ({ ...item, bounds: rangeBounds(item.nodeIds) }))
    .filter((item) => item.bounds);
  const root = byId.get(document.rootId);
  const summaries = (document.summaries || [])
    .map((item) => ({ ...item, bounds: rangeBounds(item.nodeIds) }))
    .filter((item) => item.bounds)
    .map((item) => ({
      ...item,
      side: layout === LAYOUT_MODES.LEFT_RIGHT && item.bounds.minX + item.bounds.width / 2 < root.x + root.width / 2 ? 'left' : 'right',
    }));

  const extentX = [
    ...nodes.map((node) => [node.x, node.x + node.width]),
    ...boundaries.map((item) => [item.bounds.minX - 18, item.bounds.maxX + 18]),
    ...summaries.map((item) => item.side === 'left'
      ? [item.bounds.minX - 184, item.bounds.maxX]
      : [item.bounds.minX, item.bounds.maxX + 184]),
  ].flat();
  const extentY = [
    ...nodes.map((node) => [node.y, node.y + node.height]),
    ...boundaries.map((item) => [item.bounds.minY - 14, item.bounds.maxY + 14]),
    ...summaries.map((item) => [item.bounds.minY, item.bounds.maxY]),
  ].flat();
  const minX = Math.min(...extentX);
  const minY = Math.min(...extentY);
  const maxX = Math.max(...extentX);
  const maxY = Math.max(...extentY);
  const offsetX = OUTER_PADDING - minX;
  const offsetY = OUTER_PADDING - minY;
  return {
    layout,
    theme,
    nodes,
    edges,
    relationships,
    boundaries,
    summaries,
    width: Math.ceil(maxX - minX + OUTER_PADDING * 2),
    height: Math.ceil(maxY - minY + OUTER_PADDING * 2),
    offsetX,
    offsetY,
  };
}

function edgePath(edge, model) {
  const { from, to } = edge;
  const fromX = from.x + from.width / 2 + model.offsetX;
  const fromY = from.y + from.height / 2 + model.offsetY;
  const toX = to.x + to.width / 2 + model.offsetX;
  const toY = to.y + to.height / 2 + model.offsetY;
  if (model.layout === LAYOUT_MODES.TOP_BOTTOM || model.layout === LAYOUT_MODES.ARCHITECTURE) {
    const startY = from.y + from.height + model.offsetY;
    const endY = to.y + model.offsetY;
    const bend = Math.max(18, Math.abs(endY - startY) * 0.45);
    return `M ${fromX} ${startY} C ${fromX} ${startY + bend}, ${toX} ${endY - bend}, ${toX} ${endY}`;
  }
  const rightward = to.x >= from.x;
  const startX = (rightward ? from.x + from.width : from.x) + model.offsetX;
  const endX = (rightward ? to.x : to.x + to.width) + model.offsetX;
  const bend = Math.max(24, Math.abs(endX - startX) * 0.45);
  return `M ${startX} ${fromY} C ${startX + (rightward ? bend : -bend)} ${fromY}, ${endX - (rightward ? bend : -bend)} ${toY}, ${endX} ${toY}`;
}

export function documentToSvg(document) {
  const model = createExportModel(document);
  const background = `<rect width="100%" height="100%" fill="${escapeXml(model.theme.background)}"/>`;
  const defs = '<defs><marker id="relationship-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/></marker></defs>';
  const boundaries = model.boundaries.map((item) => {
    const x = item.bounds.minX - 18 + model.offsetX;
    const y = item.bounds.minY - 14 + model.offsetY;
    const width = item.bounds.width + 36;
    const height = item.bounds.height + 28;
    const label = item.label
      ? `<text x="${x + 10}" y="${y + 14}" fill="${escapeXml(item.color || '#8b96a0')}" font-size="10" font-weight="650">${escapeXml(item.label)}</text>`
      : '';
    return `<g data-kind="boundary"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10" fill="none" stroke="${escapeXml(item.color || '#8b96a0')}" stroke-width="1.5" stroke-dasharray="6 4"/>${label}</g>`;
  }).join('');
  const summaries = model.summaries.map((item) => {
    const color = escapeXml(item.color || '#ef654f');
    const bracketX = (item.side === 'left' ? item.bounds.minX - 22 : item.bounds.maxX + 22) + model.offsetX;
    const startY = item.bounds.minY + model.offsetY;
    const endY = item.bounds.maxY + model.offsetY;
    const direction = item.side === 'left' ? -1 : 1;
    const labelX = bracketX + direction * 14;
    const anchor = item.side === 'left' ? 'end' : 'start';
    const path = `M ${bracketX - direction * 8} ${startY} Q ${bracketX} ${startY} ${bracketX} ${startY + 8} L ${bracketX} ${endY - 8} Q ${bracketX} ${endY} ${bracketX - direction * 8} ${endY}`;
    return `<g data-kind="summary"><path d="${path}" fill="none" stroke="${color}" stroke-width="2"/><text x="${labelX}" y="${(startY + endY) / 2 + 4}" text-anchor="${anchor}" fill="${color}" font-size="12" font-weight="650">${escapeXml(item.text || '概要')}</text></g>`;
  }).join('');
  const edges = model.edges.map((edge) => (
    `<path d="${edgePath(edge, model)}" fill="none" stroke="${escapeXml(edge.color)}" stroke-width="2" stroke-linecap="round"/>`
  )).join('');
  const relationships = model.relationships.map((item) => {
    const color = escapeXml(item.color || '#ef654f');
    const path = edgePath(item, model);
    const dash = item.lineType === 'dashed' ? ' stroke-dasharray="6 4"' : item.lineType === 'dotted' ? ' stroke-dasharray="2 4"' : '';
    const arrow = item.arrow ? ' marker-end="url(#relationship-arrow)"' : '';
    const fromX = item.from.x + item.from.width / 2 + model.offsetX;
    const fromY = item.from.y + item.from.height / 2 + model.offsetY;
    const toX = item.to.x + item.to.width / 2 + model.offsetX;
    const toY = item.to.y + item.to.height / 2 + model.offsetY;
    const label = item.label
      ? `<text x="${(fromX + toX) / 2}" y="${(fromY + toY) / 2 - 7}" text-anchor="middle" fill="${color}" font-size="11" font-weight="650">${escapeXml(item.label)}</text>`
      : '';
    return `<g data-kind="relationship"><path d="${path}" fill="none" stroke="${color}" stroke-width="1.8"${dash}${arrow}/>${label}</g>`;
  }).join('');
  const nodes = model.nodes.map((item) => {
    const x = item.x + model.offsetX;
    const y = item.y + model.offsetY;
    const fill = item.nodeStyle.fill;
    const stroke = item.nodeStyle.border;
    const textColor = item.nodeStyle.textColor;
    const firstY = y + item.height / 2 - ((item.lines.length - 1) * 18) / 2 + 5;
    const labels = item.lines.map((line, index) => (
      `<text x="${x + item.width / 2}" y="${firstY + index * 18}" text-anchor="middle" fill="${textColor}" font-family="${escapeXml(item.nodeStyle.fontFamily)}" font-size="${item.nodeStyle.fontSize}" font-weight="${item.nodeStyle.fontWeight}">${escapeXml(line)}</text>`
    )).join('');
    return `<g><rect x="${x}" y="${y}" width="${item.width}" height="${item.height}" rx="${item.nodeStyle.shape === 'pill' ? item.height / 2 : item.nodeStyle.radius}" fill="${fill}" stroke="${escapeXml(stroke)}" stroke-width="1.5"/>${labels}</g>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${model.width}" height="${model.height}" viewBox="0 0 ${model.width} ${model.height}"><title>${escapeXml(document.title || '思维导图')}</title>${defs}${background}${boundaries}${edges}${relationships}${summaries}${nodes}</svg>`;
}

export function documentToMarkdown(document) {
  const lines = [`# ${document.title || document.nodes[document.rootId]?.text || '思维导图'}`, ''];
  function visit(id, depth) {
    const node = document.nodes[id];
    lines.push(`${'  '.repeat(depth)}- ${node.text}`);
    if (!node.collapsed) node.children.forEach((childId) => visit(childId, depth + 1));
  }
  visit(document.rootId, 0);
  return `${lines.join('\n')}\n`;
}

export function safeExportName(title, extension) {
  const base = String(title || 'mindmap').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').slice(0, 80) || 'mindmap';
  return `${base}.${extension}`;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = globalThis.document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function downloadPng(document) {
  const svg = documentToSvg(document);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    const maxDimension = 8192;
    const maxPixels = 32_000_000;
    const scale = Math.min(
      2,
      maxDimension / image.width,
      maxDimension / image.height,
      Math.sqrt(maxPixels / (image.width * image.height)),
    );
    const canvas = globalThis.document.createElement('canvas');
    canvas.width = image.width * scale;
    canvas.height = image.height * scale;
    const context = canvas.getContext('2d');
    context.fillStyle = '#f7f7f4';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = await new Promise((resolve, reject) => canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('PNG 导出失败'))), 'image/png'));
    downloadBlob(png, safeExportName(document.title, 'png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}
