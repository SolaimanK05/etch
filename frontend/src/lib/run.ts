/**
 * run.ts — real SSE client for POST /api/make-it-so (task 5).
 */

import type { MakeItSoRequest, Violation } from "../types";
import type { Action } from "./state";
import { parseSse, describeToolUse, describeRunOutput, clock } from "./bobEvents";
import { stopRun } from "../api";

export function startRun(req: MakeItSoRequest, dispatch: (a: Action) => void): () => void {
  const now = Date.now();
  dispatch({ type: "runStarted", now });

  const controller = new AbortController();
  let aborted = false;

  // Map of tool_id → command string for execute_command tools
  const pendingCommands = new Map<string, string>();

  let finishedCleanly = false;

  (async () => {
    let resp: Response;
    try {
      resp = await fetch("/api/make-it-so", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
        signal: controller.signal,
      });
    } catch (err) {
      if (aborted) return;
      dispatch({ type: "runFailed", error: err instanceof Error ? err.message : String(err) });
      return;
    }

    if (!resp.ok) {
      if (aborted) return;
      const json = await resp.json().catch(() => ({}));
      const detail = (json as { detail?: string }).detail ?? resp.statusText;
      dispatch({ type: "runFailed", error: `${resp.status}: ${detail}` });
      return;
    }

    const reader = resp.body?.getReader();
    if (!reader) {
      if (aborted) return;
      dispatch({ type: "runFailed", error: "No response body" });
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer = (buffer + decoder.decode(value, { stream: true }));
        const { events, rest } = parseSse(buffer);
        buffer = rest;

        for (const ev of events) {
          const event = ev as Record<string, unknown>;
          const kind = event.kind as string;

          if (kind === "violations") {
            dispatch({ type: "runViolations", violations: event.violations as Violation[] });

          } else if (kind === "bob") {
            const bobEv = event.event as Record<string, unknown>;
            const evType = bobEv.type as string;
            const data = bobEv.data as Record<string, unknown>;

            if (evType === "tool_use") {
              const toolName = data.tool_name as string;
              const toolId = data.tool_id as string;
              const parameters = (data.parameters ?? {}) as Record<string, unknown>;

              if (toolName === "execute_command") {
                // Remember for when tool_result arrives
                pendingCommands.set(toolId, (parameters.command as string | undefined) ?? "");
              } else {
                const t = clock(Date.now() - now);
                const desc = describeToolUse({ tool_name: toolName, parameters });
                dispatch({
                  type: "runLog",
                  line: { t, verb: desc.verb, detail: desc.detail, suf: desc.suf, tone: desc.tone },
                });
              }

            } else if (evType === "tool_result") {
              const toolId = data.tool_id as string;
              const command = pendingCommands.get(toolId);
              if (command !== undefined) {
                pendingCommands.delete(toolId);
                const output = (data.output as string | undefined) ?? "";
                const runDesc = describeRunOutput(output);
                const t = clock(Date.now() - now);
                dispatch({
                  type: "runLog",
                  // show "python -m pytest -q", not the full venv path
                  line: { t, verb: "run", detail: command.replace(/^"?\S*[\\/](python(?:\.exe)?)"?/i, "python"), suf: runDesc.suf, tone: runDesc.tone },
                });
              }
            }
            // result events are handled via done/error kinds; no log needed here

          } else if (kind === "tests") {
            const ok = event.ok as boolean;
            const summary = event.summary as string;
            const t = clock(Date.now() - now);
            dispatch({
              type: "runLog",
              line: {
                t,
                verb: "test",
                detail: "pytest -q",
                suf: summary,
                tone: ok ? "obeys" : "violation",
              },
            });

          } else if (kind === "done") {
            const coins = event.coins as number | undefined;
            const duration_ms = event.duration_ms as number | undefined;
            const violations_left = event.violations_left as number | undefined;
            const elapsed = Date.now() - now;
            const t = clock(elapsed);
            dispatch({
              type: "runLog",
              line: {
                t,
                verb: "rescan",
                detail: 'etch scan',
                suf: violations_left === 0 ? "0 violations" : `${violations_left} violations`,
                tone: violations_left === 0 ? "obeys" : "violation",
              },
            });
            dispatch({
              type: "runFinished",
              coins: coins ?? 0,
              durationMs: duration_ms ?? elapsed,
            });
            finishedCleanly = true;

          } else if (kind === "error") {
            if (aborted) return;
            dispatch({ type: "runFailed", error: event.message as string });
            finishedCleanly = true;
            return;
          }
        }
      }
    } catch (err) {
      if (aborted) return;
      dispatch({ type: "runFailed", error: err instanceof Error ? err.message : String(err) });
      return;
    }

    if (!finishedCleanly && !aborted) {
      dispatch({ type: "runFailed", error: "Connection to Etch closed" });
    }
  })();

  return () => {
    aborted = true;
    controller.abort();
    stopRun();
  };
}
