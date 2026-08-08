import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AgentPanel } from './components/AgentPanel.jsx';
import { MindMapCanvas } from './components/MindMapCanvas.jsx';
import { NodeInspector } from './components/NodeInspector.jsx';
import { Topbar } from './components/Topbar.jsx';
import { api } from './lib/api.js';
import {
  applyOperations,
  createDocumentFromTree,
  isMindMapDocument,
} from './domain/mindmap.js';
import { createSiblingReorderOperation, layoutDocument } from './domain/layout.js';
import { createHistory, historyReducer } from './state/history.js';

const clientId = globalThis.crypto.randomUUID();

export default function App() {
  const [history, dispatch] = useReducer(historyReducer, createHistory(null));
  const [selectedId, setSelectedId] = useState(null);
  const [requests, setRequests] = useState([]);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [connected, setConnected] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [error, setError] = useState('');
  const flowRef = useRef(null);
  const importRef = useRef(null);
  const documentRef = useRef(null);
  documentRef.current = history.present;

  const refreshRequests = useCallback(async () => {
    const result = await api.listRequests();
    setRequests(result.requests);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([api.getCurrent(), api.listRequests()])
      .then(([mapResult, requestResult]) => {
        if (!active) return;
        dispatch({ type: 'reset', value: mapResult.document });
        setSelectedId(mapResult.document.rootId);
        setRequests(requestResult.requests);
        setConnected(true);
      })
      .catch((cause) => setError(cause.message));

    const events = api.events((type, payload) => {
      setConnected(true);
      if (type === 'document_updated' && payload.clientId !== clientId) {
        dispatch({ type: 'reset', value: payload.document });
      }
      if (type === 'request_created' || type === 'request_completed') refreshRequests().catch(() => {});
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
    if (!documentRef.current) return;
    try {
      commitDocument(applyOperations(documentRef.current, operations));
    } catch (cause) {
      setError(cause.message);
    }
  }, [commitDocument]);

  const editNode = useCallback((id, patch) => {
    if ('text' in patch && !patch.text.trim()) return;
    runOperations([{ type: 'update_node', id, patch }]);
  }, [runOperations]);

  const addChild = useCallback((parentId) => {
    const id = `node-${globalThis.crypto.randomUUID()}`;
    runOperations([{ type: 'add_node', parentId, node: { id, text: '新主题' } }]);
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

  const reorderNode = useCallback((id, dropY) => {
    const document = documentRef.current;
    if (!document || id === document.rootId) return;
    const positions = layoutDocument(document, { force: true });
    const operation = createSiblingReorderOperation(document, id, dropY, positions);
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
    if (!history.past.length) return;
    const target = history.past[history.past.length - 1];
    dispatch({ type: 'undo' });
    persist(target);
  }

  function redo() {
    if (!history.future.length) return;
    const target = history.future[0];
    dispatch({ type: 'redo' });
    persist(target);
  }

  function updateTitle(title) {
    if (!history.present) return;
    const next = { ...history.present, title, updatedAt: new Date().toISOString() };
    commitDocument(next);
  }

  function autoLayout() {
    const document = structuredClone(history.present);
    for (const node of Object.values(document.nodes)) delete node.position;
    document.updatedAt = new Date().toISOString();
    commitDocument(document);
    requestAnimationFrame(() => flowRef.current?.fitView({ padding: 0.2, duration: 350 }));
  }

  async function submitRequest(message) {
    const result = await api.createRequest(message);
    setRequests((current) => [result.request, ...current]);
  }

  function exportJson() {
    const blob = new Blob([`${JSON.stringify(history.present, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = globalThis.document.createElement('a');
    anchor.href = url;
    anchor.download = `${history.present.title || 'mindmap'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(event) {
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

  return (
    <main className="app-shell">
      <Topbar
        title={history.present.title}
        onTitleChange={updateTitle}
        saveStatus={saveStatus}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onUndo={undo}
        onRedo={redo}
        onLayout={autoLayout}
        onFit={() => flowRef.current?.fitView({ padding: 0.2, duration: 350 })}
        onImport={() => importRef.current?.click()}
        onExport={exportJson}
        panelOpen={panelOpen}
        onTogglePanel={() => setPanelOpen((value) => !value)}
      />
      <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={importJson} />
      <div className={`workspace ${panelOpen ? '' : 'panel-closed'}`}>
        {panelOpen && <AgentPanel requests={requests} connected={connected} onSubmit={submitRequest} />}
        <MindMapCanvas
          document={history.present}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onEditNode={editNode}
          onAddChild={addChild}
          onToggleCollapse={(id) => editNode(id, { collapsed: !history.present.nodes[id].collapsed })}
          onReorderNode={reorderNode}
          onReady={(instance) => { flowRef.current = instance; }}
        />
        <NodeInspector
          node={selectedNode}
          isRoot={selectedId === history.present.rootId}
          onClose={() => setSelectedId(null)}
          onChange={editNode}
          onAddChild={addChild}
          onDelete={deleteNode}
        />
      </div>
      {error && <div className="error-toast" role="alert" onClick={() => setError('')}>{error}</div>}
    </main>
  );
}
