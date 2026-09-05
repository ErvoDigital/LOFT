import { useEffect, useRef, useState } from "react";

const STROKE = 0.6;
const HIGHLIGHT_STROKE = 3.2;
const HIT_STROKE = 8; // wide invisible hit area so thin pen/line strokes are easy to grab and drag
const FONT_SIZE = 5;

function normalizedPoint(svgEl, clientX, clientY) {
  const rect = svgEl.getBoundingClientRect();
  const x = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
  const y = clamp(((clientY - rect.top) / rect.height) * 100, 0, 100);
  return [x, y];
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// `autoFocus` doesn't reliably focus an element dynamically inserted inside
// an SVG <foreignObject> — an explicit focus-on-mount effect does.
function TextInput({ color, onCommit, onCancel }) {
  const inputRef = useRef(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  return (
    <input
      ref={inputRef}
      defaultValue=""
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit(e.currentTarget.value);
        if (e.key === "Escape") onCancel();
      }}
      onBlur={(e) => onCommit(e.currentTarget.value)}
      style={{
        width: "100%",
        fontSize: "10px",
        padding: "1px 3px",
        border: `1px solid ${color}`,
        borderRadius: 3,
        outline: "none",
        background: "rgba(17,17,24,0.85)",
        color,
      }}
    />
  );
}

// `interactive` (true only for the presenter, and only while the pointer/pan
// tool is selected — otherwise a click should draw a new shape, not grab an
// old one) makes the shape itself the pointer-event target with a "move"
// cursor, so it can be click-dragged. A transparent fill/wide invisible
// stroke gives fill-less shapes a generous hit area instead of requiring a
// pixel-precise grab on their thin border.
function ShapeElement({ shape, interactive, onPointerDown }) {
  const { type, color } = shape;
  const pe = interactive ? "all" : "none";
  const cursor = interactive ? "move" : undefined;

  if (type === "path" || type === "highlight") {
    const points = shape.points.map(([x, y]) => `${x},${y}`).join(" ");
    return (
      <g>
        {interactive && (
          <polyline
            points={points}
            fill="none"
            stroke="transparent"
            strokeWidth={HIT_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
            pointerEvents={pe}
            onPointerDown={onPointerDown}
            style={{ cursor }}
          />
        )}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={type === "highlight" ? HIGHLIGHT_STROKE : STROKE}
          strokeOpacity={type === "highlight" ? 0.45 : 1}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      </g>
    );
  }
  if (type === "rect") {
    const x = Math.min(shape.x0, shape.x1);
    const y = Math.min(shape.y0, shape.y1);
    return (
      <rect
        x={x}
        y={y}
        width={Math.abs(shape.x1 - shape.x0)}
        height={Math.abs(shape.y1 - shape.y0)}
        fill="transparent"
        stroke={color}
        strokeWidth={STROKE}
        pointerEvents={pe}
        onPointerDown={onPointerDown}
        style={{ cursor }}
      />
    );
  }
  if (type === "ellipse") {
    return (
      <ellipse
        cx={(shape.x0 + shape.x1) / 2}
        cy={(shape.y0 + shape.y1) / 2}
        rx={Math.abs(shape.x1 - shape.x0) / 2}
        ry={Math.abs(shape.y1 - shape.y0) / 2}
        fill="transparent"
        stroke={color}
        strokeWidth={STROKE}
        pointerEvents={pe}
        onPointerDown={onPointerDown}
        style={{ cursor }}
      />
    );
  }
  if (type === "line") {
    return (
      <g>
        {interactive && (
          <line
            x1={shape.x0}
            y1={shape.y0}
            x2={shape.x1}
            y2={shape.y1}
            stroke="transparent"
            strokeWidth={HIT_STROKE}
            strokeLinecap="round"
            pointerEvents={pe}
            onPointerDown={onPointerDown}
            style={{ cursor }}
          />
        )}
        <line x1={shape.x0} y1={shape.y0} x2={shape.x1} y2={shape.y1} stroke={color} strokeWidth={STROKE} strokeLinecap="round" pointerEvents="none" />
      </g>
    );
  }
  if (type === "text") {
    return (
      <text
        x={shape.x0}
        y={shape.y0}
        fill={color}
        fontSize={FONT_SIZE}
        fontWeight={600}
        style={{ whiteSpace: "pre", cursor }}
        pointerEvents={pe}
        onPointerDown={onPointerDown}
      >
        {shape.text}
      </text>
    );
  }
  return null;
}

// Absolutely positioned to exactly cover the letterboxed video content — not
// the whole tile — so drawings land on the shared screen itself, not the
// black bars around it. Lives inside the same pan/zoom-transformed wrapper
// as the <video>, so shapes stay pinned to the content as the viewer zooms.
export default function AnnotationLayer({ rect, shapes, canDraw, tool, color, onAdd, onUpdate }) {
  const svgRef = useRef(null);
  const [draft, setDraft] = useState(null); // in-progress new shape, local only until pointer up
  const [pendingText, setPendingText] = useState(null); // { x, y }
  const [dragPreview, setDragPreview] = useState(null); // { id, dx, dy } — live offset while moving an existing shape
  const drawingRef = useRef(false);
  const shapeDragRef = useRef(null); // { id, startX, startY }

  if (!rect) return null;

  const drawTool = canDraw && tool !== "pan";
  // Existing marks are only grabbable in the pointer/pan tool — otherwise a
  // click on top of one should start a new shape, not move the old one.
  const canMoveShapes = canDraw && tool === "pan";

  function handleShapePointerDown(e, shape) {
    e.stopPropagation();
    e.preventDefault();
    const [x, y] = normalizedPoint(svgRef.current, e.clientX, e.clientY);
    shapeDragRef.current = { id: shape.id, startX: x, startY: y };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragPreview({ id: shape.id, dx: 0, dy: 0 });
  }

  function handlePointerDown(e) {
    if (!drawTool) return;
    e.stopPropagation();
    // The SVG isn't focusable, so a bare mousedown's default action shifts
    // focus toward <body> — which, for the text tool, fires the freshly
    // mounted input's onBlur before our own effect gets to focus it,
    // self-cancelling the text box the instant it appears.
    e.preventDefault();
    const [x, y] = normalizedPoint(svgRef.current, e.clientX, e.clientY);

    if (tool === "text") {
      setPendingText({ x, y });
      return;
    }

    drawingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === "pen" || tool === "highlight") {
      // Shape type is "path" (not the tool id "pen") — ShapeElement renders
      // freehand strokes as <polyline> under the "path"/"highlight" types.
      setDraft({ type: tool === "highlight" ? "highlight" : "path", color, points: [[x, y]] });
    } else {
      setDraft({ type: tool, color, x0: x, y0: y, x1: x, y1: y });
    }
  }

  function handlePointerMove(e) {
    if (shapeDragRef.current) {
      const [x, y] = normalizedPoint(svgRef.current, e.clientX, e.clientY);
      const { id, startX, startY } = shapeDragRef.current;
      setDragPreview({ id, dx: x - startX, dy: y - startY });
      return;
    }
    if (!drawingRef.current || !draft) return;
    const [x, y] = normalizedPoint(svgRef.current, e.clientX, e.clientY);
    if (draft.type === "path" || draft.type === "highlight") {
      setDraft((prev) => ({ ...prev, points: [...prev.points, [x, y]] }));
    } else {
      setDraft((prev) => ({ ...prev, x1: x, y1: y }));
    }
  }

  function finishPointer() {
    if (shapeDragRef.current) {
      const { id } = shapeDragRef.current;
      const dx = dragPreview?.dx || 0;
      const dy = dragPreview?.dy || 0;
      shapeDragRef.current = null;
      setDragPreview(null);
      if (dx === 0 && dy === 0) return;
      const shape = shapes.find((s) => s.id === id);
      if (!shape) return;
      let patch;
      if (shape.type === "path" || shape.type === "highlight") {
        patch = { points: shape.points.map(([x, y]) => [x + dx, y + dy]) };
      } else if (shape.type === "text") {
        patch = { x0: shape.x0 + dx, y0: shape.y0 + dy };
      } else {
        patch = { x0: shape.x0 + dx, y0: shape.y0 + dy, x1: shape.x1 + dx, y1: shape.y1 + dy };
      }
      onUpdate?.(id, patch);
      return;
    }

    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (draft) {
      const isTiny =
        (draft.type === "rect" || draft.type === "ellipse" || draft.type === "line") &&
        Math.hypot(draft.x1 - draft.x0, draft.y1 - draft.y0) < 1.5;
      const isShortPath = (draft.type === "path" || draft.type === "highlight") && draft.points.length < 2;
      if (!isTiny && !isShortPath) {
        onAdd({ id: crypto.randomUUID(), ...draft });
      }
    }
    setDraft(null);
  }

  function commitText(text) {
    if (text.trim()) {
      onAdd({ id: crypto.randomUUID(), type: "text", color, x0: pendingText.x, y0: pendingText.y, text: text.trim() });
    }
    setPendingText(null);
  }

  return (
    <svg
      ref={svgRef}
      data-annotation-layer="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="absolute"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        touchAction: drawTool ? "none" : undefined,
        cursor: drawTool ? (tool === "text" ? "text" : "crosshair") : undefined,
        // Only capture pointer events while actively drawing — otherwise this
        // overlay must be click-through so the container's own pan/zoom drag
        // (used by both the presenter in "pan" mode and every viewer) still
        // reaches it. Individual shapes below can still opt back in to being
        // interactive (for dragging) even while the svg itself is click-through.
        pointerEvents: drawTool ? "auto" : "none",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerLeave={finishPointer}
    >
      {shapes.map((shape) => (
        <g key={shape.id} transform={dragPreview?.id === shape.id ? `translate(${dragPreview.dx}, ${dragPreview.dy})` : undefined}>
          <ShapeElement shape={shape} interactive={canMoveShapes} onPointerDown={(e) => handleShapePointerDown(e, shape)} />
        </g>
      ))}
      {draft && <ShapeElement shape={draft} />}
      {pendingText && (
        <foreignObject x={pendingText.x} y={Math.max(0, pendingText.y - 4)} width={45} height={12}>
          <TextInput color={color} onCommit={commitText} onCancel={() => setPendingText(null)} />
        </foreignObject>
      )}
    </svg>
  );
}
