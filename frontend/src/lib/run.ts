import type { MakeItSoRequest } from "../types";
import type { Action } from "./state";

/**
 * startRun — seam for task 5.
 * For now dispatches runStarted then runFailed.
 * Task 5 replaces the body with the real SSE client.
 */
export function startRun(_req: MakeItSoRequest, dispatch: (a: Action) => void): () => void {
  dispatch({ type: "runStarted", now: Date.now() });

  const tid = setTimeout(() => {
    dispatch({ type: "runFailed", error: "Make it so is wired in task 5" });
  }, 0);

  // Return a cancel function
  return () => {
    clearTimeout(tid);
  };
}
