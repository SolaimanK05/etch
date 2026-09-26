/** Inline SVG icons ported from Prototype.dc.html */

export function BranchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="5" r="2.5" />
      <circle cx="6" cy="19" r="2.5" />
      <circle cx="18" cy="8" r="2.5" />
      <path d="M6 7.5v9" />
      <path d="M18 10.5c0 4-6 3-11 6" />
    </svg>
  );
}

export function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="3"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

export function ReplayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12a8 8 0 1 0 2.3-5.7" />
      <path d="M4 4v5h5" />
    </svg>
  );
}

/** SVG <defs> marker definitions for violation overlay arrowheads */
export function ViolationMarkerDefs() {
  return (
    <defs>
      <marker id="pRed" viewBox="0 0 12 12" refX="10" refY="6"
        markerWidth="9" markerHeight="9" orient="auto-start-reverse">
        <path d="M1 1.5 L10.5 6 L1.5 10.5" fill="none" stroke="#9F2F2D"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </marker>
    </defs>
  );
}
