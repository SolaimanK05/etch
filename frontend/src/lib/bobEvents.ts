/**
 * bobEvents.ts — SSE parsing and Bob event description utilities (task 5).
 */

export interface SseResult {
  events: unknown[];
  rest: string;
}

/**
 * Parse Server-Sent Events from a raw text chunk.
 * Returns complete parsed events and the unfinished tail.
 */
export function parseSse(chunk: string): SseResult {
  const events: unknown[] = [];
  // Split on double newline (LF or CRLF) which terminates each SSE message
  const parts = chunk.split(/\r?\n\r?\n/);
  // The last part may be incomplete — keep it as the rest
  const rest = parts.pop() ?? "";
  for (const part of parts) {
    const lines = part.split(/\r?\n/);
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          events.push(JSON.parse(line.slice(6)));
        } catch {
          // ignore malformed JSON
        }
      }
      // Non-data lines (comments like ": ping") are ignored
    }
  }
  return { events, rest };
}

export interface ToolDescription {
  verb: string;
  detail: string;
  suf: string;
  tone: "muted" | "obeys" | "violation";
}

/**
 * Describe a Bob tool_use event as a short log line.
 */
export function describeToolUse(data: {
  tool_name: string;
  parameters: Record<string, unknown>;
}): ToolDescription {
  const { tool_name, parameters } = data;
  const detail =
    (parameters.path as string | undefined) ??
    (parameters.file_path as string | undefined) ??
    (parameters.command as string | undefined) ??
    "";

  // write_to_file: +N lines, obeys tone
  if (tool_name === "write_to_file") {
    const content = (parameters.content as string | undefined) ?? "";
    const lines = content.split("\n");
    // trailing newline produces an empty last element — don't count it
    const count = lines.length > 0 && lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
    return { verb: "write", detail, suf: `+${count}`, tone: "obeys" };
  }

  // subagent tools
  if (tool_name === "new_task" || tool_name.includes("subagent")) {
    return { verb: "explore", detail, suf: "subagent", tone: "muted" };
  }

  const VERBS: Record<string, string> = {
    read_file: "read",
    list_files: "list",
    search_files: "search",
    update_todo_list: "plan",
    apply_diff: "edit",
    search_and_replace: "edit",
    insert_content: "edit",
    edit_file: "edit",
    execute_command: "run",
  };

  const verb = VERBS[tool_name] ?? tool_name;
  return { verb, detail, suf: "", tone: "muted" };
}

export interface RunOutputDescription {
  suf: string;
  tone: "muted" | "obeys" | "violation";
}

/**
 * Summarise the output of an execute_command tool_result.
 */
export function describeRunOutput(output: string): RunOutputDescription {
  const lines = output.split("\n").filter((l) => l.trim() !== "");
  const last = lines[lines.length - 1] ?? "";
  // Match pytest summary: "10 passed in 0.05s" or "1 failed, 9 passed in 0.1s"
  // Only take the first "N word" segment (before any comma)
  const m = last.match(/^(\d+\s+\w+)(?:[^i]|i(?!n\s))*\s+in\s+[\d.]+s/);
  if (m) {
    const summary = m[1];
    const tone: "obeys" | "violation" = /failed/.test(summary) ? "violation" : "obeys";
    return { suf: summary, tone };
  }
  return { suf: "", tone: "muted" };
}

/**
 * Format elapsed milliseconds as mm:ss.
 */
export function clock(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
