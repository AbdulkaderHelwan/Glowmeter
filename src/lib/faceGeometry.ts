/**
 * Facial Geometry Engine — deterministic, explainable measurements computed
 * directly from the 68 face-api landmarks. This is the "novel" differentiator:
 * most competitors return a black-box AI "rating"; this returns reproducible
 * geometry (symmetry, canthal tilt, facial thirds/fifths, jaw angle, ratios)
 * that a user can understand and that doesn't change between runs of the same
 * photo.
 *
 * Coordinate handling: landmarks arrive as percentages where x is %-of-width
 * and y is %-of-height. Those are NON-UNIFORM units, so before measuring any
 * distance or angle we convert to true pixel space using the image dimensions.
 */

import type { FaceDetectionResult, Point } from './faceDetection';

export interface GeoMetric {
  id: string;
  label: string;
  value: number;        // primary numeric value (unit depends on metric)
  unit: string;         // 'deg' | 'ratio' | '%' | ''
  score: number;        // 0–100 how close to the harmonious reference
  ideal: string;        // human-readable reference range
  insight: string;      // short explanation
}

export interface FaceGeometryResult {
  overallHarmony: number;        // 0–100 aggregate
  symmetry: number;              // 0–100
  metrics: GeoMetric[];
  // raw guides (in % space) for drawing the overlay
  guides: {
    midline: { x1: number; y1: number; x2: number; y2: number };
    thirds: number[];            // y% positions of the two horizontal third lines
    fifths: number[];            // x% positions of the four vertical fifth lines
    leftEyeAxis: { x1: number; y1: number; x2: number; y2: number };
    rightEyeAxis: { x1: number; y1: number; x2: number; y2: number };
  } | null;
}

// ── small vector helpers (operate in pixel space) ──────────────
type V = { x: number; y: number };
const sub = (a: V, b: V): V => ({ x: a.x - b.x, y: a.y - b.y });
const dist = (a: V, b: V) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: V, b: V): V => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const angleDeg = (v: V) => (Math.atan2(v.y, v.x) * 180) / Math.PI;

/** closeness score: 100 when value==ideal, decaying with relative error */
function closeness(value: number, ideal: number, tolerance: number): number {
  const err = Math.abs(value - ideal) / tolerance;
  return Math.max(0, Math.min(100, Math.round(100 * Math.exp(-0.5 * err * err))));
}

export function computeFaceGeometry(
  face: FaceDetectionResult | null
): FaceGeometryResult | null {
  if (!face || !face.detected || !face.points || face.points.length < 68) return null;
  const W = face.imageWidth || 1000;
  const H = face.imageHeight || 1000;

  // % → pixel space (aspect-correct)
  const P = face.points.map((p: Point): V => ({ x: (p.x / 100) * W, y: (p.y / 100) * H }));

  // key points
  const chin = P[8];
  const jawL = P[0];
  const jawR = P[16];
  const browTop = mid(P[19], P[24]);          // brow midpoint
  const noseBase = P[33];                       // bottom of nose
  const noseTip = P[30];
  const leftEyeOuter = P[36], leftEyeInner = P[39];
  const rightEyeInner = P[42], rightEyeOuter = P[45];
  const mouthL = P[48], mouthR = P[54];
  const leftEyeC = mid(P[36], P[39]);
  const rightEyeC = mid(P[42], P[45]);

  // ── Symmetry ───────────────────────────────────────────────
  // Mirror axis: line from brow midpoint to chin. Measure how far mirrored
  // pairs deviate, normalised by face width.
  const axisTop = browTop, axisBot = chin;
  const faceW = dist(jawL, jawR);
  const axisDir = sub(axisBot, axisTop);
  const axisLen = Math.hypot(axisDir.x, axisDir.y) || 1;
  const nx = axisDir.x / axisLen, ny = axisDir.y / axisLen; // unit along axis
  // signed perpendicular distance of a point from the axis
  const perp = (p: V) => {
    const d = sub(p, axisTop);
    return d.x * -ny + d.y * nx; // rotate by -90°
  };
  const pairs: [number, number][] = [
    [36, 45], [39, 42], [31, 35], [48, 54], [0, 16],
    [17, 26], [21, 22], [2, 14], [4, 12], [5, 11], [50, 52],
  ];
  let symErr = 0;
  for (const [a, b] of pairs) symErr += Math.abs(perp(P[a]) + perp(P[b]));
  const meanSymErr = symErr / pairs.length;
  const symmetry = Math.max(0, Math.min(100, Math.round(100 - (meanSymErr / faceW) * 220)));

  // ── Canthal tilt (eye corner angle) ────────────────────────
  // outer corner relative to inner; positive => outer corner higher (upward tilt)
  const leftTilt = -angleDeg(sub(leftEyeOuter, leftEyeInner));
  const rightTiltRaw = angleDeg(sub(rightEyeOuter, rightEyeInner));
  const canthal = (leftTilt + rightTiltRaw) / 2;

  // ── Facial thirds ──────────────────────────────────────────
  // upper (brow→? we approximate hairline = brow + (brow→nose base))
  const midThird = dist(browTop, noseBase);
  const lowerThird = dist(noseBase, chin);
  const upperThird = midThird; // hairline unknown; reference upper≈mid
  const thirdsAvg = (upperThird + midThird + lowerThird) / 3;
  const thirdsSpread =
    (Math.abs(upperThird - thirdsAvg) +
      Math.abs(midThird - thirdsAvg) +
      Math.abs(lowerThird - thirdsAvg)) /
    3 /
    thirdsAvg; // 0 = perfectly even
  const thirdsScore = closeness(thirdsSpread, 0, 0.18);

  // ── Eye spacing (interocular vs eye width) ─────────────────
  const interocular = dist(leftEyeInner, rightEyeInner);
  const eyeWidth = (dist(leftEyeOuter, leftEyeInner) + dist(rightEyeOuter, rightEyeInner)) / 2;
  const spacingRatio = interocular / (eyeWidth || 1); // ideal ≈ 1.0
  const spacingScore = closeness(spacingRatio, 1.0, 0.25);

  // ── Facial width-to-height ratio (fWHR) ────────────────────
  const bizygomatic = dist(P[1], P[15]); // upper cheek width
  const upperFaceH = dist(browTop, P[51]); // brow → upper lip
  const fwhr = bizygomatic / (upperFaceH || 1); // ~1.9 avg
  const fwhrScore = closeness(fwhr, 1.9, 0.5);

  // ── Jaw / gonial angle ─────────────────────────────────────
  const gonial = (() => {
    const aL = angleDeg(sub(P[4], P[0]));
    const bL = angleDeg(sub(P[8], P[4]));
    const left = Math.abs(((bL - aL + 540) % 360) - 180);
    const aR = angleDeg(sub(P[12], P[16]));
    const bR = angleDeg(sub(P[8], P[12]));
    const right = Math.abs(((bR - aR + 540) % 360) - 180);
    return (left + right) / 2;
  })();
  const jawScore = closeness(gonial, 125, 25);

  // ── Mouth-to-nose width (philtrum harmony) ────────────────
  const mouthWidth = dist(mouthL, mouthR);
  const noseWidth = dist(P[31], P[35]);
  const mouthNose = mouthWidth / (noseWidth || 1); // ideal ≈ 1.5
  const mouthNoseScore = closeness(mouthNose, 1.5, 0.35);

  const metrics: GeoMetric[] = [
    {
      id: 'symmetry', label: 'Facial Symmetry', value: symmetry, unit: '%',
      score: symmetry, ideal: '90–100%',
      insight: 'How closely the left and right halves mirror each other across the facial midline.',
    },
    {
      id: 'canthal', label: 'Canthal Tilt', value: Math.round(canthal * 10) / 10, unit: 'deg',
      score: closeness(canthal, 5, 6), ideal: '+3° to +7° (gentle upward)',
      insight: 'Angle from the inner to outer eye corner. A slight positive tilt reads as alert and youthful.',
    },
    {
      id: 'thirds', label: 'Facial Thirds Balance', value: thirdsScore, unit: '%',
      score: thirdsScore, ideal: 'even upper / mid / lower',
      insight: 'Vertical balance of forehead, midface and lower face — classical proportion divides the face into three equal bands.',
    },
    {
      id: 'spacing', label: 'Eye Spacing', value: Math.round(spacingRatio * 100) / 100, unit: 'ratio',
      score: spacingScore, ideal: '≈ 1.0 eye-width apart',
      insight: 'Distance between the eyes relative to one eye width — the canonical reference is exactly one eye-width of separation.',
    },
    {
      id: 'fwhr', label: 'Width-to-Height (fWHR)', value: Math.round(fwhr * 100) / 100, unit: 'ratio',
      score: fwhrScore, ideal: '≈ 1.8–2.0',
      insight: 'Bizygomatic width over upper-face height; a widely studied structural proportion.',
    },
    {
      id: 'jaw', label: 'Jaw (Gonial) Angle', value: Math.round(gonial), unit: 'deg',
      score: jawScore, ideal: '≈ 115–130°',
      insight: 'Angle of the jaw turn. Lower angles read as more defined; very high angles as softer.',
    },
    {
      id: 'mouthNose', label: 'Mouth-to-Nose Width', value: Math.round(mouthNose * 100) / 100, unit: 'ratio',
      score: mouthNoseScore, ideal: '≈ 1.5',
      insight: 'Mouth width relative to nose width — a feature-harmony proportion.',
    },
  ];

  const overallHarmony = Math.round(
    metrics.reduce((s, m) => s + m.score, 0) / metrics.length
  );

  // ── overlay guides (back to % space) ───────────────────────
  const toPct = (p: V) => ({ x: (p.x / W) * 100, y: (p.y / H) * 100 });
  const aTop = toPct(axisTop), aBot = toPct(axisBot);
  const nb = toPct(noseBase), bt = toPct(browTop);
  const leftOuterPct = toPct(leftEyeOuter), leftInnerPct = toPct(leftEyeInner);
  const rightInnerPct = toPct(rightEyeInner), rightOuterPct = toPct(rightEyeOuter);
  const jawLpct = toPct(jawL), jawRpct = toPct(jawR);

  const guides = {
    midline: { x1: aTop.x, y1: aTop.y, x2: aBot.x, y2: aBot.y },
    thirds: [bt.y, nb.y],
    fifths: (() => {
      // four vertical lines across face width at eye landmarks
      const xs = [P[36], P[39], P[42], P[45]].map((p) => toPct(p).x).sort((a, b) => a - b);
      return [jawLpct.x, ...xs, jawRpct.x];
    })(),
    leftEyeAxis: { x1: leftOuterPct.x, y1: leftOuterPct.y, x2: leftInnerPct.x, y2: leftInnerPct.y },
    rightEyeAxis: { x1: rightInnerPct.x, y1: rightInnerPct.y, x2: rightOuterPct.x, y2: rightOuterPct.y },
  };

  return { overallHarmony, symmetry, metrics, guides };
}
