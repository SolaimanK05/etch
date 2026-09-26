# Etch — demo video script (target 2:50, hard limit 3:00)

Rules: MP4, ≤ 3 min, ≥ 90 s of product in action, narrated, shows IBM Bob usage.
This script has about 2:05 of product on screen.

**Recording setup:**
- Screen: 1920×1080, browser at 100% zoom, dark background off.
- Before recording:
  - Reset `demo-app` (`git checkout -- demo-app` then `git clean -fd demo-app`).
  - Restart the backend in a shell that has `BOB_API_KEY`.
  - Clear saved box positions: browser devtools, then `localStorage.clear()`.
- **Live Bob run:** record it for real (≈ 0.6 Bobcoin). The run takes about 1:30, so speed it up 2× in the edit.
- **Fallback:** if Bob misbehaves on the day, record `?simulate`. It labels itself "agent mode · simulated". Say so in the narration and cut to the real run screenshot (`bob_sessions/etch_run01_make_it_so_live.png`) for the result.
- **Narration:** calm, one idea per sentence. Record the voice separately if that's easier.

---

**0:00–0:15 | Hook** · *Screen:* whiteboard-style architecture sketch, then the Etch first-run screen.
> Every team has an architecture diagram. And almost every diagram is wrong, because the code quietly drifted away from it. Etch makes the drawing the source of truth.

**0:15–0:35 | Scan** · *Screen:* type `demo-app`, click **Scan**. The boxes and arrows draw in.
> This is a small shop app. Etch reads every import, including the ones hidden inside functions, and sketches the real architecture. Each arrow is code that actually exists: api, services, db, notifications.

**0:35–1:00 | Draw** · *Screen:* erase `api → db`, `api → notifications`, `db → services` and `notifications → db` with Excalidraw's eraser. The red arrows appear, the rail fills with rows, and the pill shows 4 VIOLATIONS. Hover a row so its arrow thickens.
> Now I draw what I actually want: the API goes through services, and services talk to the database. I erase the arrows I don't allow, and every import that crosses them turns red, with the exact file and line. This one is hidden inside a function. Grep wouldn't find it. Etch does.

**1:00–1:45 | Make it so (IBM Bob, live)** · *Screen:* click **Make it so**. The "Bob is working" pill appears. The live log streams read, plan, edit and run pytest. Rows go queued, then fixing, then fixed. Red arrows fade and the toast says "api/orders.py now goes through services". *(2× speed.)*
> One button hands the job to IBM Bob. Bob runs headless in agent mode with a prompt Etch generated from the drawing: the rules, every broken import, and how to verify the fix. You watch it work. After every edit Bob makes, Etch rescans, so each red arrow disappears the moment its import is gone.

**1:45–2:00 | Result** · *Screen:* the done state: "4 imports fixed in 1:24 for 0.61 Bobcoin", the pill green at 0, and the log line `pytest -q 10 passed`.
> Four violations across six files, fixed in under a minute and a half, for sixty-one hundredths of a Bobcoin. Etch reran the tests itself: all green.

**2:00–2:25 | Etch it** · *Screen:* click **Etch it**. The seal stamps and the rail lists `.importlinter`, the PR check, the Bob skill, the Bob mode and the sketch. Quick cut to `SKILL.md` in the editor, highlighting the architect's note line.
> Etch it turns the drawing into law. Import-linter contracts. A GitHub check for every pull request. And a Bob skill and a custom Bob mode, so the next time anyone opens this repo in Bob, it already knows the architecture. It even knows why, because the notes I wrote on the canvas travel with it.

**2:25–2:45 | The gate** · *Screen:* GitHub PR #2, "Quick fix: read orders straight from the db". **tests: passed** in green, **architecture: failed** in red. Open the failing log to show `api may only import: services BROKEN` and `shop.api.orders -> shop.db.orders_repo (l.3)`. Show the blocked merge button.
> Here's why it matters. A teammate's quick fix reads orders straight from the database. Every test passes. But the drawing says no, and GitHub blocks the merge, pointing at line 3. No AI in that check, and no cost.

**2:45–2:55 | Close** · *Screen:* the Etch canvas with the clean drawing, then the title card "Etch · doodle-driven development · built with IBM Bob".
> Draw it. Make it so. Etch it. Built with IBM Bob.

---

**Shot checklist:** first run · scan · erase · red arrows + hover · Make it so live log · done numbers · Etch it seal + files · SKILL.md note · PR #2 blocked · title card.
