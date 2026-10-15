"use client";

import {
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";

// 首页动效容器：用 rAF 把指针位置缓动到 CSS 变量上，子元素用 --dx/--dy 做视差。
// 不把具体视觉写在这里，方便首屏、卡片、吉祥物共用同一套坐标。
export function PointerStage({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0.5, y: 0.5 });
  const current = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;

    let frame = 0;
    const tick = () => {
      const cur = current.current;
      const next = target.current;
      cur.x += (next.x - cur.x) * 0.07;
      cur.y += (next.y - cur.y) * 0.07;
      const el = ref.current;
      if (el) {
        el.style.setProperty("--mx", cur.x.toFixed(4));
        el.style.setProperty("--my", cur.y.toFixed(4));
        el.style.setProperty("--dx", (cur.x - 0.5).toFixed(4));
        el.style.setProperty("--dy", (cur.y - 0.5).toFixed(4));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    target.current = {
      x: (event.clientX - box.left) / box.width,
      y: (event.clientY - box.top) / box.height,
    };
  }

  function handlePointerLeave() {
    target.current = { x: 0.5, y: 0.5 };
  }

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`pointer-stage ${className}`}
    >
      {children}
    </div>
  );
}

export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-visible");
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-visible");
          observer.disconnect();
        }
      },
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      style={{ transitionDelay: delay ? `${delay}ms` : undefined }}
    >
      {children}
    </div>
  );
}

export function SpotlightCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    ref.current?.style.setProperty("--sx", `${x}px`);
    ref.current?.style.setProperty("--sy", `${y}px`);
    ref.current?.style.setProperty("--tx", `${((x / box.width) - 0.5) * 6}deg`);
    ref.current?.style.setProperty("--ty", `${(0.5 - y / box.height) * 5}deg`);
  }

  function reset() {
    ref.current?.style.setProperty("--sx", "50%");
    ref.current?.style.setProperty("--sy", "0px");
    ref.current?.style.setProperty("--tx", "0deg");
    ref.current?.style.setProperty("--ty", "0deg");
  }

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerLeave={reset}
      className={`spotlight-card ${className}`}
    >
      {children}
    </div>
  );
}

export function LoopMarquee({ items }: { items: string[] }) {
  const sequence = [...items, ...items];
  return (
    <div className="loop-marquee" aria-hidden>
      <div className="loop-marquee-track">
        {sequence.map((item, index) => (
          <span key={`${item}-${index}`} className="loop-marquee-item">
            {item}
            <span className="loop-marquee-dot" />
          </span>
        ))}
      </div>
    </div>
  );
}

export function parallaxStyle(strength = 24): CSSProperties {
  return {
    transform: `translate3d(calc(var(--dx, 0) * ${strength}px), calc(var(--dy, 0) * ${strength * 0.7}px), 0)`,
  };
}
