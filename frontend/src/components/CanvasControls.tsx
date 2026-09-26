import "./canvas-controls.css";
import { TOOLS, TOOL_GROUPS, type ToolType, zoomLabel } from "../lib/canvasControls";

// ── Icons ──────────────────────────────────────────────────────────

const SVG_ATTRS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

function IconSelection() {
  return (
    <svg {...SVG_ATTRS}>
      <path d="M5 3l14 8-6 1.8L10 19z" />
    </svg>
  );
}

function IconHand() {
  return (
    <svg {...SVG_ATTRS}>
      <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12" />
      <path d="M11 11.5v-7a1.5 1.5 0 0 1 3 0v7" />
      <path d="M14 11.5V6.5a1.5 1.5 0 0 1 3 0v6.5" />
      <path d="M17 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.9-2.6L5 14.5a1.6 1.6 0 0 1 2.6-1.9L8 13" />
    </svg>
  );
}

function IconRectangle() {
  return (
    <svg {...SVG_ATTRS}>
      <rect x="3.5" y="6" width="17" height="12" rx="2.5" />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg {...SVG_ATTRS}>
      <path d="M5 19L19 5" />
      <path d="M10 5h9v9" />
    </svg>
  );
}

function IconText() {
  return (
    <svg {...SVG_ATTRS}>
      <path d="M5 6V4.5h14V6" />
      <path d="M12 4.5v15" />
      <path d="M9.5 19.5h5" />
    </svg>
  );
}

function IconFreedraw() {
  return (
    <svg {...SVG_ATTRS}>
      <path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5z" />
      <path d="M13.5 7l3 3" />
    </svg>
  );
}

function IconEraser() {
  return (
    <svg {...SVG_ATTRS}>
      <path d="M8.5 20H20" />
      <path d="M4.6 14.6l8.9-8.9a2 2 0 0 1 2.8 0l2.5 2.5a2 2 0 0 1 0 2.8L12 17.8a2 2 0 0 1-1.4.6H8.3a2 2 0 0 1-1.4-.6l-2.3-2.3a1 1 0 0 1 0-1.4z" />
      <path d="M9 10l6 6" />
    </svg>
  );
}

const TOOL_ICONS: Record<ToolType, () => JSX.Element> = {
  selection: IconSelection,
  hand: IconHand,
  rectangle: IconRectangle,
  arrow: IconArrow,
  text: IconText,
  freedraw: IconFreedraw,
  eraser: IconEraser,
};

// ── View icons ─────────────────────────────────────────────────────

const VIEW_SVG_ATTRS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
  width: 16,
  height: 16,
};

// ── Toolbar ────────────────────────────────────────────────────────

export function Toolbar(props: {
  active: string;
  onSelect: (t: ToolType) => void;
}): JSX.Element {
  const toolMap = Object.fromEntries(TOOLS.map((t) => [t.type, t]));

  return (
    <div className="cc-toolbar" role="toolbar" aria-label="Drawing tools">
      {TOOL_GROUPS.map((group, gi) => (
        <>
          {gi > 0 && <span className="cc-sep" key={`sep-${gi}`} />}
          {group.map((type) => {
            const def = toolMap[type];
            const Icon = TOOL_ICONS[type];
            return (
              <button
                key={type}
                className="cc-tool"
                type="button"
                aria-label={def.label}
                aria-pressed={props.active === type}
                onClick={() => props.onSelect(type)}
              >
                <Icon />
                <span className="cc-key">{def.key}</span>
                <span className="cc-tip">
                  {def.label}
                  <kbd>{def.key}</kbd>
                  {def.hint ? ` · ${def.hint}` : null}
                </span>
              </button>
            );
          })}
        </>
      ))}
    </div>
  );
}

// ── ViewControls ───────────────────────────────────────────────────

export function ViewControls(props: {
  zoom: number;
  onUndo: () => void;
  onRedo: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onResetZoom: () => void;
  onFit: () => void;
}): JSX.Element {
  return (
    <div className="cc-view">
      <div className="cc-group">
        <button className="cc-btn" type="button" aria-label="Undo" onClick={props.onUndo}>
          <svg {...VIEW_SVG_ATTRS}>
            <path d="M9 14L4 9l5-5" />
            <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
          </svg>
        </button>
        <button className="cc-btn" type="button" aria-label="Redo" onClick={props.onRedo}>
          <svg {...VIEW_SVG_ATTRS}>
            <path d="M15 14l5-5-5-5" />
            <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
          </svg>
        </button>
      </div>
      <div className="cc-group">
        <button className="cc-btn" type="button" aria-label="Zoom out" onClick={props.onZoomOut}>
          <svg {...VIEW_SVG_ATTRS}>
            <path d="M5 12h14" />
          </svg>
        </button>
        <button
          className="cc-btn cc-zoom"
          type="button"
          aria-label="Reset zoom"
          onClick={props.onResetZoom}
        >
          {zoomLabel(props.zoom)}
        </button>
        <button className="cc-btn" type="button" aria-label="Zoom in" onClick={props.onZoomIn}>
          <svg {...VIEW_SVG_ATTRS}>
            <path d="M5 12h14M12 5v14" />
          </svg>
        </button>
        <span className="cc-sep" />
        <button className="cc-btn" type="button" aria-label="Fit to screen" onClick={props.onFit}>
          <svg {...VIEW_SVG_ATTRS}>
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
          Fit
        </button>
      </div>
    </div>
  );
}
