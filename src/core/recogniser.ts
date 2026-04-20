/**
 * $1 Unistroke Recogniser — TypeScript implementation.
 *
 * Based on the $1 Recognizer algorithm by Wobbrock, Wilson & Li (2007).
 * Recognises single-stroke gestures by resampling, rotating to indicative angle,
 * scaling to a bounding box, and comparing against templates.
 */

import { Point } from '../types';

export interface GestureTemplate {
  name: string;
  points: Point[];
}

export interface RecognitionResult {
  name: string;
  score: number;
}

const NUM_POINTS = 64;
const SQUARE_SIZE = 250;
const HALF_DIAGONAL = 0.5 * Math.sqrt(SQUARE_SIZE * SQUARE_SIZE + SQUARE_SIZE * SQUARE_SIZE);
const ANGLE_RANGE = Math.PI / 4; // 45°
const ANGLE_PRECISION = Math.PI / 90; // 2°
const PHI = 0.5 * (-1 + Math.sqrt(5)); // golden ratio

// --- Utility functions ---

function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function pathLength(points: Point[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    d += distance(points[i - 1], points[i]);
  }
  return d;
}

function centroid(points: Point[]): Point {
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  return { x: cx / points.length, y: cy / points.length };
}

function boundingBox(points: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

// --- Processing pipeline ---

function resample(points: Point[], n: number): Point[] {
  const interval = pathLength(points) / (n - 1);
  let D = 0;
  const newPoints: Point[] = [{ ...points[0] }];

  for (let i = 1; i < points.length; i++) {
    const d = distance(points[i - 1], points[i]);
    if (D + d >= interval) {
      const ratio = (interval - D) / d;
      const nx = points[i - 1].x + ratio * (points[i].x - points[i - 1].x);
      const ny = points[i - 1].y + ratio * (points[i].y - points[i - 1].y);
      const q: Point = { x: nx, y: ny };
      newPoints.push(q);
      points.splice(i, 0, q); // insert for next iteration
      D = 0;
    } else {
      D += d;
    }
  }

  // Sometimes rounding errors leave us one point short
  while (newPoints.length < n) {
    newPoints.push({ ...points[points.length - 1] });
  }

  return newPoints.slice(0, n);
}

function indicativeAngle(points: Point[]): number {
  const c = centroid(points);
  return Math.atan2(c.y - points[0].y, c.x - points[0].x);
}

function rotateBy(points: Point[], radians: number): Point[] {
  const c = centroid(points);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return points.map((p) => ({
    x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x,
    y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y,
  }));
}

function scaleTo(points: Point[], size: number): Point[] {
  const bb = boundingBox(points);
  const w = bb.maxX - bb.minX;
  const h = bb.maxY - bb.minY;
  return points.map((p) => ({
    x: w > 0 ? (p.x * size) / w : p.x,
    y: h > 0 ? (p.y * size) / h : p.y,
  }));
}

function translateTo(points: Point[], target: Point): Point[] {
  const c = centroid(points);
  return points.map((p) => ({
    x: p.x + target.x - c.x,
    y: p.y + target.y - c.y,
  }));
}

function pathDistance(a: Point[], b: Point[]): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    d += distance(a[i], b[i]);
  }
  return d / a.length;
}

function distanceAtAngle(points: Point[], template: Point[], radians: number): number {
  const rotated = rotateBy(points, radians);
  return pathDistance(rotated, template);
}

function distanceAtBestAngle(points: Point[], template: Point[]): number {
  let a = -ANGLE_RANGE;
  let b = ANGLE_RANGE;
  let x1 = PHI * a + (1 - PHI) * b;
  let x2 = (1 - PHI) * a + PHI * b;
  let f1 = distanceAtAngle(points, template, x1);
  let f2 = distanceAtAngle(points, template, x2);

  while (Math.abs(b - a) > ANGLE_PRECISION) {
    if (f1 < f2) {
      b = x2;
      x2 = x1;
      f2 = f1;
      x1 = PHI * a + (1 - PHI) * b;
      f1 = distanceAtAngle(points, template, x1);
    } else {
      a = x1;
      x1 = x2;
      f1 = f2;
      x2 = (1 - PHI) * a + PHI * b;
      f2 = distanceAtAngle(points, template, x2);
    }
  }

  return Math.min(f1, f2);
}

// --- Process a stroke ---

function processStroke(points: Point[]): Point[] {
  let processed = resample([...points], NUM_POINTS);
  const angle = indicativeAngle(processed);
  processed = rotateBy(processed, -angle);
  processed = scaleTo(processed, SQUARE_SIZE);
  processed = translateTo(processed, { x: 0, y: 0 });
  return processed;
}

// --- Built-in templates ---

function generateCircle(): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= 32; i++) {
    const angle = (i / 32) * 2 * Math.PI;
    pts.push({ x: 100 + 80 * Math.cos(angle), y: 100 + 80 * Math.sin(angle) });
  }
  return pts;
}

function generateLine(): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= 20; i++) {
    pts.push({ x: 20 + i * 12, y: 100 });
  }
  return pts;
}

function generateCheckmark(): Point[] {
  return [
    { x: 20, y: 100 }, { x: 40, y: 120 }, { x: 60, y: 140 }, { x: 80, y: 160 },
    { x: 100, y: 140 }, { x: 120, y: 120 }, { x: 140, y: 100 }, { x: 160, y: 80 },
    { x: 180, y: 60 }, { x: 200, y: 40 },
  ];
}

function generateX(): Point[] {
  const pts: Point[] = [];
  // first stroke of X: top-left to bottom-right
  for (let i = 0; i <= 10; i++) pts.push({ x: 20 + i * 16, y: 20 + i * 16 });
  // bottom-left to top-right
  for (let i = 0; i <= 10; i++) pts.push({ x: 20 + i * 16, y: 180 - i * 16 });
  return pts;
}

function generateZ(): Point[] {
  return [
    { x: 20, y: 20 }, { x: 60, y: 20 }, { x: 100, y: 20 }, { x: 140, y: 20 }, { x: 180, y: 20 },
    { x: 160, y: 50 }, { x: 140, y: 80 }, { x: 100, y: 120 }, { x: 60, y: 160 }, { x: 40, y: 180 },
    { x: 20, y: 180 }, { x: 60, y: 180 }, { x: 100, y: 180 }, { x: 140, y: 180 }, { x: 180, y: 180 },
  ];
}

function generateTriangle(): Point[] {
  return [
    { x: 100, y: 20 }, { x: 80, y: 60 }, { x: 60, y: 100 }, { x: 40, y: 140 }, { x: 20, y: 180 },
    { x: 60, y: 180 }, { x: 100, y: 180 }, { x: 140, y: 180 }, { x: 180, y: 180 },
    { x: 160, y: 140 }, { x: 140, y: 100 }, { x: 120, y: 60 }, { x: 100, y: 20 },
  ];
}

function generateL(): Point[] {
  return [
    { x: 20, y: 20 }, { x: 20, y: 60 }, { x: 20, y: 100 }, { x: 20, y: 140 }, { x: 20, y: 180 },
    { x: 60, y: 180 }, { x: 100, y: 180 }, { x: 140, y: 180 }, { x: 180, y: 180 },
  ];
}

function generateU(): Point[] {
  const pts: Point[] = [];
  // left side down
  for (let i = 0; i <= 6; i++) pts.push({ x: 20, y: 20 + i * 20 });
  // bottom curve
  for (let i = 1; i <= 5; i++) pts.push({ x: 20 + i * 32, y: 160 + 20 * Math.sin((i / 5) * Math.PI) });
  // right side up
  for (let i = 6; i >= 0; i--) pts.push({ x: 180, y: 20 + i * 20 });
  return pts;
}

function generateSquare(): Point[] {
  return [
    { x: 20, y: 20 }, { x: 60, y: 20 }, { x: 100, y: 20 }, { x: 140, y: 20 }, { x: 180, y: 20 },
    { x: 180, y: 60 }, { x: 180, y: 100 }, { x: 180, y: 140 }, { x: 180, y: 180 },
    { x: 140, y: 180 }, { x: 100, y: 180 }, { x: 60, y: 180 }, { x: 20, y: 180 },
    { x: 20, y: 140 }, { x: 20, y: 100 }, { x: 20, y: 60 }, { x: 20, y: 20 },
  ];
}

function generateCaret(): Point[] {
  return [
    { x: 20, y: 180 }, { x: 40, y: 140 }, { x: 60, y: 100 }, { x: 80, y: 60 }, { x: 100, y: 20 },
    { x: 120, y: 60 }, { x: 140, y: 100 }, { x: 160, y: 140 }, { x: 180, y: 180 },
  ];
}

function generateStar(): Point[] {
  const pts: Point[] = [];
  const cx = 100, cy = 100, outerR = 80, innerR = 35;
  for (let i = 0; i < 5; i++) {
    const outerAngle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    const innerAngle = outerAngle + Math.PI / 5;
    pts.push({ x: cx + outerR * Math.cos(outerAngle), y: cy + outerR * Math.sin(outerAngle) });
    pts.push({ x: cx + innerR * Math.cos(innerAngle), y: cy + innerR * Math.sin(innerAngle) });
  }
  pts.push({ ...pts[0] }); // close the star
  return pts;
}

const BUILT_IN_TEMPLATES: GestureTemplate[] = [
  { name: 'line', points: generateLine() },
  { name: 'circle', points: generateCircle() },
  { name: 'checkmark', points: generateCheckmark() },
  { name: 'X', points: generateX() },
  { name: 'Z', points: generateZ() },
  { name: 'triangle', points: generateTriangle() },
  { name: 'L', points: generateL() },
  { name: 'U', points: generateU() },
  { name: 'square', points: generateSquare() },
  { name: 'caret', points: generateCaret() },
  { name: 'star', points: generateStar() },
];

// --- Recogniser class ---

export class Recogniser {
  private templates: { name: string; processed: Point[] }[] = [];

  constructor(customTemplates: GestureTemplate[] = []) {
    const all = [...BUILT_IN_TEMPLATES, ...customTemplates];
    for (const t of all) {
      if (t.points.length >= 3) {
        this.templates.push({ name: t.name, processed: processStroke(t.points) });
      }
    }
  }

  addTemplate(template: GestureTemplate): void {
    if (template.points.length >= 3) {
      this.templates.push({ name: template.name, processed: processStroke(template.points) });
    }
  }

  recognise(stroke: Point[], minScore: number = 0.6): RecognitionResult | null {
    if (stroke.length < 3) {
      return null;
    }

    const processed = processStroke(stroke);
    let bestDist = Infinity;
    let bestName = '';

    for (const t of this.templates) {
      const d = distanceAtBestAngle(processed, t.processed);
      if (d < bestDist) {
        bestDist = d;
        bestName = t.name;
      }
    }

    const score = 1 - bestDist / HALF_DIAGONAL;
    if (score < minScore) {
      return null;
    }

    return { name: bestName, score };
  }
}

export function getBuiltInTemplates(): GestureTemplate[] {
  return BUILT_IN_TEMPLATES.map((t) => ({ name: t.name, points: [...t.points] }));
}
