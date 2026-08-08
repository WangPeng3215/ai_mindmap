import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AgentPanel } from './components/AgentPanel.jsx';
import { MindMapCanvas } from './components/MindMapCanvas.jsx';
import { NodeInspector } from './components/NodeInspector.jsx';
import { Topbar } from './components/Topbar.jsx';
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

const clientId = globalThis.crypto.randomUUID();

export default function App() {
  const [history, dispatch] = useReducer(historyReducer, createHistory(null));
  const [selectedId, setSelectedId] = useState(null);
  const [requests, setRequests] = useState([]);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [connected, setConnected] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyBusyId, setHistoryBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const flowRef = useRef(null);
  const importRef = useRef(null);
  const documentRef = useRef(null);
  documentRef.current = history.present;

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
    Promise.all([api.getCurrent(), api.listRequests()])
      .then(([mapResult, requestResult]) => {
        if (!active) return;
        dispatch({ type: 'reset', value: mapResult.document });
        setSelectedId(mapResult.document.rootId);
        setRequests(requestResult.requests);
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
      if (['request_created', 'request_updated', 'request_completed'].includes(type)) {
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
    setSelectedId(id);
  }, [runOperations]);

  const deleteNode = useCallback((id) => {
    const document = documentRef.current;
    if (!document || id === document.rootId) return;
    const parentId = document.nodes[id].parentId;
    runOperations([{ type: 'delete_node', id }]);
    setSelectedId(parentId);
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
    commitDocument({ ...history.present, title, updatedAt: new Date().toISOString() });
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
        setSelectedId(result.document.rootId);
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
      setSelectedId(nextPreview.document.rootId);
      requestAnimationFrame(() => flowRef.current?.fitView({ padding: 0.2, duration: 350 }));
    } catch (cause) {
      setError(cause.message);
    }
  }

  function exitPreview() {
    setPreview(null);
    setSelectedId(history.present.rootId);
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
        : createDocumentFromTree(payload.root || payload, { title: payload.title });
      dispatch({ type: 'reset', value: document });
      setSelectedId(document.rootId);
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
  return (
    <main className="app-shell">
      <Topbar
        title={canvasDocument.title}
        onTitleChange={updateTitle}
        saveStatus={saveStatus}
        canUndo={!preview && history.past.length > 0}
        canRedo={!preview && history.future.length > 0}
        onUndo={undo}
        onRedo={redo}
        onLayout={autoLayout}
        layoutMode={layoutMode}
        onLayoutModeChange={changeLayoutMode}
        onFit={() => flowRef.current?.fitView({ padding: 0.2, duration: 350 })}
        onImport={() => importRef.current?.click()}
        onExport={exportMap}
        onHistory={openHistory}
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
          selectedId={selectedId}
          onSelect={setSelectedId}
          onEditNode={editNode}
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
        {!preview && !historyOpen && (
          <NodeInspector
            node={selectedNode}
            isRoot={selectedId === history.present.rootId}
            onClose={() => setSelectedId(null)}
            onChange={editNode}
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
