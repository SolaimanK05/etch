import type { ArchGraph, Drawing, NewBox, Violation } from "../types";

export type Phase = "empty" | "scanning" | "idle" | "running" | "done" | "etched" | "error";
export type RowStatus = "open" | "queued" | "fixing" | "fixed";

export interface Row {
  key: string;       // "file:line"
  source: string;
  target: string;
  file: string;
  path: string;      // file without the <root>/ prefix
  line: number;
  code: string;
  status: RowStatus;
}

export interface LogLine {
  t: string;
  verb: string;
  detail: string;
  suf: string;
  tone: "muted" | "obeys" | "violation";
}

export interface Toast {
  path: string;
  msg: string;
  seq: number;
}

export interface State {
  phase: Phase;
  scanning: boolean;
  repoPath: string;
  graph: ArchGraph | null;
  drawing: Drawing;
  rows: Row[];
  rowsEpoch: number;
  hover: string | null;
  branch: string;
  log: LogLine[];
  startedAt: number | null;
  elapsedMs: number;
  coins: number | null;
  builtBoxes: NewBox[];   // drawn boxes Bob turned into packages during the last run
  toast: Toast | null;
  written: string[];
  importlinter: string;
  error: string | null;
}

export type Action =
  | { type: "scanStarted"; repoPath: string }
  | { type: "scanSucceeded"; graph: ArchGraph; drawing: Drawing }
  | { type: "scanFailed"; error: string }
  | { type: "drawingChanged"; drawing: Drawing }
  | { type: "checkSucceeded"; violations: Violation[] }
  | { type: "hover"; edge: string | null }
  | { type: "etchSucceeded"; written: string[]; importlinter: string }
  | { type: "runStarted"; now: number }
  | { type: "runLog"; line: LogLine }
  | { type: "runViolations"; violations: Violation[] }
  | { type: "runLayers"; layers: import("../types").Layer[] }
  | { type: "runFinished"; coins: number; durationMs: number; boxesMissing?: string[] }
  | { type: "runFailed"; error: string }
  | { type: "tick"; now: number }
  | { type: "reset" };

export const initialState: State = {
  phase: "empty",
  scanning: false,
  repoPath: "demo-app",
  graph: null,
  drawing: { layers: [], arrows: [], new_boxes: [] },
  rows: [],
  rowsEpoch: 0,
  hover: null,
  branch: "main",
  log: [],
  startedAt: null,
  elapsedMs: 0,
  coins: null,
  builtBoxes: [],
  toast: null,
  written: [],
  importlinter: "",
  error: null,
};

export function edgeKey(source: string, target: string): string {
  return `${source}>${target}`;
}

export function rowsFromViolations(violations: Violation[], root: string): Row[] {
  const rows: Row[] = [];
  for (const v of violations) {
    for (const imp of v.imports) {
      const key = `${imp.file}:${imp.line}`;
      // path = file without the "<root>/" prefix
      const prefix = root + "/";
      const path = imp.file.startsWith(prefix) ? imp.file.slice(prefix.length) : imp.file;
      rows.push({
        key,
        source: v.source,
        target: v.target,
        file: imp.file,
        path,
        line: imp.line,
        code: imp.code,
        status: "open",
      });
    }
  }
  return rows;
}

// --- Selectors ---

/** Imports still breaking the drawing: every row not yet fixed (open, queued or fixing). */
export function openCount(state: State): number {
  return state.rows.filter((r) => r.status !== "fixed").length;
}

/** Number of new boxes still waiting to be built. */
export function newBoxCount(state: State): number {
  return state.drawing.new_boxes.length;
}

/** Total work for Bob: open imports + pending new boxes. */
export function workCount(state: State): number {
  return openCount(state) + newBoxCount(state);
}

export function canEtch(state: State): boolean {
  if (state.phase === "done") return true;
  if (state.phase === "idle" && state.graph !== null && openCount(state) === 0 && newBoxCount(state) === 0) return true;
  return false;
}

export function progress(state: State): number {
  const total = state.rows.length;
  if (total === 0) return 0;
  const fixed = state.rows.filter((r) => r.status === "fixed").length;
  return fixed / total;
}

export function edgeCounts(state: State): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of state.rows) {
    if (row.status !== "fixed") {
      const k = edgeKey(row.source, row.target);
      counts[k] = (counts[k] ?? 0) + 1;
    }
  }
  return counts;
}

export function knownEdges(state: State): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const row of state.rows) {
    const k = edgeKey(row.source, row.target);
    if (!seen.has(k)) {
      seen.add(k);
      result.push(k);
    }
  }
  return result;
}

// --- Reducer ---

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "scanStarted": {
      return {
        ...state,
        scanning: true,
        error: null,
        phase: state.graph === null ? "scanning" : state.phase,
        repoPath: action.repoPath,
      };
    }

    case "scanSucceeded": {
      return {
        ...state,
        phase: "idle",
        scanning: false,
        graph: action.graph,
        drawing: action.drawing,
        rows: [],
        rowsEpoch: state.rowsEpoch + 1,
        branch: "main",
        log: [],
        coins: null,
        builtBoxes: [],
        written: [],
        importlinter: "",
        error: null,
      };
    }

    case "scanFailed": {
      return {
        ...state,
        scanning: false,
        error: action.error,
        phase: state.graph === null ? "empty" : state.phase,
      };
    }

    case "drawingChanged": {
      return { ...state, drawing: action.drawing };
    }

    case "checkSucceeded": {
      // Ignored in running
      if (state.phase === "running") return state;

      if (state.phase === "idle" || state.phase === "error") {
        return {
          ...state,
          phase: "idle",
          rows: rowsFromViolations(action.violations, state.graph?.root_package ?? ""),
        };
      }

      // done / etched: only reopen if violations aren't empty
      if (state.phase === "done" || state.phase === "etched") {
        if (action.violations.length > 0) {
          return {
            ...state,
            phase: "idle",
            rows: rowsFromViolations(action.violations, state.graph?.root_package ?? ""),
          };
        }
        return state;
      }

      return state;
    }

    case "hover": {
      return { ...state, hover: action.edge };
    }

    case "etchSucceeded": {
      return {
        ...state,
        phase: "etched",
        written: action.written,
        importlinter: action.importlinter,
      };
    }

    case "runStarted": {
      const firstNonFixed = state.rows.findIndex((r) => r.status !== "fixed");
      const startedRows = state.rows.map((r, i) => {
        if (r.status === "fixed") return r;
        if (i === firstNonFixed) return { ...r, status: "fixing" as RowStatus };
        return { ...r, status: "queued" as RowStatus };
      });
      return {
        ...state,
        phase: "running",
        branch: "etch/make-it-so",
        rows: startedRows,
        log: [],
        coins: null,
        builtBoxes: [],
        startedAt: action.now,
        elapsedMs: 0,
      };
    }

    case "runLog": {
      const log = [...state.log, action.line].slice(-11);
      return { ...state, log };
    }

    case "runViolations": {
      const violationKeys = new Set<string>();
      for (const v of action.violations) {
        for (const imp of v.imports) {
          violationKeys.add(`${imp.file}:${imp.line}`);
        }
      }

      // Rows whose key is no longer present become "fixed"
      const newlyFixed: Row[] = [];
      const updatedRows = state.rows.map((r) => {
        if (r.status !== "fixed" && !violationKeys.has(r.key)) {
          newlyFixed.push(r);
          return { ...r, status: "fixed" as RowStatus };
        }
        return r;
      });

      // If nothing is "fixing", the first "queued" row becomes "fixing"
      let finalRows = updatedRows;
      const hasFixing = finalRows.some((r) => r.status === "fixing");
      if (!hasFixing) {
        const firstQueued = finalRows.findIndex((r) => r.status === "queued");
        if (firstQueued >= 0) {
          finalRows = finalRows.map((r, i) =>
            i === firstQueued ? { ...r, status: "fixing" as RowStatus } : r
          );
        }
      }

      // Toast for newly fixed rows
      let toast = state.toast;
      if (newlyFixed.length > 0) {
        const firstFixed = newlyFixed[0];
        const src = firstFixed.source;
        const tgt = firstFixed.target;
        // Find first drawn layer X where src→X and X→tgt both exist as arrows
        const arrows = state.drawing.arrows;
        const arrowSet = new Set(arrows.map((a) => `${a.source}>${a.target}`));
        const middle = state.drawing.layers.find(
          (l) => l !== src && l !== tgt && arrowSet.has(`${src}>${l}`) && arrowSet.has(`${l}>${tgt}`)
        );
        const msg = middle ? `now goes through ${middle}` : "no longer crosses the drawing";
        toast = {
          path: firstFixed.path,
          msg,
          seq: (state.toast?.seq ?? 0) + 1,
        };
      }

      return { ...state, rows: finalRows, toast };
    }

    case "runLayers": {
      if (state.graph === null) return state;
      const done = new Set(state.builtBoxes.map((b) => b.id));
      const nowBuilt = state.drawing.new_boxes.filter(
        (b) => !done.has(b.id) && action.layers.some((l) => l.id === b.id && l.files >= 2),
      );
      return {
        ...state,
        graph: { ...state.graph, layers: action.layers },
        builtBoxes: nowBuilt.length ? [...state.builtBoxes, ...nowBuilt] : state.builtBoxes,
      };
    }

    case "runFinished": {
      const openRows = state.rows.filter((r) => r.status !== "fixed");
      const boxesMissing = action.boxesMissing ?? [];
      if (openRows.length === 0) {
        // No open rows: check missing boxes
        if (boxesMissing.length > 0) {
          const names = boxesMissing.join(", ");
          const n = boxesMissing.length;
          return {
            ...state,
            phase: "error",
            error: `Bob didn't create the ${names} package${n > 1 ? "s" : ""}`,
            coins: action.coins,
            elapsedMs: action.durationMs,
            startedAt: null,
          };
        }
        return {
          ...state,
          phase: "done",
          coins: action.coins,
          elapsedMs: action.durationMs,
          startedAt: null,
        };
      }
      const count = openRows.length;
      const errMsg = count === 1
        ? "1 import still breaks the drawing"
        : `${count} imports still break the drawing`;
      return {
        ...state,
        phase: "error",
        error: errMsg,
        coins: action.coins,
        elapsedMs: action.durationMs,
        startedAt: null,
        rows: state.rows.map((r) => r.status === "fixed" ? r : { ...r, status: "open" as RowStatus }),
      };
    }

    case "runFailed": {
      return {
        ...state,
        phase: "error",
        error: action.error,
        startedAt: null,
        rows: state.rows.map((r) => r.status === "fixed" ? r : { ...r, status: "open" as RowStatus }),
      };
    }

    case "tick": {
      if (state.phase !== "running" || state.startedAt === null) return state;
      return { ...state, elapsedMs: action.now - state.startedAt };
    }

    case "reset": {
      return initialState;
    }

    default: {
      return state;
    }
  }
}
