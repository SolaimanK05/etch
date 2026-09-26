# Etch — Task 8b: the Etch canvas controls (toolbar + view controls)

Etch hides all of Excalidraw's own UI. Build the replacement controls as **two new presentational files**. They only render and call their props. The wiring to Excalidraw already exists elsewhere.

**Keep this task small. Don't open any other files.**

## Scope (strict)
- **Create** `frontend/src/components/CanvasControls.tsx`.
- **Create** `frontend/src/components/canvas-controls.css`, and import it at the top of the component.
- **Read only** `frontend/src/lib/canvasControls.ts` (exports `TOOLS`, `TOOL_GROUPS`, `ToolType`, `zoomLabel`).
- **Don't open or modify** anything else. No tests to write. Don't install anything.
- **Windows PowerShell:** `npm.cmd`, run from `frontend/`.

## `CanvasControls.tsx`: two exports, props only, no state beyond hover

```ts
export function Toolbar(props: { active: string; onSelect: (t: ToolType) => void }): JSX.Element
export function ViewControls(props: {
  zoom: number;
  onUndo: () => void; onRedo: () => void;
  onZoomOut: () => void; onZoomIn: () => void; onResetZoom: () => void; onFit: () => void;
}): JSX.Element
```

### `Toolbar`
- **Container:** `div.cc-toolbar` with `role="toolbar"` and `aria-label="Drawing tools"`.
- **Groups:** render the groups from `TOOL_GROUPS`. Put a `span.cc-sep` between groups.
- **One button per tool:**
  - Element: `button.cc-tool` with `type="button"`, `aria-label={label}` and `aria-pressed={active === type}`.
  - On click, call `onSelect(type)`.
  - Inside, in this order: the icon SVG, `span.cc-key` holding `key`, and a tooltip `span.cc-tip`.
  - The tooltip holds `{label} <kbd>{key}</kbd>`, plus ` · {hint}` after the kbd when there is a hint.
  - Get label, key and hint from `TOOLS`.
- **Icons:** each is `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` with these children:
  - selection: `<path d="M5 3l14 8-6 1.8L10 19z"/>`
  - hand: `<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 11.5v-7a1.5 1.5 0 0 1 3 0v7"/><path d="M14 11.5V6.5a1.5 1.5 0 0 1 3 0v6.5"/><path d="M17 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.9-2.6L5 14.5a1.6 1.6 0 0 1 2.6-1.9L8 13"/>`
  - rectangle: `<rect x="3.5" y="6" width="17" height="12" rx="2.5"/>`
  - arrow: `<path d="M5 19L19 5"/><path d="M10 5h9v9"/>`
  - text: `<path d="M5 6V4.5h14V6"/><path d="M12 4.5v15"/><path d="M9.5 19.5h5"/>`
  - freedraw: `<path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5z"/><path d="M13.5 7l3 3"/>`
  - eraser: `<path d="M8.5 20H20"/><path d="M4.6 14.6l8.9-8.9a2 2 0 0 1 2.8 0l2.5 2.5a2 2 0 0 1 0 2.8L12 17.8a2 2 0 0 1-1.4.6H8.3a2 2 0 0 1-1.4-.6l-2.3-2.3a1 1 0 0 1 0-1.4z"/><path d="M9 10l6 6"/>`

### `ViewControls`
- **Container:** `div.cc-view`, holding two `div.cc-group` panels.
- **Panel 1:**
  - Undo: `aria-label="Undo"`, icon `<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>`.
  - Redo: `aria-label="Redo"`, icon `<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>`.
- **Panel 2:**
  - Zoom out: `aria-label="Zoom out"`, icon `<path d="M5 12h14"/>`.
  - Reset: `button.cc-zoom`, `aria-label="Reset zoom"`, text `zoomLabel(zoom)`.
  - Zoom in: `aria-label="Zoom in"`, icon `<path d="M5 12h14M12 5v14"/>`.
  - Then a `span.cc-sep`.
  - Fit: `aria-label="Fit to screen"`, icon `<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>` followed by the text `Fit`.
- **All buttons:**
  - Element: `button.cc-btn` with `type="button"`.
  - Icons are 16px, stroke-width 2.2, with the same SVG attributes as the toolbar icons.
  - Each button calls its prop.

## `canvas-controls.css` (use the existing CSS variables; no hex codes except `#fff`, `#CFCDC7`)

**Positioning.** Both containers are absolute; the parent is the canvas:
- `.cc-toolbar`: `top: 16px; left: 50%; transform: translateX(-50%)`.
- `.cc-view`: `right: 16px; bottom: 16px`.
- Both get `z-index: 5`.

**Panels.** `.cc-toolbar` and `.cc-group` share:
- `display: flex; align-items: center; gap: 2px; padding: 4px`
- `background: var(--surface); border: 1px solid var(--rule); border-radius: var(--r-panel); box-shadow: var(--shadow-float)`

`.cc-group` uses `padding: 3px`. `.cc-view` is `display: flex; gap: 8px`.

**Tool buttons (`.cc-tool`).**
- Box: `position: relative; width: 36px; height: 36px; border: 0; border-radius: var(--r-control); background: transparent; color: var(--muted); display: grid; place-items: center; cursor: pointer`.
- Motion: `transition: transform 160ms var(--ease-out)`.
- The svg inside is 19×19.
- `[aria-pressed="true"]`: `background: var(--hover); color: var(--ink)`.
- `:active`: `transform: scale(0.97)`.
- Hover (only inside `@media (hover: hover) and (pointer: fine)`): the same as pressed, and it shows the `.cc-tip`.

**Key letter (`.cc-key`).** `position: absolute; right: 3px; bottom: 1px; font: 400 9px var(--font-mono); color: var(--subtle); pointer-events: none`.

**Tooltip (`.cc-tip`).**
- Placement: `position: absolute; top: 46px; left: 50%; transform: translateX(-50%)`.
- Look: `white-space: nowrap; padding: 6px 9px; border-radius: var(--r-control); background: var(--ink); color: #fff; font: 500 13px var(--font-ui)`.
- State: `opacity: 0; pointer-events: none; transition: opacity 120ms ease`.
- Its `kbd` is `font: 400 12px var(--font-mono); color: #CFCDC7; margin-left: 6px`.

**Separator (`.cc-sep`).** `width: 1px; height: 20px; background: var(--rule); margin: 0 4px`.

**View buttons (`.cc-btn`).**
- `height: 30px; min-width: 30px; padding: 0 6px; border: 0; border-radius: var(--r-control); background: transparent; color: var(--body)`
- `display: inline-flex; align-items: center; justify-content: center; gap: 6px; font: 500 13px var(--font-ui); cursor: pointer`
- `:active` is `scale(0.97)`. Hover (in the same media query) is `background: var(--hover)`.

**Zoom label (`.cc-zoom`).** `min-width: 52px; font: 400 13px var(--font-mono); font-variant-numeric: tabular-nums`.

**Phones.** `@media (max-width: 767px)`:
- The toolbar moves to `top: auto; bottom: 12px`.
- `.cc-view` moves to `bottom: 64px; right: 12px`.
- Hide `.cc-tip` and `.cc-key`.

**Reduced motion.** `@media (prefers-reduced-motion: reduce)`: `.cc-tool, .cc-btn { transition: none }`.

## Acceptance (all must exit 0, from `frontend/`)
`npm.cmd run typecheck`, then `npm.cmd run build`. The component isn't mounted yet, so there is nothing to click.

## Final reply (short)
The check results and one line per file.
