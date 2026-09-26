import { describe, expect, it } from "vitest";
import { clock, describeRunOutput, describeToolUse, parseSse, relativize } from "./bobEvents";

describe("parseSse", () => {
  it("returns complete data events and keeps the unfinished tail", () => {
    const chunk = 'data: {"kind":"violations","violations":[]}\n\ndata: {"kind":"bob","event":{"type":"message"}}\n\ndata: {"kind":"do';
    const { events, rest } = parseSse(chunk);
    expect(events).toEqual([
      { kind: "violations", violations: [] },
      { kind: "bob", event: { type: "message" } },
    ]);
    expect(rest).toBe('data: {"kind":"do');
    expect(parseSse(rest + 'ne","coins":0.1}\n\n').events).toEqual([{ kind: "done", coins: 0.1 }]);
  });

  it("tolerates CRLF and ignores non-data lines", () => {
    expect(parseSse(': ping\r\n\r\ndata: {"a":1}\r\n\r\n').events).toEqual([{ a: 1 }]);
  });
});

describe("describeToolUse (DESIGN.md §7 verb map)", () => {
  it("maps Bob's tools to short verbs with the file or command as detail", () => {
    expect(describeToolUse({ tool_name: "read_file", parameters: { path: "shop/api/orders.py" } })).toEqual({
      verb: "read", detail: "shop/api/orders.py", suf: "", tone: "muted",
    });
    expect(describeToolUse({ tool_name: "update_todo_list", parameters: {} })).toMatchObject({ verb: "plan" });
    expect(describeToolUse({ tool_name: "apply_diff", parameters: { path: "shop/api/users.py" } })).toMatchObject({
      verb: "edit", detail: "shop/api/users.py",
    });
    expect(describeToolUse({ tool_name: "execute_command", parameters: { command: "python -m pytest -q" } })).toMatchObject({
      verb: "run", detail: "python -m pytest -q",
    });
  });

  it("counts written lines as a green +N suffix", () => {
    expect(describeToolUse({ tool_name: "write_to_file", parameters: { path: "shop/services/notify.py", content: "a\nb\nc\n" } })).toEqual({
      verb: "write", detail: "shop/services/notify.py", suf: "+3", tone: "obeys",
    });
  });

  it("labels subagents as explore", () => {
    expect(describeToolUse({ tool_name: "new_task", parameters: { message: "find callers" } })).toMatchObject({
      verb: "explore", suf: "subagent",
    });
  });

  it("falls back to the raw tool name", () => {
    expect(describeToolUse({ tool_name: "list_code_definition_names", parameters: {} })).toMatchObject({
      verb: "list_code_definition_names", detail: "",
    });
  });
});

describe("describeRunOutput", () => {
  it("pulls the pytest verdict out of command output", () => {
    expect(describeRunOutput("....\n10 passed in 0.05s")).toEqual({ suf: "10 passed", tone: "obeys" });
    expect(describeRunOutput("F...\n1 failed, 9 passed in 0.1s")).toEqual({ suf: "1 failed", tone: "violation" });
    expect(describeRunOutput("done")).toEqual({ suf: "", tone: "muted" });
  });
});

describe("clock", () => {
  it("formats elapsed ms as mm:ss", () => {
    expect(clock(0)).toBe("00:00");
    expect(clock(7_900)).toBe("00:07");
    expect(clock(83_000)).toBe("01:23");
  });
});

describe("Bob Shell paths and verbs (live run)", () => {
  it("shows absolute Windows paths from the root package on", () => {
    expect(relativize("C:\\Users\\u\\etch\\demo-app\\shop\\api\\orders.py", "shop")).toBe("shop/api/orders.py");
    expect(relativize('type "C:\\Users\\u\\demo-app\\shop\\services\\pricing.py"', "shop"))
      .toBe('type "shop/services/pricing.py"');
    expect(relativize("python -m pytest -q", "shop")).toBe("python -m pytest -q");
    expect(relativize("C:\\x\\shop\\a.py", "")).toBe("C:\\x\\shop\\a.py");
  });

  it("maps Bob Shell's write_file to write", () => {
    const d = describeToolUse(
      { tool_name: "write_file", parameters: { path: "C:\\r\\demo-app\\shop\\pricing\\__init__.py", content: "a\nb\n" } },
      "shop",
    );
    expect(d).toEqual({ verb: "write", detail: "shop/pricing/__init__.py", suf: "+2", tone: "obeys" });
  });
});
