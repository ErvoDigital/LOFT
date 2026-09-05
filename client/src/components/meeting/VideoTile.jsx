import { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import Avatar from "../common/Avatar.jsx";
import AnnotationLayer from "./AnnotationLayer.jsx";
import AnnotationToolbar from "./AnnotationToolbar.jsx";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const SCALE_STEP = 0.25;
const DEFAULT_COLOR = "#ef4444";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function VideoTile({
  stream,
  name,
  avatarColor,
  isLocal,
  camOn = true,
  connecting = false,
  mirrored,
  large = false,
  fit = "cover",
  zoomable = false,
  // Screen-share annotation overlay — `annotatable` renders drawn shapes for
  // everyone; `canDraw` additionally shows the toolbar and lets this viewer
  // add to them (only true for whoever is currently presenting).
  annotatable = false,
  canDraw = false,
  annotations = [],
  onAddAnnotation,
  onUndoAnnotation,
  onUpdateAnnotation,
  onClearAnnotations,
}) {
  const hasVideo = stream && camOn;
  const videoRef = useRef(null);

  // A stable ref (not an inline callback ref) so re-renders — e.g. every
  // pointermove while panning — don't change the ref's identity. A changed
  // callback-ref identity makes React detach-then-reattach it on each render,
  // which briefly nulls srcObject and flickers the video during a drag.
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream || null;
  }, [stream, hasVideo]);

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef(null);
  const dragStartRef = useRef(null); // { x, y, panX, panY }

  const [tool, setTool] = useState("pan");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [contentRect, setContentRect] = useState(null); // letterboxed video content box, in px within the container

  // object-fit: contain letterboxes the video inside the container when their
  // aspect ratios differ — annotations must line up with the actual pixels,
  // not the (possibly larger) container, so this tracks that inner box.
  useEffect(() => {
    if (!annotatable) return;
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    function recompute() {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!cw || !ch || !vw || !vh) return;
      const containerAspect = cw / ch;
      const videoAspect = vw / vh;
      let width, height, left, top;
      if (videoAspect > containerAspect) {
        width = cw;
        height = cw / videoAspect;
        left = 0;
        top = (ch - height) / 2;
      } else {
        height = ch;
        width = ch * videoAspect;
        top = 0;
        left = (cw - width) / 2;
      }
      setContentRect({ left, top, width, height });
    }

    recompute();
    video.addEventListener("loadedmetadata", recompute);
    video.addEventListener("resize", recompute);
    const ro = new ResizeObserver(recompute);
    ro.observe(container);
    return () => {
      video.removeEventListener("loadedmetadata", recompute);
      video.removeEventListener("resize", recompute);
      ro.disconnect();
    };
  }, [annotatable, stream, hasVideo]);

  // Ctrl/Cmd+Z undoes the presenter's last mark from anywhere on the page —
  // skipped while focus is in a text field (e.g. the annotation text tool's
  // own input, or any other input) so it doesn't hijack the browser's normal
  // typing-undo there.
  useEffect(() => {
    if (!canDraw) return;
    function handleKeyDown(e) {
      const isUndo = (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z";
      if (!isUndo) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;
      e.preventDefault();
      onUndoAnnotation?.();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canDraw, onUndoAnnotation]);

  function clampPan(nextPan, nextScale) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return nextPan;
    const maxX = (rect.width * (nextScale - 1)) / 2;
    const maxY = (rect.height * (nextScale - 1)) / 2;
    return { x: clamp(nextPan.x, -maxX, maxX), y: clamp(nextPan.y, -maxY, maxY) };
  }

  function applyScale(nextScale) {
    const bounded = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    setScale(bounded);
    setPan((prev) => (bounded === MIN_SCALE ? { x: 0, y: 0 } : clampPan(prev, bounded)));
  }

  function handleWheel(e) {
    if (!zoomable) return;
    e.preventDefault();
    applyScale(scale + (e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP));
  }

  function handlePointerDown(e) {
    if (!zoomable || scale <= MIN_SCALE) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e) {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan(clampPan({ x: dragStartRef.current.panX + dx, y: dragStartRef.current.panY + dy }, scale));
  }

  function endDrag() {
    dragStartRef.current = null;
    setDragging(false);
  }

  const zoomPercent = Math.round(scale * 100);
  const transformStyle = zoomable
    ? { transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transition: dragging ? "none" : "transform 0.15s ease-out" }
    : undefined;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-2xl border border-ink-800 bg-ink-800 shadow-panel ${
        large ? "h-full w-full" : "aspect-video"
      }`}
      onWheel={zoomable ? handleWheel : undefined}
      onPointerDown={zoomable ? handlePointerDown : undefined}
      onPointerMove={zoomable ? handlePointerMove : undefined}
      onPointerUp={zoomable ? endDrag : undefined}
      onPointerLeave={zoomable ? endDrag : undefined}
      onDoubleClick={zoomable ? () => applyScale(1) : undefined}
    >
      {hasVideo ? (
        annotatable ? (
          <div className="absolute inset-0" style={transformStyle}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={isLocal}
              className={`h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"} ${
                zoomable && scale > MIN_SCALE ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""
              }`}
            />
            <AnnotationLayer
              rect={contentRect}
              shapes={annotations}
              canDraw={canDraw}
              tool={tool}
              color={color}
              onAdd={onAddAnnotation}
              onUpdate={onUpdateAnnotation}
            />
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal}
            className={`h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"} ${
              mirrored ?? isLocal ? "-scale-x-100" : ""
            } ${zoomable && scale > MIN_SCALE ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""}`}
            style={transformStyle}
          />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-ink-800">
          <Avatar name={name} color={avatarColor} size={56} />
        </div>
      )}
      {connecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-ink-900/60 text-xs font-medium text-white/80">
          Connecting…
        </div>
      )}
      <div className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-md bg-ink-900/70 px-2 py-0.5 text-xs font-medium text-white">
        {name} {isLocal && "(you)"}
      </div>
      {canDraw && hasVideo && (
        <AnnotationToolbar
          tool={tool}
          onToolChange={setTool}
          color={color}
          onColorChange={setColor}
          onUndo={onUndoAnnotation}
          onClear={onClearAnnotations}
          canUndo={annotations.length > 0}
          canClear={annotations.length > 0}
        />
      )}
      {zoomable && hasVideo && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-ink-900/70 p-1"
        >
          <button
            onClick={() => applyScale(scale - SCALE_STEP)}
            disabled={scale <= MIN_SCALE}
            title="Zoom out"
            aria-label="Zoom out"
            className="flex h-6 w-6 items-center justify-center rounded text-white/70 hover:text-white disabled:opacity-30"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => applyScale(1)}
            title="Reset zoom"
            aria-label="Reset zoom"
            className="min-w-[2.5rem] rounded px-1 text-center text-[11px] font-medium text-white/70 hover:text-white"
          >
            {zoomPercent}%
          </button>
          <button
            onClick={() => applyScale(scale + SCALE_STEP)}
            disabled={scale >= MAX_SCALE}
            title="Zoom in"
            aria-label="Zoom in"
            className="flex h-6 w-6 items-center justify-center rounded text-white/70 hover:text-white disabled:opacity-30"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
