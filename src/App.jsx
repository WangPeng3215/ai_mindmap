import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AgentPanel } from './components/AgentPanel.jsx';
import { ExpressionInspector } from './components/ExpressionInspector.jsx';
import { MindMapCanvas } from './components/MindMapCanvas.jsx';
import { NodeInspector } from './components/NodeInspector.jsx';
import { Topbar } from './components/Topbar.jsx';
import { ThemePanel } from './components/ThemePanel.jsx';
import { VersionHistoryPanel } from './components/VersionHistoryPanel.jsx';
import { api } from './lib/api.js';
import {
  documentToMarkdown,
  documentToSvg,
  downloadBlob,
  downloadPng,
  safeExportName,
} from './lib/export.js';
import {
  applyOperations,
  createDocumentFromTree,
  DEFAULT_EDGE_STYLE,
  isMindMapDocument,
} from './domain/mindmap.js';
import { createProposalPreview } from './domain/proposal.js';
import {
  createSiblingReorderOperation,
  getDefaultRootBranchSide,
  getLayoutMode,
  getRootBranchSide,
  layoutDocument,
} from './domain/layout.js';
import { createHistory, historyReducer } from './state/history.js';
import { resolveTheme, themeFromPreset } from './domain/theme.js';

const clientId = globalThis.crypto.randomUUID();

function isConsecutiveSiblingSelection(document, ids) {
  if (!document || ids.length < 2) return false;
  const nodes = ids.map((id) => document.nodes[id]).filter(Boolean);
  if (nodes.length !== ids.length || !nodes[0].parentId) return false;
  const parentId = nodes[0].parentId;
  if (nodes.some((node) => node.parentId !== parentId)) return false;
  const siblings = document.nodes[parentId].children;
  const indexes = ids.map((id) => siblings.indexOf(id)).sort((a, b) => a - b);
  return indexes.every((index, offset) => index === indexes[0] + offset);
}

export default function App() {
  const [history, dispatch] = useReducer(historyReducer, createHistory(null));
  const [selectedId, setSelectedId] = useState(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const [selectedExpression, setSelectedExpression] = useState(null);
  const [requests, setRequests] = useState([]);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [connected, setConnected] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [workspace, setWorkspace] = useState({ canvases: [], activeCanvasId: '' });
  const [themeOpen, setThemeOpen] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyBusyId, setHistoryBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const flowRef = useRef(null);
  const importRef = useRef(null);
  const documentRef = useRef(null);
  documentRef.current = history.present;

  const selectSingleNode = useCallback((id) => {
    setSelectedId(id);
    setSelectedNodeIds(id ? [id] : []);
    setSelectedExpression(null);
  }, []);

  const selectNode = useCallback((id, multi = false) => {
    if (!multi) {
      selectSingleNode(id);
      return;
    }
    setSelectedExpression(null);
    setSelectedNodeIds((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      setSelectedId(next[next.length - 1] || null);
      return next;
    });
  }, [selectSingleNode]);

  const selectExpression = useCallback((type, id) => {
    setSelectedExpression({ type, id });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedId(null);
    setSelectedNodeIds([]);
    setSelectedExpression(null);
  }, []);

  const refreshRequests = useCallback(async () => {
    const result = await api.listRequests();
    setRequests(result.requests);
  }, []);

  const refreshSnapshots = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const result = await api.listSnapshots();
      setSnapshots(result.snapshots);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([api.getCurrent(), api.listRequests(), api.listCanvases()])
      .then(([mapResult, requestResult, workspaceResult]) => {
        if (!active) return;
        dispatch({ type: 'reset', value: mapResult.document });
        selectSingleNode(mapResult.document.rootId);
        setRequests(requestResult.requests);
        setWorkspace(workspaceResult);
        setPanelOpen(requestResult.requests.some((request) => request.status === 'review'));
        setConnected(true);
      })
      .catch((cause) => setError(cause.message));

    const events = api.events((type, payload) => {
      setConnected(true);
      if (type === 'document_updated' && payload.clientId !== clientId) {
        const isAppliedProposal = ['agent-apply', 'codex-apply'].includes(payload.source);
        setPreview(null);
        dispatch({ type: isAppliedProposal ? 'commit' : 'reset', value: payload.document });
      }
      if (type === 'canvas_switched') {
        setWorkspace({ canvases: payload.canvases, activeCanvasId: payload.activeCanvasId });
        if (payload.document) {
          setPreview(null);
          dispatch({ type: 'reset', value: payload.document });
          selectSingleNode(payload.document.rootId);
        }
        refreshRequests().catch(() => {});
      }
      if (type === 'canvas_updated') {
        setWorkspace({ canvases: payload.canvases, activeCanvasId: payload.activeCanvasId });
      }      if (['request_created', 'request_updated', 'request_completed'].includes(type)) {
        if (payload.request?.status === 'review') setPanelOpen(true);
        refreshRequests().catch(() => {});
      }
    });
    events.onerror = () => setConnected(false);
    return () => {
      active = false;
      events.close();
    };
  }, [refreshRequests]);

  const persist = useCallback(async (document) => {
    setSaveStatus('saving');
    try {
      await api.replaceDocument(document, clientId);
      setSaveStatus('saved');
    } catch (cause) {
      setSaveStatus('error');
      setError(cause.message);
    }
  }, []);

  const commitDocument = useCallback((document) => {
    dispatch({ type: 'commit', value: document });
    persist(document);
  }, [persist]);

  const runOperations = useCallback((operations) => {
    if (!documentRef.current || preview) return;
    try {
      commitDocument(applyOperations(documentRef.current, operations));
    } catch (cause) {
      setError(cause.message);
    }
  }, [commitDocument, preview]);

  const editNode = useCallback((id, patch) => {
    if ('text' in patch && !patch.text.trim()) return;
    runOperations([{ type: 'update_node', id, patch }]);
  }, [runOperations]);

  const createExpression = useCallback((type) => {
    const id = type + '-' + globalThis.crypto.randomUUID();
    if (type === 'relationship') {
      if (selectedNodeIds.length !== 2) return;
      runOperations([{
        type: 'add_relationship',
        relationship: { id, sourceId: selectedNodeIds[0], targetId: selectedNodeIds[1], label: '' },
      }]);
    } else if (type === 'boundary') {
      runOperations([{ type: 'add_boundary', boundary: { id, nodeIds: selectedNodeIds, label: '' } }]);
    } else {
      runOperations([{ type: 'add_summary', summary: { id, nodeIds: selectedNodeIds, text: '概要' } }]);
    }
    setSelectedExpression({ type, id });
  }, [runOperations, selectedNodeIds]);

  const editExpression = useCallback((type, id, patch) => {
    runOperations([{ type: 'update_' + type, id, patch }]);
  }, [runOperations]);

  const deleteExpression = useCallback((type, id) => {
    runOperations([{ type: 'delete_' + type, id }]);
    setSelectedExpression(null);
  }, [runOperations]);

  const editEdgeStyle = useCallback((patch) => {
    const document = documentRef.current;
    if (!document || preview) return;
    commitDocument({
      ...document,
      edgeStyle: { ...DEFAULT_EDGE_STYLE, ...(document.edgeStyle || {}), ...patch },
      updatedAt: new Date().toISOString(),
    });
  }, [commitDocument, preview]);

  const editTheme = useCallback((patch) => {
    const document = documentRef.current;
    if (!document || preview) return;
    const current = resolveTheme(document.theme);
    commitDocument({
      ...document,
      theme: {
        ...current,
        ...patch,
        defaultNodeStyle: patch.defaultNodeStyle || current.defaultNodeStyle,
        rootNodeStyle: patch.rootNodeStyle || current.rootNodeStyle,
      },
      updatedAt: new Date().toISOString(),
    });
  }, [commitDocument, preview]);

  const applyThemePreset = useCallback((presetId) => {
    const document = documentRef.current;
    if (!document || preview) return;
    commitDocument({ ...document, theme: themeFromPreset(presetId), updatedAt: new Date().toISOString() });
  }, [commitDocument, preview]);
  const addChild = useCallback((parentId) => {
    const document = documentRef.current;
    if (!document) return;
    const id = `node-${globalThis.crypto.randomUUID()}`;
    const layoutMode = getLayoutMode(document);
    const side = parentId === document.rootId
      ? getDefaultRootBranchSide(document, layoutMode)
      : getRootBranchSide(document, parentId, layoutMode);
    runOperations([{
      type: 'add_node',
      parentId,
      node: { id, text: '新主题', ...(side ? { side } : {}) },
    }]);
    selectSingleNode(id);
  }, [runOperations]);

  const deleteNode = useCallback((id) => {
    const document = documentRef.current;
    if (!document || id === document.rootId) return;
    const parentId = document.nodes[id].parentId;
    runOperations([{ type: 'delete_node', id }]);
    selectSingleNode(parentId);
  }, [runOperations]);

  const addSibling = useCallback((id) => {
    const document = documentRef.current;
    if (!document) return;
    const node = document.nodes[id];
    if (!node.parentId) return addChild(id);
    addChild(node.parentId);
  }, [addChild]);

  const reorderNode = useCallback((id, dropPosition) => {
    const document = documentRef.current;
    if (!document || id === document.rootId) return;
    const layoutMode = getLayoutMode(document);
    const positions = layoutDocument(document, { force: true, layout: layoutMode });
    const operation = createSiblingReorderOperation(
      document,
      id,
      dropPosition,
      positions,
      { layout: layoutMode },
    );
    runOperations([operation]);
  }, [runOperations]);

  useEffect(() => {
    function handleKey(event) {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      } else if (event.key === 'Tab' && selectedId) {
        event.preventDefault();
        addChild(selectedId);
      } else if (event.key === 'Enter' && selectedId) {
        event.preventDefault();
        addSibling(selectedId);
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedExpression) {
        event.preventDefault();
        deleteExpression(selectedExpression.type, selectedExpression.id);
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        event.preventDefault();
        deleteNode(selectedId);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  function undo() {
    if (preview || !history.past.length) return;
    const target = history.past[history.past.length - 1];
    dispatch({ type: 'undo' });
    persist(target);
  }

  function redo() {
    if (preview || !history.future.length) return;
    const target = history.future[0];
    dispatch({ type: 'redo' });
    persist(target);
  }

  function updateTitle(title) {
    if (preview || !history.present) return;
    setWorkspace((current) => ({ ...current, canvases: current.canvases.map((canvas) => canvas.id === current.activeCanvasId ? { ...canvas, title } : canvas) }));
    commitDocument({ ...history.present, title, updatedAt: new Date().toISOString() });
  }

  async function activateCanvas(id) {
    if (!id || id === workspace.activeCanvasId) return;
    try {
      const result = await api.activateCanvas(id);
      setWorkspace({ canvases: result.canvases, activeCanvasId: result.activeCanvasId });
      dispatch({ type: 'reset', value: result.document });
      selectSingleNode(result.document.rootId);
      setPreview(null);
      setHistoryOpen(false);
      setThemeOpen(false);
      await refreshRequests();
      requestAnimationFrame(() => flowRef.current?.fitView({ padding: 0.2, duration: 250 }));
    } catch (cause) { setError(cause.message); }
  }

  async function createCanvas() {
    try {
      const result = await api.createCanvas(`新画布 ${workspace.canvases.length + 1}`);
      setWorkspace({ canvases: result.canvases, activeCanvasId: result.activeCanvasId });
      dispatch({ type: 'reset', value: result.document });
      selectSingleNode(result.document.rootId);
      setRequests([]);
      setPreview(null);
    } catch (cause) { setError(cause.message); }
  }

  async function duplicateCanvas() {
    try {
      const result = await api.duplicateCanvas(workspace.activeCanvasId);
      setWorkspace({ canvases: result.canvases, activeCanvasId: result.activeCanvasId });
      dispatch({ type: 'reset', value: result.document });
      selectSingleNode(result.document.rootId);
      setRequests([]);
      setPreview(null);
    } catch (cause) { setError(cause.message); }
  }

  async function deleteCanvas() {
    if (workspace.canvases.length <= 1 || !globalThis.confirm('确定删除当前画布吗？该画布的历史版本也将不再显示。')) return;
    try {
      const result = await api.deleteCanvas(workspace.activeCanvasId);
      setWorkspace({ canvases: result.canvases, activeCanvasId: result.activeCanvasId });
      dispatch({ type: 'reset', value: result.document });
      selectSingleNode(result.document.rootId);
      setPreview(null);
      await refreshRequests();
    } catch (cause) { setError(cause.message); }
  }

  async function exportWorkspace() {
    try {
      const bundle = await api.exportWorkspace();
      downloadBlob(new Blob([`${JSON.stringify(bundle, null, 2)}\n`], { type: 'application/json' }), 'mindflow-workspace.json');
      setNotice('已导出整个工作区');
    } catch (cause) { setError(cause.message); }
  }
  function autoLayout() {
    if (preview) return;
    const document = structuredClone(history.present);
    for (const node of Object.values(document.nodes)) delete node.position;
    document.updatedAt = new Date().toISOString();
    commitDocument(document);
    requestAnimationFrame(() => flowRef.current?.fitView({ padding: 0.2, duration: 350 }));
  }

  function changeLayoutMode(layoutMode) {
    if (preview || !history.present || getLayoutMode(history.present) === layoutMode) return;
    const document = structuredClone(history.present);
    document.layoutMode = layoutMode;
    for (const node of Object.values(document.nodes)) delete node.position;
    commitDocument(document);
    requestAnimationFrame(() => flowRef.current?.fitView({ padding: 0.2, duration: 350 }));
  }

  async function submitRequest(message, options) {
    const result = await api.createRequest(message, options);
    setRequests((current) => [result.request, ...current]);
  }

  async function applyRequest(id, operationIndexes) {
    try {
      const result = await api.applyRequest(id, clientId, operationIndexes);
      setPreview(null);
      dispatch({ type: 'commit', value: result.document });
      await refreshRequests();
    } catch (cause) {
      setError(cause.message);
    }
  }

  async function rejectRequest(id) {
    try {
      await api.rejectRequest(id);
      setPreview(null);
      await refreshRequests();
    } catch (cause) {
      setError(cause.message);
    }
  }

  async function openHistory() {
    setPreview(null);
    setHistoryOpen(true);
    await refreshSnapshots();
  }

  async function restoreVersion(id) {
    setHistoryBusyId(id);
    try {
      const result = await api.restoreSnapshot(id, clientId);
      setPreview(null);
      if (result.unchanged) {
        setNotice(result.message || '历史版本内容与当前版本完全一致，无需恢复');
      } else {
        dispatch({ type: 'commit', value: result.document });
        selectSingleNode(result.document.rootId);
      }
      await refreshSnapshots();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setHistoryBusyId('');
    }
  }

  function previewRequest(request, operationIndexes) {
    try {
      const nextPreview = createProposalPreview(history.present, request, operationIndexes);
      setPreview({ requestId: request.id, operationIndexes, ...nextPreview });
      selectSingleNode(nextPreview.document.rootId);
      requestAnimationFrame(() => flowRef.current?.fitView({ padding: 0.2, duration: 350 }));
    } catch (cause) {
      setError(cause.message);
    }
  }

  function exitPreview() {
    setPreview(null);
    selectSingleNode(history.present.rootId);
    requestAnimationFrame(() => flowRef.current?.fitView({ padding: 0.2, duration: 350 }));
  }

  async function exportMap(format) {
    if (preview) return;
    try {
      if (format === 'png') {
        await downloadPng(history.present);
      } else if (format === 'svg') {
        downloadBlob(
          new Blob([documentToSvg(history.present)], { type: 'image/svg+xml;charset=utf-8' }),
          safeExportName(history.present.title, 'svg'),
        );
      } else if (format === 'markdown') {
        downloadBlob(
          new Blob([documentToMarkdown(history.present)], { type: 'text/markdown;charset=utf-8' }),
          safeExportName(history.present.title, 'md'),
        );
      } else {
        downloadBlob(
          new Blob([`${JSON.stringify(history.present, null, 2)}\n`], { type: 'application/json' }),
          safeExportName(history.present.title, 'json'),
        );
      }
      setNotice(`已导出 ${format === 'markdown' ? 'Markdown' : format.toUpperCase()}`);
    } catch (cause) {
      setError(cause.message);
    }
  }

  async function importJson(event) {
    if (preview) return;
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const document = isMindMapDocument(payload)
        ? payload
        : createDocumentFromTree(payload.root || payload, { title: payload.title, theme: payload.theme, edgeStyle: payload.edgeStyle });
      dispatch({ type: 'reset', value: document });
      selectSingleNode(document.rootId);
      persist(document);
    } catch (cause) {
      setError(`导入失败：${cause.message}`);
    }
  }

  const selectedNode = useMemo(
    () => history.present?.nodes[selectedId] || null,
    [history.present, selectedId],
  );

  if (!history.present) {
    return <main className="loading-screen"><div className="loading-mark" /><p>正在连接本地脑图服务</p>{error && <span>{error}</span>}</main>;
  }

  const canvasDocument = preview?.document || history.present;
  const layoutMode = getLayoutMode(canvasDocument);
  const canAddRangeExpression = isConsecutiveSiblingSelection(canvasDocument, selectedNodeIds);
  const canAddRelationship = selectedNodeIds.length === 2;
  const expressionCollection = selectedExpression?.type === 'relationship'
    ? 'relationships'
    : selectedExpression?.type === 'boundary'
      ? 'boundaries'
      : 'summaries';
  const selectedExpressionValue = selectedExpression
    ? (canvasDocument[expressionCollection] || []).find((item) => item.id === selectedExpression.id)
    : null;
  return (
    <main className="app-shell">
      <Topbar
        title={canvasDocument.title}
        onTitleChange={updateTitle}
        saveStatus={saveStatus}
        canvases={workspace.canvases}
        activeCanvasId={workspace.activeCanvasId}
        onActivateCanvas={activateCanvas}
        onCreateCanvas={createCanvas}
        onDuplicateCanvas={duplicateCanvas}
        onDeleteCanvas={deleteCanvas}
        onExportWorkspace={exportWorkspace}
        canUndo={!preview && history.past.length > 0}
        canRedo={!preview && history.future.length > 0}
        onUndo={undo}
        onRedo={redo}
        canAddBoundary={canAddRangeExpression}
        canAddSummary={canAddRangeExpression}
        canAddRelationship={canAddRelationship}
        onAddBoundary={() => createExpression('boundary')}
        onAddSummary={() => createExpression('summary')}
        onAddRelationship={() => createExpression('relationship')}
        onLayout={autoLayout}
        layoutMode={layoutMode}
        onLayoutModeChange={changeLayoutMode}
        onFit={() => flowRef.current?.fitView({ padding: 0.2, duration: 350 })}
        onImport={() => importRef.current?.click()}
        onExport={exportMap}
        onHistory={openHistory}
        themeOpen={themeOpen}
        onToggleTheme={() => { setThemeOpen((value) => !value); setHistoryOpen(false); }}
        readOnly={Boolean(preview)}
        panelOpen={panelOpen}
        onTogglePanel={() => setPanelOpen((value) => !value)}
      />
      <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={importJson} />
      <div className={`workspace ${panelOpen ? '' : 'panel-closed'}`}>
        {panelOpen && (
          <AgentPanel
            requests={requests}
            connected={connected}
            selectedNode={selectedNode}
            document={history.present}
            previewRequestId={preview?.requestId || null}
            onSubmit={submitRequest}
            onPreview={previewRequest}
            onExitPreview={exitPreview}
            onApply={applyRequest}
            onReject={rejectRequest}
          />
        )}
        <MindMapCanvas
          document={canvasDocument}
          selectedIds={selectedNodeIds}
          selectedExpression={selectedExpression}
          onSelectNode={selectNode}
          onSelectExpression={selectExpression}
          onClearSelection={clearSelection}
          onEditNode={editNode}
          onEditExpression={editExpression}
          onAddChild={addChild}
          onToggleCollapse={(id) => editNode(id, { collapsed: !history.present.nodes[id].collapsed })}
          onReorderNode={reorderNode}
          layoutMode={layoutMode}
          previewMode={Boolean(preview)}
          previewChanges={preview?.changes || {}}
          previewKind={preview?.kind || null}
          previewDeletedCount={preview?.deletedIds?.length || 0}
          onExitPreview={exitPreview}
          onReady={(instance) => { flowRef.current = instance; }}
        />
        {themeOpen && !preview && (
          <ThemePanel
            theme={history.present.theme}
            onChange={editTheme}
            onPreset={applyThemePreset}
            onClose={() => setThemeOpen(false)}
          />
        )}
        {historyOpen && !preview && (
          <VersionHistoryPanel
            snapshots={snapshots}
            currentRevision={history.present.revision}
            loading={historyLoading}
            busyId={historyBusyId}
            onRefresh={refreshSnapshots}
            onRestore={restoreVersion}
            onClose={() => setHistoryOpen(false)}
          />
        )}
        {!preview && !historyOpen && !themeOpen && selectedExpressionValue && (
          <ExpressionInspector
            type={selectedExpression.type}
            expression={selectedExpressionValue}
            selectedNodeIds={selectedNodeIds}
            canReplaceRange={canAddRangeExpression}
            canReplaceRelationship={canAddRelationship}
            onChange={(patch) => editExpression(selectedExpression.type, selectedExpression.id, patch)}
            onDelete={() => deleteExpression(selectedExpression.type, selectedExpression.id)}
            onClose={() => setSelectedExpression(null)}
          />
        )}
        {!preview && !historyOpen && !themeOpen && !selectedExpressionValue && (
          <NodeInspector
            node={selectedNode}
            isRoot={selectedId === history.present.rootId}
            onClose={() => selectSingleNode(null)}
            onChange={editNode}
            edgeStyle={history.present.edgeStyle || DEFAULT_EDGE_STYLE}
            onEdgeStyleChange={editEdgeStyle}
            onAddChild={addChild}
            onDelete={deleteNode}
          />
        )}
      </div>
      {notice && <div className="notice-toast" role="status" onClick={() => setNotice('')}>{notice}</div>}
      {error && <div className="error-toast" role="alert" onClick={() => setError('')}>{error}</div>}
    </main>
  );
}
