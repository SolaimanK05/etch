# Etch — submission texts (lablab.ai, IBM Bob 2.0 Hackathon)

## Title
Etch: doodle-driven development

## Short description
Draw your architecture on a canvas. Etch shows every import that breaks it, IBM Bob refactors the code to obey, and the drawing becomes a check on every pull request.

## Tags
IBM Bob, Agentic AI, Developer Tools, Software Architecture, Refactoring, Code Quality, Python, React, Excalidraw, GitHub Actions

---

## Problem & Solution  (≤ 500 words)

Every engineering team has an architecture diagram, and most of them are wrong. The diagram says the API talks to services and services talk to the database. The code says otherwise, because someone needed a fix on a Friday and imported the database straight into an API handler. The tests passed and the review missed it. Each shortcut is small. Together they turn the layering into fiction, and the cost shows up months later as code nobody can change safely.

The tools to prevent this exist but go unused. Import-linter can enforce layers, but its contracts are hand-written INI files that nobody keeps in sync with the real design. Fixing existing drift is tedious refactoring work that never makes it onto a sprint. So teams keep drawing diagrams, and the diagrams keep lying.

Etch makes the diagram the source of truth. It works in four steps.

**Scan.** Point Etch at a Python repository. It reads every import, including imports hidden inside function bodies that grep misses, and sketches the real architecture as hand-drawn boxes and arrows on an Excalidraw canvas.

**Draw.** Erase the arrows you don't want. Every import that crosses a missing arrow turns red on the canvas and appears in a list with its file, line number and the offending line of code. The feedback is live: redraw an arrow and its violations disappear.

**Make it so.** One button hands the job to IBM Bob. Bob runs headless on the repository with a prompt generated from the drawing, and its work streams into the UI. After each edit Bob makes, Etch rescans, so the red arrows fade one by one. Etch then reruns the test suite and reports what the run cost in Bobcoins.

**Etch it.** The drawing is compiled into import-linter contracts and a GitHub Action that blocks any pull request breaking the design. That check involves no AI and costs nothing, on every PR, forever. Etch also writes a Bob skill and a custom Bob mode that carry the architecture and the architect's own notes, so any future Bob session in that repo knows the rules and the reasons for them. Changes land on a separate branch, ready to open as a pull request.

We proved it end to end on a demo shop application with four planted violations, one of them hidden inside a function. In a single live run, IBM Bob fixed all four in 1 minute 24 seconds for 0.61 Bobcoin. It routed calls through the services layer, moved pricing out of the repository, and passed the data the notification layer needed as arguments. All tests stayed green. The resulting pull request passes the Etch gate.

Then we opened a second pull request containing a realistic "quick fix" that reads orders straight from the database. Every test passed, and GitHub still blocked the merge, pointing at the exact import on line 3.

Etch turns a whiteboard sketch into an enforced rule, and turns the refactoring nobody schedules into one button.

---

## IBM Bob Usage Statement  (≤ 500 words)

IBM Bob is part of Etch in three ways: Bob built it, Bob runs inside it, and Etch produces files that make Bob smarter afterwards.

**Bob built Etch.** Every core module was written by IBM Bob in the IDE, mostly in Agent mode, across nine tasks.

- **Tasks:** a headless spike, the project scaffold, the import scanner and violation engine, the contract compiler and CI workflow, the demo application, the canvas state machine and geometry, the full React and Excalidraw user interface ported from an approved design, the live runner, and the Etch it outputs.
- **Method:** each task started from a precise written spec with frozen interfaces, and a test suite prepared before the task. Bob implemented against the tests until they passed.
- **Cost:** this kept the build to 24.3 of our 40 Bobcoins, and most tasks succeeded on the first attempt.
- **Evidence:** the specs are published in `docs/bob_prompts/` and the session summaries in `bob_sessions/`.
- **Context:** Bob generated the repository's AGENTS.md itself, which carried the project conventions into every later task.

**Bob runs inside Etch.** The "Make it so" button starts Bob Shell in headless Agent mode: `bob run --mode agent --format stream-json --max-cost 1`.
- **The prompt:** Etch generates it from the drawing. It contains the allowed dependencies, every violating import with its file, line and code, the rules for a valid fix (keep public signatures, never edit tests, never hide the import inside a function), and the exact test command to run.
- **The live stream:** Etch parses Bob's stream-json events into a live log, turning each file read, edit and test run into a line in the UI. After each tool result it rescans the code, which is what makes the red arrows fade as Bob works. It reads the Bobcoin cost from Bob's final result event.
- **Subagents** are enabled, so Bob can delegate exploration.
- **Guardrails:** every run is capped at one Bobcoin, Stop kills Bob's whole process tree, and Undo restores the target folder.
- **Result:** in our live run, Bob fixed four layering violations across six files in 84 seconds for 0.61 Bobcoin, and all tests passed.

**Etch makes Bob better afterwards.** Etch it writes a Bob skill (`.bob/skills/etch-architecture/SKILL.md`) and an "Etch Architect" custom mode (`.bob/custom_modes.yaml`). Both follow Bob's own formats, which we read from Bob's skill files and mode schema.
- The skill lists the allowed dependencies, the forbidden set and how to verify compliance.
- It also includes the notes the architect wrote on the canvas. An arrow labelled "all business logic goes through here" reaches Bob as the reason behind the rule.
- Anyone who opens the repository in Bob later gets an agent that already knows the architecture.

This is the workflow we think Bob is best at: a human expresses intent in the most natural form available (here, a sketch), Bob does the tedious multi-file refactoring, and a zero-cost deterministic check keeps the result from drifting.
