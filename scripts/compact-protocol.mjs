const LAYOUT_MODES = new Set(['left-right', 'top-bottom', 'architecture']);

function compactNode(document, id) {
  const node = document.nodes[id];
  return {
    id: node.id,
    text: node.text,
    ...(node.notes ? { notes: node.notes } : {}),
    ...(node.side ? { side: node.side } : {}),
    ...(node.children.length ? { children: node.children.map((childId) => compactNode(document, childId)) } : {}),
  };
}

export function compactDocument(document, nodeId = document.rootId) {
  if (!document?.nodes?.[nodeId]) throw new Error(`节点不存在: ${nodeId}`);
  const branch = nodeId !== document.rootId;
  return {
    revision: document.revision,
    title: document.title,
    layoutMode: document.layoutMode || 'left-right',
    scope: branch ? 'branch' : 'map',
    ...(branch ? { targetNodeId: nodeId } : {}),
    root: compactNode(document, nodeId),
    ...(!branch && document.relationships?.length ? { relationships: document.relationships } : {}),
    ...(!branch && document.boundaries?.length ? { boundaries: document.boundaries } : {}),
    ...(!branch && document.summaries?.length ? { summaries: document.summaries } : {}),
  };
}

function indentationWidth(value) {
  return [...value].reduce((total, character) => total + (character === '\t' ? 2 : 1), 0);
}

export function parseOutline(source, options = {}) {
  if (typeof source !== 'string') throw new Error('大纲必须是 UTF-8 文本');
  let layoutMode = options.layoutMode || 'left-right';
  const entries = [];

  for (const original of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (!original.trim()) continue;
    const directive = /^\s*@layout\s+(.+?)\s*$/.exec(original);
    if (directive) {
      if (options.layoutMode) continue;
      layoutMode = directive[1].trim();
      continue;
    }
    const indent = indentationWidth(original.match(/^[\t ]*/)[0]);
    const text = original.trim().replace(/^[-*+]\s+/, '').trim();
    if (!text) continue;
    entries.push({ indent, node: { text, children: [] } });
  }

  if (!LAYOUT_MODES.has(layoutMode)) {
    throw new Error('layout 必须是 left-right、top-bottom 或 architecture');
  }
  if (!entries.length) throw new Error('大纲不能为空');
  if (entries[0].indent !== 0) throw new Error('根节点不能缩进');

  const stack = [];
  let root = null;
  for (const entry of entries) {
    while (stack.length && stack[stack.length - 1].indent >= entry.indent) stack.pop();
    if (!stack.length) {
      if (root) throw new Error('大纲只能有一个根节点');
      root = entry.node;
    } else {
      stack[stack.length - 1].node.children.push(entry.node);
    }
    stack.push(entry);
  }

  function pruneEmptyChildren(node) {
    if (!node.children.length) delete node.children;
    else node.children.forEach(pruneEmptyChildren);
  }
  pruneEmptyChildren(root);
  return { title: root.text, layoutMode, root };
}

export function compactMutationResult(result) {
  const request = result?.request;
  const document = result?.document;
  const preview = result?.previewDocument;
  return {
    ...(request ? {
      request: {
        id: request.id,
        status: request.status,
        baseRevision: request.baseRevision,
        ...(request.summary ? { summary: request.summary } : {}),
      },
    } : {}),
    ...(preview ? {
      preview: {
        title: preview.title,
        revision: preview.revision,
        nodeCount: Object.keys(preview.nodes || {}).length,
      },
    } : {}),
    ...(document ? {
      current: {
        title: document.title,
        revision: document.revision,
        nodeCount: Object.keys(document.nodes || {}).length,
      },
    } : {}),
  };
}
