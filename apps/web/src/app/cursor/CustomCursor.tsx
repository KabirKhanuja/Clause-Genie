"use client";

import { useEffect, useRef } from "react";

export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const pos = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      pos.current.x = e.clientX;
      pos.current.y = e.clientY;
      if (cursorRef.current) cursorRef.current.style.display = "block";
      if (ringRef.current) ringRef.current.style.display = "block";
    };

    window.addEventListener("mousemove", onMove);

    const lerp = (a: number, b: number, n = 0.15) => (1 - n) * a + n * b;

    const draw = () => {
      const targetX = pos.current.x;
      const targetY = pos.current.y;
      if (cursorRef.current && ringRef.current) {
        const rect = cursorRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const nx = lerp(cx, targetX, 0.25);
        const ny = lerp(cy, targetY, 0.25);
        cursorRef.current.style.transform = `translate3d(${nx - 6}px, ${ny - 6}px, 0)`;
        ringRef.current.style.transform = `translate3d(${nx - 16}px, ${ny - 16}px, 0)`;
      }
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("mousemove", onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <>
      <div
        ref={ringRef}
        aria-hidden
        className="fixed pointer-events-none z-9999"
        style={{
          width: 32,
          height: 32,
          borderRadius: 9999,
          border: "2px solid rgba(19,164,236,0.95)",
          boxShadow: "0 6px 20px rgba(19,164,236,0.12), 0 0 30px rgba(0,242,234,0.06)",
          transform: "translate3d(-9999px, -9999px, 0)",
          transition: "opacity 120ms ease",
          opacity: 0.98,
        }}
      />

      <div
        ref={cursorRef}
        aria-hidden
        className="fixed pointer-events-none z-9999"
        style={{
          width: 12,
          height: 12,
          borderRadius: 9999,
          background: "#13a4ec",
          transform: "translate3d(-9999px, -9999px, 0)",
          boxShadow: "0 4px 14px rgba(19,164,236,0.35)",
        }}
      />
    </>
  );
}