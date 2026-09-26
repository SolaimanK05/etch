export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function center(r: Rect): Point {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

/** The point where the ray from center(r) toward `toward` crosses the border of r.
 *  Returns the centre if `toward` is the centre. */
export function exitPoint(r: Rect, toward: Point): Point {
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;

  if (dx === 0 && dy === 0) {
    return { x: cx, y: cy };
  }

  const halfW = r.width / 2;
  const halfH = r.height / 2;

  // Scale factor: min of the two non-zero axis scales
  let scale = Infinity;
  if (dx !== 0) scale = Math.min(scale, halfW / Math.abs(dx));
  if (dy !== 0) scale = Math.min(scale, halfH / Math.abs(dy));

  return { x: cx + dx * scale, y: cy + dy * scale };
}

export interface EdgeGeometryOptions {
  bend?: number;
  startGap?: number;
  endGap?: number;
}

export interface EdgeGeometry {
  d: string;
  start: Point;
  end: Point;
  control: Point;
  mid: Point;
}

/** Format a number to 1 decimal, stripping trailing ".0" */
function fmt(n: number): string {
  const s = n.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

export function edgeGeometry(
  from: Rect,
  to: Rect,
  opts: EdgeGeometryOptions = {},
): EdgeGeometry {
  const bend = opts.bend ?? 0.18;
  const startGap = opts.startGap ?? 6;
  const endGap = opts.endGap ?? 10;

  const fromCenter = center(from);
  const toCenter = center(to);

  const exitFrom = exitPoint(from, toCenter);
  const exitTo = exitPoint(to, fromCenter);

  // Direction from exitFrom to exitTo
  const rawDx = exitTo.x - exitFrom.x;
  const rawDy = exitTo.y - exitFrom.y;
  const rawLen = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
  const ux = rawLen > 0 ? rawDx / rawLen : 0;
  const uy = rawLen > 0 ? rawDy / rawLen : 0;

  const start: Point = {
    x: exitFrom.x + ux * startGap,
    y: exitFrom.y + uy * startGap,
  };
  const end: Point = {
    x: exitTo.x - ux * endGap,
    y: exitTo.y - uy * endGap,
  };

  // dir = unit vector from start to end
  const sdx = end.x - start.x;
  const sdy = end.y - start.y;
  const sLen = Math.sqrt(sdx * sdx + sdy * sdy);
  const dirX = sLen > 0 ? sdx / sLen : 0;
  const dirY = sLen > 0 ? sdy / sLen : 0;
  // perp = (-dir.y, dir.x)
  const perpX = -dirY;
  const perpY = dirX;

  const midpointX = (start.x + end.x) / 2;
  const midpointY = (start.y + end.y) / 2;
  const control: Point = {
    x: midpointX + perpX * bend * sLen,
    y: midpointY + perpY * bend * sLen,
  };

  // Quadratic bezier at t=0.5: 0.25*start + 0.5*control + 0.25*end
  const mid: Point = {
    x: 0.25 * start.x + 0.5 * control.x + 0.25 * end.x,
    y: 0.25 * start.y + 0.5 * control.y + 0.25 * end.y,
  };

  const d = `M${fmt(start.x)} ${fmt(start.y)} Q${fmt(control.x)} ${fmt(control.y)} ${fmt(end.x)} ${fmt(end.y)}`;

  return { d, start, end, control, mid };
}
