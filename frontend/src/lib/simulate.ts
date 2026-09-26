import type { Action, State } from "./state";

const STEP_MS = 450;

interface ScriptStep {
  t: number;
  verb: string;
  detail: string;
  suf?: string;
  tone: "muted" | "obeys" | "violation";
  coins: number;
  fixRowIndex?: number;   // index into state.rows to mark fixed (via runViolations)
  startRowIndex?: number; // index to mark fixing
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function clockStr(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
}

export function simulateRun(state: State, dispatch: (a: Action) => void): () => void {
  const rows = state.rows.filter((r) => r.status !== "fixed");
  const newBoxes = state.drawing.new_boxes;
  const timers: ReturnType<typeof setTimeout>[] = [];
  let cancelled = false;

  function later(fn: () => void, ms: number) {
    const id = setTimeout(() => {
      if (!cancelled) fn();
    }, ms);
    timers.push(id);
  }

  const t0 = Date.now();
  dispatch({ type: "runStarted", now: t0 });

  // Build script
  let step = 0;
  let coinsAccum = 0;
  const totalCoins = 0.64;
  const totalWork = rows.length + newBoxes.length;
  const coinsPerStep = totalWork > 0 ? totalCoins / (totalWork * 4 + 3) : totalCoins;

  const steps: ScriptStep[] = [];

  // Step: read .etch/drawing.json
  steps.push({
    t: step++ * STEP_MS,
    verb: "read",
    detail: ".etch/drawing.json",
    tone: "muted",
    coins: coinsAccum += coinsPerStep,
  });

  // Step: plan N imports[, M new boxes][, 1 rule each]
  const planCount = rows.length;
  const boxCount = newBoxes.length;
  const planParts: string[] = [];
  if (planCount > 0) planParts.push(`${planCount} import${planCount !== 1 ? "s" : ""}`);
  if (boxCount > 0) planParts.push(`${boxCount} new box${boxCount !== 1 ? "es" : ""}`);
  if (planCount > 0) planParts.push("1 rule each");
  steps.push({
    t: step++ * STEP_MS,
    verb: "plan",
    detail: planParts.join(", "),
    tone: "muted",
    coins: coinsAccum += coinsPerStep,
  });

  // Step: explore
  const rootTarget = rows[0]?.target ?? "target";
  steps.push({
    t: step++ * STEP_MS,
    verb: "explore",
    detail: `callers of ${state.graph?.root_package ?? "app"}.${rootTarget}`,
    suf: "subagent",
    tone: "muted",
    coins: coinsAccum += coinsPerStep,
  });

  // Steps for each new box: write __init__.py and dispatch runLayers
  const root = state.graph?.root_package ?? "app";
  for (const box of newBoxes) {
    const boxStepIndex = step++;
    steps.push({
      t: boxStepIndex * STEP_MS,
      verb: "write",
      detail: `${root}/${box.id}/__init__.py`,
      suf: "+1",
      tone: "obeys",
      coins: coinsAccum += coinsPerStep,
    });
  }

  // For each row: write, edit, run pytest, then runViolations
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // the fix lands in a services module named after the offending file
    const layerName = (row.path.split("/").pop() ?? "module.py").replace(/\.py$/, "");

    // write services/<name>.py
    steps.push({
      t: step++ * STEP_MS,
      verb: "write",
      detail: `services/${layerName}.py`,
      suf: "+12",
      tone: "obeys",
      coins: coinsAccum += coinsPerStep,
    });

    // edit <row.path>
    steps.push({
      t: step++ * STEP_MS,
      verb: "edit",
      detail: row.path,
      suf: "−1 +1",
      tone: "muted",
      coins: coinsAccum += coinsPerStep,
    });

    // run pytest -q (obeys) → also fixes this row
    steps.push({
      t: step++ * STEP_MS,
      verb: "run",
      detail: "pytest -q",
      suf: "10 passed",
      tone: "obeys",
      coins: coinsAccum += coinsPerStep,
      fixRowIndex: i,
      startRowIndex: i + 1 < rows.length ? i + 1 : undefined,
    });
  }

  // Final rescan
  steps.push({
    t: step++ * STEP_MS,
    verb: "rescan",
    detail: "etch scan",
    suf: "0 violations",
    tone: "obeys",
    coins: totalCoins,
  });

  const totalDuration = step * STEP_MS;

  // Index of the first new-box step (after explore step at index 2)
  const newBoxStepStart = 3;

  // Schedule log lines and violations
  for (let si = 0; si < steps.length; si++) {
    const s = steps[si];
    const logLine = {
      t: clockStr(s.t),
      verb: s.verb,
      detail: s.detail,
      suf: s.suf ?? "",
      tone: s.tone,
    };

    later(() => {
      dispatch({ type: "runLog", line: logLine });

      // After each new-box write step, dispatch runLayers with the new box added
      if (si >= newBoxStepStart && si < newBoxStepStart + newBoxes.length) {
        const boxesSoFar = newBoxes.slice(0, si - newBoxStepStart + 1);
        const extraLayers = boxesSoFar.map((b) => ({
          id: b.id,
          module: `${root}.${b.id}`,
          files: 2,
        }));
        dispatch({
          type: "runLayers",
          layers: [...(state.graph?.layers ?? []), ...extraLayers],
        });
      }

      // After each pytest "run" that fixes a row, dispatch runViolations
      if (s.fixRowIndex !== undefined) {
        // violations = remaining rows after this fix
        const fixedKeys = new Set(
          rows.slice(0, s.fixRowIndex + 1).map((r) => r.key)
        );
        const remaining = state.rows.filter(
          (r) => r.status === "fixed" || !fixedKeys.has(r.key)
        );
        // Build violation list from remaining unfixed rows
        const violations = remaining
          .filter((r) => r.status !== "fixed" && !fixedKeys.has(r.key))
          .map((r) => ({
            source: r.source,
            target: r.target,
            imports: [{ importer: r.source, imported: r.target, file: r.file, line: r.line, code: r.code }],
          }));
        dispatch({ type: "runViolations", violations });
      }
    }, s.t + STEP_MS * 0.5);
  }

  // Finish
  later(() => {
    dispatch({
      type: "runFinished",
      coins: totalCoins,
      durationMs: totalDuration,
      boxesMissing: [],
    });
  }, totalDuration + STEP_MS);

  return () => {
    cancelled = true;
    timers.forEach(clearTimeout);
  };
}
