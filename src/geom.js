// Polygon helpers. Everything works in unit tile space (0..1 on both axes).

const EPS = 1e-9;

// Signed side of point p relative to the directed line a->b.
export function side(p, a, b) {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

// Sutherland-Hodgman clip of a convex polygon against one half-plane of a->b.
// keepPositive picks which side survives. Returns null if nothing is left.
export function clipHalf(poly, a, b, keepPositive) {
  const out = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const P = poly[i];
    const Q = poly[(i + 1) % n];
    const sp = side(P, a, b);
    const sq = side(Q, a, b);
    const inP = keepPositive ? sp >= -EPS : sp <= EPS;
    const inQ = keepPositive ? sq >= -EPS : sq <= EPS;
    if (inP) out.push(P);
    if (inP !== inQ) {
      const t = sp / (sp - sq);
      out.push({ x: P.x + t * (Q.x - P.x), y: P.y + t * (Q.y - P.y) });
    }
  }
  return out.length >= 3 ? out : null;
}

export function area(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

export function centroid(poly) {
  let x = 0, y = 0, a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const f = p.x * q.y - q.x * p.y;
    a += f;
    x += (p.x + q.x) * f;
    y += (p.y + q.y) * f;
  }
  a *= 3;
  if (Math.abs(a) < EPS) return { x: poly[0].x, y: poly[0].y };
  return { x: x / a, y: y / a };
}

export function pointInPolygon(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if ((yi > pt.y) !== (yj > pt.y) &&
        pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Rotate a point in the unit square by k quarter-turns about (0.5, 0.5).
// SVG coordinates: y grows downward, so this is clockwise.
export function rotUnit(p, k) {
  let { x, y } = p;
  for (let i = 0; i < ((k % 4) + 4) % 4; i++) {
    const nx = 1 - y;
    const ny = x;
    x = nx;
    y = ny;
  }
  return { x, y };
}
