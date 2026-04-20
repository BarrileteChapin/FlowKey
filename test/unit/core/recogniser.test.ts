import { describe, it, expect } from 'vitest';
import { Recogniser, getBuiltInTemplates } from '../../../src/core/recogniser';
import type { Point } from '../../../src/types';

function generateCircleStroke(cx = 100, cy = 100, r = 80, n = 40): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

function generateLineStroke(x1 = 20, y1 = 100, x2 = 250, y2 = 100, n = 25): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) });
  }
  return pts;
}

function generateCheckmarkStroke(): Point[] {
  const pts: Point[] = [];
  // downstroke
  for (let i = 0; i <= 10; i++) pts.push({ x: 20 + i * 6, y: 100 + i * 6 });
  // upstroke
  for (let i = 1; i <= 15; i++) pts.push({ x: 80 + i * 8, y: 160 - i * 8 });
  return pts;
}

function generateLStroke(): Point[] {
  const pts: Point[] = [];
  // down
  for (let i = 0; i <= 12; i++) pts.push({ x: 20, y: 20 + i * 13 });
  // right
  for (let i = 1; i <= 12; i++) pts.push({ x: 20 + i * 13, y: 176 });
  return pts;
}

describe('Recogniser', () => {
  it('has 11 built-in templates', () => {
    const templates = getBuiltInTemplates();
    expect(templates.length).toBe(11);
    const names = templates.map((t) => t.name);
    expect(names).toContain('circle');
    expect(names).toContain('line');
    expect(names).toContain('checkmark');
    expect(names).toContain('star');
  });

  it('recognises a circle stroke', () => {
    const r = new Recogniser();
    const result = r.recognise(generateCircleStroke());
    expect(result).not.toBeNull();
    expect(result!.name).toBe('circle');
    expect(result!.score).toBeGreaterThan(0.6);
  });

  it('recognises a horizontal line stroke', () => {
    const r = new Recogniser();
    const result = r.recognise(generateLineStroke());
    expect(result).not.toBeNull();
    expect(result!.name).toBe('line');
    expect(result!.score).toBeGreaterThan(0.6);
  });

  it('recognises a checkmark stroke', () => {
    const r = new Recogniser();
    const result = r.recognise(generateCheckmarkStroke());
    expect(result).not.toBeNull();
    expect(result!.name).toBe('checkmark');
    expect(result!.score).toBeGreaterThan(0.6);
  });

  it('recognises an L-shape stroke', () => {
    const r = new Recogniser();
    const result = r.recognise(generateLStroke());
    expect(result).not.toBeNull();
    expect(result!.name).toBe('L');
    expect(result!.score).toBeGreaterThan(0.6);
  });

  it('returns null for too few points', () => {
    const r = new Recogniser();
    const result = r.recognise([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    expect(result).toBeNull();
  });

  it('returns null when score is below minScore', () => {
    const r = new Recogniser();
    // Random noise — unlikely to match well
    const noise: Point[] = [];
    for (let i = 0; i < 30; i++) noise.push({ x: Math.random() * 5, y: Math.random() * 5 });
    const result = r.recognise(noise, 0.99);
    expect(result).toBeNull();
  });

  it('accepts custom templates', () => {
    const customPoints: Point[] = [];
    // A distinct zigzag shape
    for (let i = 0; i < 20; i++) {
      customPoints.push({ x: i * 10, y: i % 2 === 0 ? 0 : 100 });
    }

    const r = new Recogniser([{ name: 'zigzag', points: customPoints }]);
    const result = r.recognise(customPoints);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('zigzag');
  });

  it('addTemplate works at runtime', () => {
    const pts: Point[] = [];
    for (let i = 0; i < 20; i++) pts.push({ x: i * 10, y: i % 2 === 0 ? 0 : 80 });

    const r = new Recogniser();
    r.addTemplate({ name: 'wave', points: pts });
    const result = r.recognise(pts);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('wave');
  });
});
