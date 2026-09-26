import { useCallback, useEffect, useRef, useReducer } from "react";
import type { Drawing } from "./types";
import { reducer, initialState } from "./lib/state";
import { drawingOfGraph } from "./lib/drawing";
import { scan, check, contracts, etchIt } from "./api";
import { startRun } from "./lib/run";
import { simulateRun } from "./lib/simulate";
import type { MakeItSoRequest } from "./types";
import { TopBar } from "./components/TopBar";
import { FirstRun } from "./components/FirstRun";
import { Canvas } from "./components/Canvas";
import { Rail } from "./components/Rail";

/** Compare two layer-id sets (both sorted) */
function layerSetKey(graph: import("./types").ArchGraph | null): string {
  if (!graph) return "";
  return graph.layers.map((l) => l.id).sort().join(",");
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const checkCounterRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelRunRef = useRef<(() => void) | null>(null);
  const checkDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine simulate mode
  const isSimulated = typeof window !== "undefined" &&
    window.location.search.includes("simulate");

  // Clock tick while running
  useEffect(() => {
    if (state.phase === "running") {
      if (!tickRef.current) {
        tickRef.current = setInterval(() => {
          dispatch({ type: "tick", now: Date.now() });
        }, 250);
      }
    } else {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    }
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [state.phase]);

  // --- Handlers ---

  const handleScan = useCallback(async (repoPath: string) => {
    dispatch({ type: "scanStarted", repoPath });
    try {
      const graph = await scan({ repo_path: repoPath });

      // Detect changed layer set
      const newLayerKey = layerSetKey(graph);
      const oldLayerKey = layerSetKey(state.graph);
      const layersChanged = newLayerKey !== oldLayerKey;

      if (layersChanged || state.graph === null) {
        dispatch({
          type: "scanSucceeded",
          graph,
          drawing: drawingOfGraph(graph),
        });
      } else {
        dispatch({
          type: "scanSucceeded",
          graph,
          drawing: state.drawing,
        });
      }

      // Immediately run a check
      const checkReq = {
        repo_path: repoPath,
        root_package: graph.root_package,
        drawing: layersChanged || state.graph === null
          ? drawingOfGraph(graph)
          : state.drawing,
      };
      const resp = await check(checkReq);
      dispatch({ type: "checkSucceeded", violations: resp.violations });
    } catch (err) {
      dispatch({
        type: "scanFailed",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, [state.graph, state.drawing]);

  const handleRescan = useCallback(() => {
    handleScan(state.repoPath);
  }, [handleScan, state.repoPath]);

  const handleDrawingChange = useCallback((drawing: Drawing) => {
    dispatch({ type: "drawingChanged", drawing });

    if (!state.graph) return;

    // Debounce 250ms then check
    if (checkDebounceRef.current) clearTimeout(checkDebounceRef.current);
    const counter = ++checkCounterRef.current;
    checkDebounceRef.current = setTimeout(async () => {
      try {
        const resp = await check({
          repo_path: state.repoPath,
          root_package: state.graph!.root_package,
          drawing,
        });
        // Drop out-of-order responses
        if (counter !== checkCounterRef.current) return;
        dispatch({ type: "checkSucceeded", violations: resp.violations });
      } catch {
        // silently ignore check errors
      }
    }, 250);
  }, [state.graph, state.repoPath]);

  const handleHover = useCallback((edge: string | null) => {
    dispatch({ type: "hover", edge });
  }, []);

  const handleMakeItSo = useCallback(() => {
    if (state.phase !== "idle" && state.phase !== "error") return;
    if (!state.graph) return;

    const req: MakeItSoRequest = {
      repo_path: state.repoPath,
      root_package: state.graph.root_package,
      drawing: state.drawing,
    };

    if (isSimulated) {
      cancelRunRef.current = simulateRun(state, dispatch);
    } else {
      cancelRunRef.current = startRun(req, dispatch);
    }
  }, [state, isSimulated]);

  const handleStop = useCallback(() => {
    if (cancelRunRef.current) {
      cancelRunRef.current();
      cancelRunRef.current = null;
    }
    dispatch({ type: "runFailed", error: "Stopped by user" });
  }, []);

  const handleEtchIt = useCallback(async () => {
    if (!state.graph) return;
    try {
      const req = {
        repo_path: state.repoPath,
        root_package: state.graph.root_package,
        drawing: state.drawing,
      };
      // Simulated runs never touched the code, so never write contracts into the
      // repo either: compile them read-only and show what would be written.
      const resp = isSimulated
        ? { written: [".importlinter"], importlinter: (await contracts(req)).importlinter }
        : await etchIt(req);
      dispatch({
        type: "etchSucceeded",
        written: resp.written,
        importlinter: resp.importlinter,
      });
    } catch (err) {
      // show error
      dispatch({
        type: "runFailed",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, [state.graph, state.repoPath, state.drawing, isSimulated]);

  // Keyboard shortcut: Ctrl+Enter → Make it so
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (state.phase === "idle" || state.phase === "error") {
          handleMakeItSo();
        }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [state.phase, handleMakeItSo]);

  // Show FirstRun while empty or scanning (and no graph yet)
  const showFirstRun = state.phase === "empty" || (state.phase === "scanning" && state.graph === null);

  if (showFirstRun) {
    return (
      <div className="app-layout">
        <TopBar state={state} onRescan={handleRescan} firstRun />
        <FirstRun state={state} onScan={handleScan} />
      </div>
    );
  }

  return (
    <div className="app-layout">
      <TopBar state={state} onRescan={handleRescan} />
      <div className="app-body">
        <Canvas
          state={state}
          onDrawingChange={handleDrawingChange}
          onHover={handleHover}
        />
        <Rail
          state={state}
          simulated={isSimulated}
          onHover={handleHover}
          onMakeItSo={handleMakeItSo}
          onStop={handleStop}
          onEtchIt={handleEtchIt}
        />
      </div>
    </div>
  );
}
