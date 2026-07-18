// T2-0b スパイク専用の使い捨てページ。本実装(src/)には組み込まない。
// 目的: 設計書§8.1の前提(onChangeでzoom/scroll監視 + updateSceneで要素+カメラ一括制御)の成立確認。
import { useCallback, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Excalidraw, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type {
  AppState,
  ExcalidrawImperativeAPI,
  NormalizedZoomValue,
} from '@excalidraw/excalidraw/types';
import type { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import '@excalidraw/excalidraw/index.css';

// C4図のノード+エッジを模したダミー要素(初期表示)。
function buildInitialElements(): OrderedExcalidrawElement[] {
  return convertToExcalidrawElements([
    {
      type: 'rectangle',
      id: 'node-a',
      x: 100,
      y: 100,
      width: 220,
      height: 100,
      backgroundColor: '#1168bd',
      strokeColor: '#1168bd',
      fillStyle: 'solid',
      roundness: { type: 3 },
      label: { text: 'System A\n[C4 node]', strokeColor: '#ffffff' },
    },
    {
      type: 'rectangle',
      id: 'node-b',
      x: 520,
      y: 100,
      width: 220,
      height: 100,
      backgroundColor: '#438dd5',
      strokeColor: '#438dd5',
      fillStyle: 'solid',
      roundness: { type: 3 },
      label: { text: 'System B\n[C4 node]', strokeColor: '#ffffff' },
    },
    {
      type: 'arrow',
      id: 'edge-a-b',
      x: 320,
      y: 150,
      points: [
        [0, 0],
        [200, 0],
      ],
      start: { id: 'node-a' },
      end: { id: 'node-b' },
      label: { text: 'calls' },
    },
  ]);
}

// 「テスト実行」ボタン押下後の差し替え要素。位置・色を変えて updateScene の反映を確認する。
function buildUpdatedElements(): OrderedExcalidrawElement[] {
  return convertToExcalidrawElements([
    {
      type: 'rectangle',
      id: 'node-a',
      x: 250,
      y: 420,
      width: 260,
      height: 120,
      backgroundColor: '#e03131',
      strokeColor: '#e03131',
      fillStyle: 'solid',
      roundness: { type: 3 },
      label: { text: 'System A (moved+recolored)', strokeColor: '#ffffff' },
    },
    {
      type: 'rectangle',
      id: 'node-b',
      x: 700,
      y: 420,
      width: 220,
      height: 100,
      backgroundColor: '#2f9e44',
      strokeColor: '#2f9e44',
      fillStyle: 'solid',
      roundness: { type: 3 },
      label: { text: 'System B (recolored)', strokeColor: '#ffffff' },
    },
    {
      type: 'arrow',
      id: 'edge-a-b',
      x: 510,
      y: 470,
      points: [
        [0, 0],
        [190, 0],
      ],
      start: { id: 'node-a' },
      end: { id: 'node-b' },
      label: { text: 'calls (updated)' },
    },
  ]);
}

function formatDebug(appState: Pick<AppState, 'zoom' | 'scrollX' | 'scrollY'>, note: string): string {
  return [
    `note: ${note}`,
    `zoom.value: ${appState.zoom.value.toFixed(4)}`,
    `scrollX: ${appState.scrollX.toFixed(2)}`,
    `scrollY: ${appState.scrollY.toFixed(2)}`,
  ].join('\n');
}

function App() {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [debugText, setDebugText] = useState<string>('note: (initial mount, waiting for onChange)\n');
  const [updateSceneClicked, setUpdateSceneClicked] = useState(false);

  const onChange = useCallback((_elements: readonly OrderedExcalidrawElement[], appState: AppState) => {
    setDebugText(formatDebug(appState, updateSceneClicked ? 'after updateScene test button' : 'live onChange'));
  }, [updateSceneClicked]);

  const runUpdateSceneTest = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    setUpdateSceneClicked(true);
    api.updateScene({
      elements: buildUpdatedElements(),
      appState: {
        scrollX: -150,
        scrollY: -200,
        zoom: { value: 1.8 as NormalizedZoomValue },
      },
    });
  }, []);

  return (
    <>
      <div id="debug" data-testid="debug-readout">
        {debugText}
      </div>
      <div style={{ padding: '4px 12px', background: '#333' }}>
        <button id="test-run-btn" onClick={runUpdateSceneTest} type="button">
          テスト実行 (updateScene: elements + camera)
        </button>
      </div>
      <div id="canvas-wrap">
        <Excalidraw
          excalidrawAPI={(api) => {
            apiRef.current = api;
          }}
          viewModeEnabled={true}
          onChange={onChange}
          initialData={{
            elements: buildInitialElements(),
            appState: {
              viewModeEnabled: true,
              zoom: { value: 1 as NormalizedZoomValue },
              scrollX: 0,
              scrollY: 0,
            },
          }}
        />
      </div>
    </>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('root element not found');
createRoot(container).render(<App />);
