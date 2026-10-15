"use client";

import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";

export function DragTrack({ children, className = "", ariaLabel }: { children: ReactNode; className?: string; ariaLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const updateFlow = () => {
      const mid = el.scrollLeft + el.clientWidth / 2;
      for (const child of el.children) {
        const node = child as HTMLElement;
        const center = node.offsetLeft + node.offsetWidth / 2;
        const raw = (center - mid) / Math.max(node.offsetWidth, 1);
        node.style.setProperty("--flow", Math.max(-1.15, Math.min(1.15, raw)).toFixed(3));
      }
    };

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX) && el.scrollWidth > el.clientWidth) {
        el.scrollLeft += event.deltaY;
        event.preventDefault();
      }
    };

    updateFlow();
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("scroll", updateFlow, { passive: true });
    window.addEventListener("resize", updateFlow);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scroll", updateFlow);
      window.removeEventListener("resize", updateFlow);
    };
  }, []);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    drag.current = { active: true, startX: event.clientX, startScroll: el.scrollLeft, moved: false };
    el.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || !drag.current.active) return;
    const delta = event.clientX - drag.current.startX;
    if (Math.abs(delta) > 6) drag.current.moved = true;
    el.scrollLeft = drag.current.startScroll - delta;
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    if (drag.current.moved) el.dataset.dragging = "1";
    drag.current.active = false;
    window.setTimeout(() => {
      delete el.dataset.dragging;
    }, 80);
    if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
  }

  return (
    <div
      ref={ref}
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={`drag-track ${className}`}
    >
      {children}
    </div>
  );
}

export function TiltCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    ref.current?.style.setProperty("--rx", `${(0.5 - y) * 8}deg`);
    ref.current?.style.setProperty("--ry", `${(x - 0.5) * 10}deg`);
    ref.current?.style.setProperty("--px", `${x * 100}%`);
    ref.current?.style.setProperty("--py", `${y * 100}%`);
  }

  function reset() {
    ref.current?.style.setProperty("--rx", "0deg");
    ref.current?.style.setProperty("--ry", "0deg");
  }

  return (
    <div ref={ref} onPointerMove={onPointerMove} onPointerLeave={reset} className={`tilt-card ${className}`}>
      {children}
    </div>
  );
}
