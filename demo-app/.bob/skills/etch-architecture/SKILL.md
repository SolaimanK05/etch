---
name: etch-architecture
description: The architecture of `shop`, drawn in Etch. Use before adding or moving imports between shop's top-level packages, and to fix Etch layering violations.
---

# Architecture rules for `shop`

These rules were drawn as a sketch in Etch and are enforced on every pull request.

Allowed imports between top-level packages (an arrow means "may import"):
- api → services
- services → db
- services → notifications

Every other import between api, db, notifications, services is forbidden, including imports inside functions or via importlib.

## How to comply
- Route calls through a package the drawing allows. Never add a forbidden import to get something working.
- Check your work with `lint-imports` (it reads `.importlinter`) and run the tests.
- To change a rule, redraw it in Etch and click Etch it. Do not edit `.importlinter` by hand.
