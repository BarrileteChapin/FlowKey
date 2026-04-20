import React, { useRef, useState, useCallback, useEffect } from 'react';
import type { Point } from '../../src/types';
import './GestureCanvas.css';

interface GestureCanvasProps {
  onRecognise: (points: Point[]) => void;
  onClear?: () => void;
  hintPoints?: Point[] | null;
  confidence: number | null;
  recognisedName: string | null;
}

export function GestureCanvas({ onRecognise, onClear, hintPoints, confidence, recognisedName }: GestureCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [history, setHistory] = useState<Point[][]>([]);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  useEffect(() => {
    const node = svgRef.current;
    if (!node) return;
    const updateSize = () => {
      setCanvasSize({ width: node.clientWidth, height: node.clientHeight });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
    if (e.pointerType === 'mouse' && e.button === 2) {
      e.preventDefault();
    }

    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    pointerIdRef.current = e.pointerId;
    lastPointRef.current = point;
    setPoints([point]);
    setDrawing(true);
    svgRef.current?.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!drawing || pointerIdRef.current !== e.pointerId) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const next = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const last = lastPointRef.current;
    if (last && distance(last, next) < 3) return;
    lastPointRef.current = next;
    setPoints((prev) => [...prev, next]);
  }, [drawing]);

  const finishStroke = useCallback((e?: React.PointerEvent<SVGSVGElement>) => {
    if (e && pointerIdRef.current !== e.pointerId) return;
    if (e && svgRef.current) {
      try {
        svgRef.current.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore release errors when capture is missing
      }
    }

    if (drawing && points.length >= 3) {
      const refined = refineStroke(points);
      if (refined.length >= 3) {
        onRecognise(refined);
        setHistory((prev) => [...prev, points]);
      }
    }

    pointerIdRef.current = null;
    lastPointRef.current = null;
    setDrawing(false);
  }, [drawing, points, onRecognise]);

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');
  const hintPolyline = hintPoints && canvasSize.width > 0 && canvasSize.height > 0
    ? mapHintToCanvas(hintPoints, canvasSize)
    : '';

  const handleClear = useCallback(() => {
    setPoints([]);
    setHistory([]);
    onClear?.();
  }, [onClear]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const nextHistory = history.slice(0, -1);
    const previous = nextHistory[nextHistory.length - 1];
    setHistory(nextHistory);
    setPoints(previous ?? []);
    if (!previous) {
      onClear?.();
    }
  }, [history, onClear]);

  return (
    <div className="gesture-canvas-container">
      <svg
        ref={svgRef}
        className="gesture-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerLeave={finishStroke}
        onPointerCancel={finishStroke}
        onContextMenu={(e) => e.preventDefault()}
        role="img"
        aria-label="Gesture drawing canvas"
      >
        {hintPolyline && (
          <polyline className="gesture-hint" points={hintPolyline} />
        )}
        {points.length > 1 && (
          <polyline className="gesture-stroke" points={polyline} />
        )}
        {confidence !== null && (
          <circle
            className="gesture-confidence-fill"
            cx="50%"
            cy="50%"
            r={48}
            style={{ opacity: confidence * 0.35 }}
          />
        )}
      </svg>
      {recognisedName && (
        <div className="gesture-result">
          <span className="gesture-result__name">{recognisedName}</span>
          {confidence !== null && (
            <span className="gesture-result__score">{Math.round(confidence * 100)}%</span>
          )}
        </div>
      )}
      {!recognisedName && !drawing && points.length > 0 && (
        <div className="gesture-result gesture-result--none">No match</div>
      )}
      <div className="gesture-controls">
        <button className="gesture-control" onClick={handleUndo} disabled={history.length === 0}>
          Undo
        </button>
        <button className="gesture-control" onClick={handleClear} disabled={points.length === 0}>
          Clear
        </button>
      </div>
    </div>
  );
}

function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function smoothStroke(points: Point[], passes: number = 2): Point[] {
  if (points.length < 3) return points;
  let current = points;
  for (let pass = 0; pass < passes; pass += 1) {
    const next: Point[] = [current[0]];
    for (let i = 1; i < current.length - 1; i += 1) {
      const prev = current[i - 1];
      const mid = current[i];
      const after = current[i + 1];
      next.push({
        x: (prev.x + mid.x * 2 + after.x) / 4,
        y: (prev.y + mid.y * 2 + after.y) / 4,
      });
    }
    next.push(current[current.length - 1]);
    current = next;
  }
  return current;
}

function simplifyStroke(points: Point[], epsilon: number = 1.25): Point[] {
  if (points.length < 3) return points;
  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop() as [number, number];
    let maxDist = 0;
    let index = -1;
    for (let i = start + 1; i < end; i += 1) {
      const dist = perpendicularDistance(points[i], points[start], points[end]);
      if (dist > maxDist) {
        maxDist = dist;
        index = i;
      }
    }
    if (maxDist > epsilon && index !== -1) {
      keep[index] = true;
      stack.push([start, index]);
      stack.push([index, end]);
    }
  }

  const simplified = points.filter((_, idx) => keep[idx]);
  return simplified.length >= 3 ? simplified : points;
}

function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return distance(p, a);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  const proj = { x: a.x + clamped * dx, y: a.y + clamped * dy };
  return distance(p, proj);
}

function refineStroke(points: Point[]): Point[] {
  const filtered: Point[] = [];
  for (const p of points) {
    if (filtered.length === 0 || distance(filtered[filtered.length - 1], p) >= 2) {
      filtered.push(p);
    }
  }
  const smoothed = smoothStroke(filtered, 2);
  return simplifyStroke(smoothed, 1.25);
}

function mapHintToCanvas(points: Point[], size: { width: number; height: number }): string {
  if (points.length < 2) return '';
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const padding = 18;
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const scale = Math.min((size.width - padding * 2) / w, (size.height - padding * 2) / h);
  const offsetX = (size.width - w * scale) / 2;
  const offsetY = (size.height - h * scale) / 2;
  return points
    .map((p) => `${offsetX + (p.x - minX) * scale},${offsetY + (p.y - minY) * scale}`)
    .join(' ');
}
