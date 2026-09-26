import { useCallback, useEffect, useRef, useState } from "react";
import { CaptureUpdateAction, Excalidraw, convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI, AppState } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { State } from "../lib/state";
import type { ArchGraph } from "../types";
import { drawingFromElements, notesFromElements, sceneSkeleton, layerOfBox, adoptionPlan, rebindForAdoption, boxSkeleton } from "../lib/drawing";
import { getItem, setItem } from "../lib/persist";
import { isAllowedTool, stepZoom, zoomAround, type ToolType } from "../lib/canvasControls";
import { Toolbar, ViewControls } from "./CanvasControls";
import { ViolationOverlay, type BoxTag } from "./ViolationOverlay";
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
  onNotesChange: (notes: import("../types").Note[]) => void;
  onHover: (edge: string | null) => void;
}

const SAVE_THROTTLE_MS = 500;

// DESIGN.md §6 v2: whatever the user draws is clean too (no wobble, Etch ink, Nunito)
const INITIAL_APP_STATE = {
  viewBackgroundColor: "transparent",
  currentItemFontFamily: 6,
  currentItemFontSize: 20,
  currentItemStrokeColor: "#111111",
  currentItemBackgroundColor: "transparent",
  currentItemStrokeWidth: 1.5,
  currentItemRoughness: 0,
  currentItemRoundness: "round",
  currentItemArrowType: "round",
  currentItemEndArrowhead: "arrow",
} as const;

// A drawn box that will become a package: dashed, on paper (DESIGN.md §12)
const NEW_BOX_STYLE = { strokeStyle: "dashed", backgroundColor: "#fbfbfa", fillStyle: "solid" } as const;
const CREATED_TAG_MS = 4000;

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
export function Canvas({ state, onDrawingChange, onNotesChange, onHover }: CanvasProps) {
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
  // Track last notes JSON to avoid spurious dispatches
  const lastNotesJsonRef = useRef("");
  // Debounce timer for drawing-changed reports
  const drawingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Throttle timer for saving positions
  const saveThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track graph identity to detect when to rebuild the scene
  const lastGraphKeyRef = useRef<string>("");

  // New boxes (DESIGN.md §12): rects of drawn boxes, ids we dashed, boxes just built
  const [newBoxRects, setNewBoxRects] = useState<Record<string, Rect>>({});
  const dashedIdsRef = useRef<Set<string>>(new Set());
  const [created, setCreated] = useState<string[]>([]);
  const [createdVisible, setCreatedVisible] = useState(false);
  const [activeTool, setActiveTool] = useState("selection");
  const activeToolRef = useRef("selection");

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

    const sameRepo = lastGraphKeyRef.current.endsWith("|" + repoPath);
    const layerIds = graph.layers.map((l) => l.id);

    if (sameRepo) {
      // Try adoption: convert drawn new-box rects into real code boxes
      const scene = api.getSceneElementsIncludingDeleted();
      const plan = adoptionPlan(scene, layerIds);
      // covered = every layer id is a live etch box or covered by a plan adoption
      const liveEtchIds = new Set(
        scene
          .filter((el) => !el.isDeleted && el.type === "rectangle" && el.id.startsWith("etch-box-"))
          .map((el) => el.id.slice("etch-box-".length))
      );
      const covered = layerIds.every((id) => liveEtchIds.has(id) || plan.some((p) => p.name === id));

      if (covered) {
        if (plan.length > 0) {
          const rebound = rebindForAdoption(scene, plan);
          const created = convertToExcalidrawElements(
            plan.map((p) => {
              // Get position/size from the drawn rect
              const drawnRect = scene.find((el) => el.id === p.rectId);
              const rect = drawnRect
                ? { x: (drawnRect as { x: number }).x, y: (drawnRect as { y: number }).y, width: (drawnRect as { width: number }).width, height: (drawnRect as { height: number }).height }
                : { x: 0, y: 0, width: 220, height: 96 };
              return boxSkeleton(p.name, rect);
            }),
            { regenerateIds: false }
          );
          // Attach arrow bindings and customData to the created rectangles
          const createdWithArrows = created.map((el) => {
            const adoption = plan.find((p) => p.rectId !== el.id && el.id === "etch-box-" + p.name);
            if (!adoption) return el;
            // keep the label's binding; add the arrows
            const boundElements = [
              ...(el.boundElements ?? []),
              ...adoption.arrowIds.map((id) => ({ id, type: "arrow" as const })),
            ];
            const extra: Record<string, unknown> = { boundElements };
            if (adoption.intent) extra.customData = { etchIntent: adoption.intent };
            return { ...el, ...extra };
          });
          api.updateScene({ elements: [...rebound, ...createdWithArrows] });
          // NEW tag becomes CREATED on the real box, then fades (DESIGN.md §6)
          setCreated(plan.map((p) => p.name));
          setCreatedVisible(true);
          setTimeout(() => setCreatedVisible(false), CREATED_TAG_MS);
        }
        lastGraphKeyRef.current = layerKey;
        return;
      }
    }

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
      const elArray = Array.from(elements);
      const drawing = drawingFromElements(elArray);
      const json = JSON.stringify(drawing);
      if (json !== lastDrawingJsonRef.current) {
        lastDrawingJsonRef.current = json;
        if (drawingDebounceRef.current) clearTimeout(drawingDebounceRef.current);
        drawingDebounceRef.current = setTimeout(() => {
          onDrawingChange(drawing);
        }, 250);
      }

      // Only Etch's tools (DESIGN.md §6): a shortcut to diamond, ellipse, line… snaps back to Select
      const tool = appState.activeTool.type;
      if (!isAllowedTool(tool)) {
        requestAnimationFrame(() => apiRef.current?.setActiveTool({ type: "selection" }));
      } else if (tool !== activeToolRef.current) {
        activeToolRef.current = tool;
        setActiveTool(tool);
      }

      // New boxes (DESIGN.md §12): remember where they are for the NEW tag, and draw
      // them dashed on paper; a box that stops qualifying goes back to a plain shape.
      const plan = adoptionPlan(elArray, drawing.new_boxes.map((b) => b.id));
      const nbRects: Record<string, Rect> = {};
      const toDash: string[] = [];
      for (const p of plan) {
        const el = elArray.find((e) => e.id === p.rectId);
        if (!el) continue;
        nbRects[p.name] = { x: el.x, y: el.y, width: el.width, height: el.height };
        if (el.strokeStyle !== "dashed") toDash.push(el.id);
      }
      const qualifying = new Set(plan.map((p) => p.rectId));
      const toUndash = [...dashedIdsRef.current].filter(
        (id) => !qualifying.has(id) && elArray.some((e) => e.id === id && !e.isDeleted),
      );
      if (toDash.length || toUndash.length) {
        toDash.forEach((id) => dashedIdsRef.current.add(id));
        toUndash.forEach((id) => dashedIdsRef.current.delete(id));
        requestAnimationFrame(() => {
          const a = apiRef.current;
          if (!a) return;
          a.updateScene({
            elements: a.getSceneElementsIncludingDeleted().map((e) =>
              toDash.includes(e.id)
                ? { ...e, ...NEW_BOX_STYLE, version: e.version + 1 }
                : toUndash.includes(e.id)
                  ? { ...e, strokeStyle: "solid", backgroundColor: "transparent", version: e.version + 1 }
                  : e,
            ),
            captureUpdate: CaptureUpdateAction.NEVER, // styling, not a user edit: keep it out of undo
          });
        });
      }
      requestAnimationFrame(() =>
        setNewBoxRects((prev) => (JSON.stringify(prev) === JSON.stringify(nbRects) ? prev : nbRects)),
      );

      // Compute notes and report changes
      const notes = notesFromElements(elArray);
      const notesJson = JSON.stringify(notes);
      if (notesJson !== lastNotesJsonRef.current) {
        lastNotesJsonRef.current = notesJson;
        onNotesChange(notes);
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
    [onDrawingChange, onNotesChange, state.repoPath],
  );

  // Etch's own controls (DESIGN.md §6 v2) drive Excalidraw through its API
  const selectTool = useCallback((type: ToolType) => {
    apiRef.current?.setActiveTool({ type });
  }, []);

  // Excalidraw has no undo API; its keyboard handler on the .excalidraw element does it
  const sendUndoKey = useCallback((redo: boolean) => {
    containerRef.current?.querySelector(".excalidraw")?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "z", code: "KeyZ", ctrlKey: true, shiftKey: redo, bubbles: true, cancelable: true }),
    );
  }, []);

  // Zoom around the canvas centre so what you look at stays put
  const zoomTo = useCallback((next: (zoom: number) => number) => {
    const a = apiRef.current;
    const el = containerRef.current;
    if (!a || !el) return;
    const s = a.getAppState();
    const v = zoomAround(
      { scrollX: s.scrollX, scrollY: s.scrollY, zoom: s.zoom.value },
      next(s.zoom.value),
      { x: el.clientWidth / 2, y: el.clientHeight / 2 },
    );
    a.updateScene({ appState: { scrollX: v.scrollX, scrollY: v.scrollY, zoom: { value: v.zoom } as AppState["zoom"] } });
  }, []);

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

  const tags: BoxTag[] = [
    ...Object.entries(newBoxRects).map(([name, rect]) => ({ name, rect, kind: "new" as const, visible: true })),
    ...created
      .filter((name) => boxRects[name])
      .map((name) => ({ name, rect: boxRects[name], kind: "created" as const, visible: createdVisible })),
  ];
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
        tags={tags}
        view={view}
        containerRect={containerRect}
        onHover={onHover}
      />

      {/* Etch toolbar (top centre) and view controls (bottom right) */}
      <Toolbar active={activeTool} onSelect={selectTool} />
      <ViewControls
        zoom={view.zoom}
        onUndo={() => sendUndoKey(false)}
        onRedo={() => sendUndoKey(true)}
        onZoomOut={() => zoomTo((z) => stepZoom(z, -1))}
        onZoomIn={() => zoomTo((z) => stepZoom(z, 1))}
        onResetZoom={() => zoomTo(() => 1)}
        onFit={() => fitScene(apiRef.current)}
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
            fontSize: 12,
            letterSpacing: "0.04em",
          }}>
            {sealDate} · {boxCount} BOXES · {ruleCount} RULES
          </span>
        </div>
      </div>

      {/* Legend, bottom-left (DESIGN.md §6 v2, §9) */}
      <div className="canvas-legend">
        <span className="legend-item">
          <svg width="22" height="6" aria-hidden="true">
            <path d="M1 3h20" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          you allowed
        </span>
        <span className="legend-item">
          <svg width="22" height="6" aria-hidden="true">
            <path d="M1 3h20" stroke="var(--violation)" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />
          </svg>
          code does it anyway
        </span>
        <span className="legend-item" title="Draw a box, name it, connect it with an arrow: Bob builds the package">
          <svg width="18" height="12" aria-hidden="true">
            <rect x="1" y="1" width="16" height="10" rx="3" fill="none" stroke="var(--ink)" strokeWidth="1.3" strokeDasharray="3 2.5" />
          </svg>
          new box
        </span>
        <span className="legend-hint" title="Only code boxes, new boxes and arrows between them are rules">
          Anything else is a note
        </span>      </div>
    </div>
  );
}
