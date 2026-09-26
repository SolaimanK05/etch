# Etch — Task 5: live "Make it so" (Bob runner, SSE stream, Stop, Undo)

Make the **Make it so** button real. The backend runs IBM Bob Shell headless on the target repo and streams its events to the UI as Server-Sent Events. After every Bob tool result it rescans (no AI involved), so red arrows turn green live. At the end it runs the repo's tests itself and reports the Bobcoin cost. Also add **Stop** and **Undo**. The tests already exist and are the spec.

## Scope (strict)
- **Backend:**
  - Edit `backend/etch/bob_runner.py` and `backend/etch/main.py`.
  - Create `backend/etch/gitops.py`.
- **Frontend:**
  - Create `frontend/src/lib/bobEvents.ts`.
  - Rewrite `frontend/src/lib/run.ts`.
  - Edit `frontend/src/api.ts`, `frontend/src/App.tsx` and `frontend/src/components/Rail.tsx` (Undo only).
- **Read only** those files, plus `backend/etch/models.py`, `frontend/src/lib/state.ts` (the actions), and the new tests: `backend/tests/test_bob_runner.py`, `backend/tests/test_make_it_so.py`, `backend/tests/test_gitops.py`, `backend/tests/fixtures/fake_bob.py` and `frontend/src/lib/bobEvents.test.ts`.
- **Do NOT modify** tests, fixtures, `models.py`, `state.ts`, `types.ts` or any other file.
- **NEVER run the real `bob` command in this task.** It costs Bobcoins. The tests use `fake_bob.py` via the `ETCH_BOB_CMD` env var.
- **Windows PowerShell:** use `.venv\Scripts\python.exe` and `npm.cmd`. No servers, no git commands.

## Backend

### `bob_runner.py` (imports only `etch.models` + stdlib)

- **`bob_command(max_cost: float) -> list[str]`:**
  - The base command is `json.loads(os.environ["ETCH_BOB_CMD"])` if that variable is set, else `[shutil.which("bob") or "bob"]`. On Windows, `which` returns `bob.CMD`.
  - Append `["run", "--mode", "agent", "--format", "stream-json", "--max-cost", f"{max_cost:g}", "--accept-license", "--trust"]`.
  - Keep subagents enabled; that's intended.
- **`parse_event(line: str) -> BobEvent | None`:**
  - A blank line returns `None`.
  - A JSON object line returns `BobEvent(type=obj.get("type", "unknown"), data=obj)`.
  - Anything else returns `BobEvent(type="log", data={"text": line.strip()})`.
- **`run_bob(prompt, workspace: Path, max_cost) -> Iterator[BobEvent]`:** change the stub into a **synchronous generator**. Its return type becomes `Iterator[BobEvent]`.
  1. **Guard:** a module-level lock plus `_current: subprocess.Popen | None` allow only one run at a time. If a run is active, yield one error event `"a Make it so run is already in progress"` and return.
  2. **Start:** `subprocess.Popen(bob_command(max_cost), cwd=workspace, stdin=PIPE, stdout=PIPE, stderr=PIPE)` in bytes mode.
     - Write the prompt UTF-8-encoded to stdin, then close stdin. The prompt goes via stdin because multi-line arguments break through `.cmd` files.
     - If Popen raises `FileNotFoundError`, yield `BobEvent(type="error", data={"message": "Bob Shell not found: install it and set BOB_API_KEY"})`.
  3. **Drain stderr** in a daemon thread into a `deque(maxlen=20)`, so the pipe can't deadlock.
  4. **Stream stdout:** read it line by line, decode UTF-8 with `errors="replace"`, and yield each `parse_event`, skipping `None`.
  5. **Finish:**
     - Call `wait()`.
     - If the exit code is non-zero **and** no `"result"` event was seen, yield `BobEvent(type="error", data={"message": f"Bob exited with exit code {rc}: {stderr tail joined}"})`.
     - Always clear `_current`, using try/finally.
- **`stop_current() -> bool`:**
  - Returns `False` if nothing is running.
  - Otherwise kill the whole process tree and return `True`. On Windows use `subprocess.run(["taskkill", "/T", "/F", "/PID", str(pid)], capture_output=True)`, because `bob.CMD` starts a child `node`. Elsewhere use `proc.kill()`.
- **`build_prompt(violations, drawing, root_package, python: str = sys.executable) -> str`** returns **exactly this template**. It's what live Bob receives, so keep the wording:

```
You are refactoring the Python package `{root}` in this workspace so that its imports obey an architecture drawing.

Allowed dependencies between its top-level packages (an arrow means "may import"):
{one line per drawn arrow: "- {source} → {target}"}
Every other import between {drawn layers joined with ", "} is forbidden. Going through an allowed package is fine (if a → b and b → c are drawn, a may call b which calls c).

These imports break the drawing. Fix every one of them:
{numbered, one block per import: "{n}. {file}:{line}  ({source} ↛ {target})\n   {code}"}

How to fix:
- Route each call through a package the drawing allows: add or reuse a function in an allowed package, or pass the data in as an argument. Moving the import inside a function or using importlib does not count; Etch scans those too.
- Keep every public function's name, signature and behaviour exactly as they are. The tests call them.
- Do not modify tests/, .importlinter, .etch/ or anything outside {root}/. Do not install packages. Do not run git.
- When your edits are done, run: {python} -m pytest -q
  It must pass. If it fails, fix the code (never the tests) and run it again.
- Stop when every listed import is gone and the tests pass. Reply with one line saying what you moved.
```

### `gitops.py` (no `etch` imports)
- **`class GitError(Exception)`.**
- **`discard_changes(path: Path) -> None`:**
  1. Check that `git -C <path> rev-parse --is-inside-work-tree` succeeds; otherwise raise `GitError`.
  2. Run `git -C <path> restore --source=HEAD --staged --worktree -- .`.
  3. Run `git -C <path> clean -fd -- .`.

  The pathspec `.` limits both commands to that folder. Any failure raises `GitError(stderr)`.

### `main.py`
- **`POST /api/make-it-so`** (plain `def`, `MakeItSoRequest`):
  - Resolve the repo and root first, so a bad repo gives a normal 400.
  - Return `StreamingResponse(make_it_so_stream(repo, root, req.drawing, req.max_cost), media_type="text/event-stream")`.
  - **Delete** the old async wrapper.
- **`make_it_so_stream`** is a sync generator yielding `f"data: {json.dumps(obj)}\n\n"`. Its protocol is in the docstring of `test_make_it_so.py`:
  1. Scan and find violations. If there are none, yield `{"kind": "error", "message": "nothing to fix: the code already obeys the drawing"}` and return. **Bob is not started.**
  2. Yield the initial violations event, using `v.model_dump()` for each violation.
  3. For each event from `run_bob(build_prompt(...), repo, max_cost)`:
     - **`error` event:** yield `{"kind": "error", "message": ...}` and return.
     - **Otherwise:** yield `{"kind": "bob", "event": ev.model_dump()}`.
     - **After every `tool_result`:** rescan. Skip it on `ScanError`, since a file may be half-edited. If the violations changed, as JSON, yield a new violations event.
     - **On a `result` event:** remember it.
  4. If no result was seen, yield the error `"Bob stopped before finishing"`.
  5. Do a final rescan, and yield the violations if they changed.
  6. Run the repo's tests: `subprocess.run([sys.executable, "-m", "pytest", "-q"], cwd=repo, capture_output=True, text=True, timeout=300)`. The summary is the last non-empty stdout line with the trailing ` in 0.05s` timing removed. Yield `{"kind": "tests", "ok": returncode == 0, "summary": summary}`.
  7. Yield `{"kind": "done", "coins": stats.session_costs, "duration_ms": stats.duration_ms, "violations_left": <total imports still violating>}`.
- **`POST /api/stop`** returns `{"stopped": stop_current()}`.
- **`POST /api/undo`** takes a `ScanRequest`:
  - It calls `discard_changes(resolve_repo(req.repo_path))` and returns `{"undone": True}`.
  - Add an exception handler mapping `GitError` to **400**.

## Frontend

**`src/lib/bobEvents.ts`** implements `parseSse`, `describeToolUse`, `describeRunOutput` and `clock` exactly as `bobEvents.test.ts` specifies:
- **`describeToolUse` verbs:**
  - `read_file` → read, `list_files` → list, `search_files` → search
  - `update_todo_list` → plan
  - `write_to_file` → write, with suffix `+N` for the content's line count and tone obeys
  - `apply_diff` / `search_and_replace` / `insert_content` / `edit_file` → edit
  - `execute_command` → run
  - `new_task`, or any name containing "subagent" → explore, with suffix "subagent"
  - Anything else → the raw name
- **Detail:** `parameters.path ?? parameters.file_path ?? parameters.command ?? ""`.
- **Tone:** muted unless stated.

**`src/lib/run.ts`**, `startRun(req, dispatch): () => void`:
- **Start:** dispatch `runStarted(now)`, then POST `/api/make-it-so` with `fetch` and an `AbortController`. Read `resp.body` with a `TextDecoder` and feed chunks through `parseSse`.
- **Each event:**
  - **`violations`:** dispatch `runViolations`.
  - **`bob` with `tool_use`:** for `execute_command`, remember `tool_id → command` and log it later. For every other tool, dispatch `runLog({ t: clock(now − start), ...describeToolUse(data) })`.
  - **`bob` with `tool_result`** for a remembered command: log `run <command>` with `describeRunOutput(data.output)`.
  - **`tests`:** log `test pytest -q <summary>`, with tone obeys when ok and violation otherwise.
  - **`done`:** log `rescan etch scan "<n> violations"`, obeys when 0. Then dispatch `runFinished(coins ?? 0, duration_ms ?? elapsed)`.
  - **`error`:** dispatch `runFailed(message)`.
- **Failures:** a non-ok response or a network error dispatches `runFailed`. If the stream ends without `done` or `error`, dispatch `runFailed("Connection to Etch closed")`. Ignore errors after an abort.
- **Cancel function:** abort the fetch and call `stopRun()`.

**`src/api.ts`:** add `stopRun()` (POST `/api/stop`) and `undo(repo_path)` (POST `/api/undo`).

**Undo** (`App.tsx` + `Rail.tsx`): enable "Undo changes" in the `error` phase. Its handler awaits `undo(state.repoPath)`, then runs the existing rescan.

## Acceptance checks (all must exit 0)
1. From `backend/`: `.venv\Scripts\python.exe -m pytest -q`. Expect **48 passed**. These tests use fake Bob, never the real one.
2. From `frontend/`: `npm.cmd test` (41 passed), then `npm.cmd run typecheck`, then `npm.cmd run build`.

If a test fails, fix your code, never the test. If the same failure repeats twice, stop and report it.

## Final reply (short)
- the check results
- one line per file
- any deviation from this spec, with the reason
