import { getLayoutMode, layoutDocument, LAYOUT_MODES } from '../domain/layout.js';

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

function nodeMetrics(node, isRoot) {
  const lines = textLines(node.text, isRoot ? 18 : 16);
  const longest = Math.max(...lines.map((line) => line.length), 1);
  return {
    width: Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, longest * (isRoot ? 15 : 13) + (isRoot ? 36 : 30))),
    height: (isRoot ? 52 : 38) + Math.max(0, lines.length - 1) * 18,
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
  const nodes = ids.map((id) => {
    const node = document.nodes[id];
    const metrics = nodeMetrics(node, id === document.rootId);
    return { id, node, ...metrics, x: positions[id].x, y: positions[id].y, isRoot: id === document.rootId };
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges = [];
  for (const item of nodes) {
    if (!item.node.parentId || !byId.has(item.node.parentId)) continue;
    edges.push({ from: byId.get(item.node.parentId), to: item });
  }
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));
  const offsetX = OUTER_PADDING - minX;
  const offsetY = OUTER_PADDING - minY;
  return {
    layout,
    nodes,
    edges,
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
  const background = `<rect width="100%" height="100%" fill="#f7f7f4"/>`;
  const edges = model.edges.map((edge) => (
    `<path d="${edgePath(edge, model)}" fill="none" stroke="${escapeXml(edge.to.node.color || '#a7a9a5')}" stroke-width="2" stroke-linecap="round"/>`
  )).join('');
  const nodes = model.nodes.map((item) => {
    const x = item.x + model.offsetX;
    const y = item.y + model.offsetY;
    const fill = item.isRoot ? '#292b28' : '#ffffff';
    const stroke = item.isRoot ? '#292b28' : (item.node.color || '#d4d6d0');
    const textColor = item.isRoot ? '#ffffff' : '#30332f';
    const firstY = y + item.height / 2 - ((item.lines.length - 1) * 18) / 2 + 5;
    const labels = item.lines.map((line, index) => (
      `<text x="${x + item.width / 2}" y="${firstY + index * 18}" text-anchor="middle" fill="${textColor}" font-family="Segoe UI, PingFang SC, Microsoft YaHei, sans-serif" font-size="${item.isRoot ? 15 : 13}" font-weight="${item.isRoot ? 700 : 600}">${escapeXml(line)}</text>`
    )).join('');
    return `<g><rect x="${x}" y="${y}" width="${item.width}" height="${item.height}" rx="9" fill="${fill}" stroke="${escapeXml(stroke)}" stroke-width="1.5"/>${labels}</g>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${model.width}" height="${model.height}" viewBox="0 0 ${model.width} ${model.height}"><title>${escapeXml(document.title || '思维导图')}</title>${background}${edges}${nodes}</svg>`;
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
