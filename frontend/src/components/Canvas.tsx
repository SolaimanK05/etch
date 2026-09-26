import { useCallback, useEffect, useRef, useState } from "react";
import { Excalidraw, convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI, AppState } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { State } from "../lib/state";
import type { ArchGraph } from "../types";
import { drawingFromElements, sceneSkeleton, layerOfBox } from "../lib/drawing";
import { getItem, setItem } from "../lib/persist";
import { ViolationOverlay } from "./ViolationOverlay";
import { Toast } from "./Toast";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ViewState {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

interface CanvasProps {
  state: State;
  onDrawingChange: (drawing: import("../types").Drawing) => void;
  onHover: (edge: string | null) => void;
}

const SAVE_THROTTLE_MS = 500;

const INITIAL_APP_STATE = {
  viewBackgroundColor: "transparent",
  currentItemFontFamily: 6,
  currentItemStrokeColor: "#111111",
  currentItemStrokeWidth: 2,
  currentItemRoughness: 1,
} as const;

/** Zoom so every box fits with breathing room for the floating panels. */
function fitScene(api: ExcalidrawImperativeAPI | null) {
  api?.scrollToContent(undefined, { fitToViewport: true, viewportZoomFactor: 0.85, animate: false });
}

function layerKeyOf(graph: ArchGraph, repoPath: string): string {
  return graph.layers.map((l) => l.id).sort().join(",") + "|" + repoPath;
}

function buildElements(graph: ArchGraph, repoPath: string) {
  const saved = getItem<Record<string, { x: number; y: number }>>(`etch.positions.${repoPath}`) ?? undefined;
  return convertToExcalidrawElements(sceneSkeleton(graph, saved), { regenerateIds: false });
}

/**
 * Canvas — Excalidraw + ViolationOverlay + Toast + Seal + Legend
 * DESIGN.md §6
 */
export function Canvas({ state, onDrawingChange, onHover }: CanvasProps) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  // Excalidraw hands over its API asynchronously after mount; keep it in state
  // so the scene-building effect re-runs once it arrives.
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [boxRects, setBoxRects] = useState<Record<string, Rect>>({});
  const [view, setView] = useState<ViewState>({ scrollX: 0, scrollY: 0, zoom: 1 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);

  // Track last drawing JSON to avoid spurious dispatches
  const lastDrawingJsonRef = useRef("");
  // Debounce timer for drawing-changed reports
  const drawingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Throttle timer for saving positions
  const saveThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track graph identity to detect when to rebuild the scene
  const lastGraphKeyRef = useRef<string>("");

  // The Canvas only mounts after a scan, so the first scene goes in as initialData.
  // (An updateScene() right after mount is overwritten by Excalidraw's own async
  // initialData load.) Later layer-set changes go through the effect below.
  const [initialData] = useState(() => {
    const { graph, repoPath } = state;
    if (!graph) return { appState: INITIAL_APP_STATE };
    lastGraphKeyRef.current = layerKeyOf(graph, repoPath);
    return {
      elements: buildElements(graph, repoPath),
      appState: INITIAL_APP_STATE,
      scrollToContent: true,
    };
  });

  // Update containerRect on resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function update() {
      setContainerRect(el!.getBoundingClientRect());
    }
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build scene when graph's layer-id set or repoPath changes
  useEffect(() => {
    const { graph, repoPath } = state;
    if (!graph || !api) return;

    const layerKey = layerKeyOf(graph, repoPath);
    if (layerKey === lastGraphKeyRef.current) return;
    lastGraphKeyRef.current = layerKey;

    api.updateScene({ elements: buildElements(graph, repoPath) });
    setTimeout(() => fitScene(apiRef.current), 50);
  }, [state.graph, state.repoPath, api]);

  // Fit the first scene (delivered via initialData) once the API arrives, and
  // refit when the canvas area changes size (rotation, rail breakpoints).
  useEffect(() => {
    if (!api) return;
    const t = setTimeout(() => fitScene(api), 80);
    return () => clearTimeout(t);
  }, [api, containerRect?.width, containerRect?.height]);

  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState) : void => {
      // Compute box rects and view, push with rAF only when changed
      const newRects: Record<string, Rect> = {};
      for (const el of elements) {
        if (el.isDeleted || el.type !== "rectangle") continue;
        const layer = layerOfBox(el.id);
        if (layer !== null) {
          newRects[layer] = { x: el.x, y: el.y, width: el.width, height: el.height };
        }
      }

      const newView: ViewState = {
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
        zoom: appState.zoom.value,
      };

      requestAnimationFrame(() => {
        setBoxRects((prev) => {
          const prevJson = JSON.stringify(prev);
          const newJson = JSON.stringify(newRects);
          return prevJson === newJson ? prev : newRects;
        });
        setView((prev) => {
          if (
            prev.scrollX === newView.scrollX &&
            prev.scrollY === newView.scrollY &&
            prev.zoom === newView.zoom
          )
            return prev;
          return newView;
        });
      });

      // Compute drawing and report changes (debounced 250ms)
      const drawing = drawingFromElements(Array.from(elements));
      const json = JSON.stringify(drawing);
      if (json !== lastDrawingJsonRef.current) {
        lastDrawingJsonRef.current = json;
        if (drawingDebounceRef.current) clearTimeout(drawingDebounceRef.current);
        drawingDebounceRef.current = setTimeout(() => {
          onDrawingChange(drawing);
        }, 250);
      }

      // Save box positions (throttled 500ms)
      if (state.repoPath) {
        if (saveThrottleRef.current) clearTimeout(saveThrottleRef.current);
        saveThrottleRef.current = setTimeout(() => {
          const posKey = `etch.positions.${state.repoPath}`;
          const positions: Record<string, { x: number; y: number }> = {};
          for (const el of elements) {
            if (el.isDeleted || el.type !== "rectangle") continue;
            const layer = layerOfBox(el.id);
            if (layer !== null) {
              positions[layer] = { x: el.x, y: el.y };
            }
          }
          setItem(posKey, positions);
        }, SAVE_THROTTLE_MS);
      }
    },
    [onDrawingChange, state.repoPath],
  );

  // Etched seal — motion #19
  const isEtched = state.phase === "etched";
  const sealOpacity = isEtched ? 1 : 0;
  const sealTransform = isEtched
    ? "rotate(-4deg) scale(1)"
    : "rotate(-4deg) scale(0.96)";

  // Seal content
  const sealDate = (() => {
    const d = new Date();
    const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  })();
  const boxCount = state.drawing.layers.length;
  const ruleCount = state.drawing.arrows.length;

  return (
    <div
      ref={containerRef}
      className="app-canvas"
      style={{ position: "relative" }}
    >
      <Excalidraw
        excalidrawAPI={(instance) => {
          apiRef.current = instance;
          setApi(instance);
          // Dev-only hook for browser automation (stripped from production builds)
          if (import.meta.env.DEV) (window as unknown as { __etchExcalidraw?: unknown }).__etchExcalidraw = instance;
        }}
        initialData={initialData}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            export: false,
            saveToActiveFile: false,
            toggleTheme: false,
            changeViewBackgroundColor: false,
            saveAsImage: false,
          },
          tools: { image: false },
        }}
        onChange={handleChange}
      />

      {/* Violation overlay */}
      <ViolationOverlay
        state={state}
        boxRects={boxRects}
        view={view}
        containerRect={containerRect}
        onHover={onHover}
      />

      {/* Toast — motion #16 */}
      <Toast toast={state.toast} />

      {/* Seal — motion #19 */}
      <div style={{
        position: "absolute",
        left: 96,
        bottom: 110,
        padding: 5,
        border: "1.5px solid var(--etched)",
        borderRadius: 10,
        background: "rgba(255,255,255,0.6)",
        opacity: sealOpacity,
        transform: sealTransform,
        transition: "opacity 260ms var(--ease-out), transform 260ms var(--ease-out)",
        pointerEvents: "none",
      }}>
        <div style={{
          padding: "14px 22px 12px",
          border: "1px solid var(--etched)",
          borderRadius: 6,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          color: "var(--etched)",
        }}>
          <span style={{
            fontFamily: "var(--font-ui)",
            fontWeight: 600,
            fontSize: 32,
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}>Etched</span>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.04em",
          }}>
            {sealDate} · {boxCount} BOXES · {ruleCount} RULES
          </span>
        </div>
      </div>

      {/* Legend — positioned in theme.css (.canvas-legend) so it clears Excalidraw's own controls */}
      <div className="canvas-legend">
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="22" height="6" aria-hidden="true">
            <path d="M1 3h20" stroke="var(--ink)" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          you allowed
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="22" height="6" aria-hidden="true">
            <path d="M1 3h20" stroke="var(--violation)" strokeWidth="2"
              strokeDasharray="5 4" strokeLinecap="round" />
          </svg>
          code does it anyway
        </span>
        <span className="legend-hint">
          <span className="legend-hint-hover">Hover a red arrow or a row</span>
          <span className="legend-hint-touch">Tap a red arrow or a row</span>
        </span>
      </div>
    </div>
  );
}
