# Etch — Build Plan

**Etch — doodle-driven development.** Draw your architecture on a canvas; Etch shows every line of code that breaks the drawing, IBM Bob refactors the code to obey it, and the drawing becomes an enforced rule on every PR.

Differentiator: the only entry where a drawing is both the architecture rule and the refactor command. (Prior finalist "Atlas" only visualized a repo; import-linter/ArchUnit need hand-written config nobody maintains.)

## Demo flow (wow = step 3)
1. Open repo → Etch auto-draws the *real* architecture as hand-drawn boxes/arrows.
2. User deletes arrow `api → db`, draws `api → services → db` → red arrows + file:line list of violations, live.
3. Click **Make it so** → `bob run` (Agent mode, subagents) refactors; live progress streamed into the UI; rescan → red turns green, tests pass.
4. **Etch it** → writes `.importlinter` contracts, `.bob/skills/etch-architecture/SKILL.md`, a custom Bob mode, and a GitHub Action. A PR reintroducing the violation is blocked (zero AI cost).

## Scope ladder
- **60% (must work):** scan → render → edit arrows → live violations w/ file:line → compile `.importlinter` → CI gate blocks bad PR.
- **85%:** Make it so (bob run streaming) → rescan green + tests; generate Bob skill + custom mode.
- **Stretch:** napkin photo → drawing via watsonx.ai vision; per-violation "explain" (bob run, ask mode); drift timeline.

## Bobcoin budget (40 total)
| # | Bob task | Est. | Actual |
|---|---|---|---|
| 0 | Spike: one `bob run` fix on throwaway package | 1 | **0.18** (22 s, 7 tool calls) ✅ |
| 1 | Scaffold (backend/frontend/demo-app) + AGENTS.md | 2 | **3.33** (Plan→Agent, ~25 files + installs) ⚠️ over |
| 2 | Backend scanner + violation engine | 4 | **0.80** (Agent only, tests pre-written by Claude) ✅ |
| 3 | Contract compiler + CI workflow | 3 | **0.70** (Agent only, tests pre-written) ✅ |
| 4 | Excalidraw canvas + sync | 5 | 4a logic **2.38** + 4b UI **8.74** = **11.12** ⚠️ over (large UI port) |
| 5 | bob-runner SSE | 3 | **3.79** (runner + stream + stop/undo + SSE client) ⚠️ slightly over |
| 6 | demo-app + tests + planted violations | 3 | **0.67** (Agent only; Claude removed misleading noqa tags) ✅ |
| 7 | Bob skill + custom mode generator | 2 | |
| – | Runtime "Make it so" rehearsals (capped) | 11 | run 1: **0.61** (4/4 fixed, 1:24, tests green, lint-imports 4 kept) ✅ |
| – | Reserve | 6 | |

## Timeline (Asia/Dhaka)
- Sat 10–11: spike
- Sat 11–15: backend engine + demo-app
- Sat 15–20: canvas + live violations
- Sat 20–23: Make it so + rescan
- Sun 08–11: Etch-it outputs, CI gate, polish
- Sun 11–14: rehearse, record demo + fallback recording
- Sun 14–18: video, slides, statements, README, bob_sessions screenshots
- Sun 18–20: submit (deadline 21:00)

## Pitch metrics
- Time to find + fix N violations manually vs with Etch
- Bobcoins per fix; violations blocked by the gate at zero AI cost

## Judge Q&A
- "Isn't this import-linter/ArchUnit?" → That's our engine. Nobody writes or maintains those configs; Etch makes the drawing the config and Bob fixes drift.
- "Only Python?" → Analyzer is pluggable (dependency-cruiser for JS/TS next).
- "What if Bob's refactor is wrong?" → Verified by rescan + tests, runs on a branch/PR, Bob rollback available.
