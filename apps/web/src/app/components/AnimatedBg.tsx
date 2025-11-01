'use client';
import { useEffect, useRef } from 'react';

export default function AnimatedBg() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let particles: { x:number;y:number;r:number;vx:number;vy:number;alpha:number }[] = [];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles = Array.from({ length: Math.max(8, Math.floor(window.innerWidth/160)) }).map(() => ({
        x: Math.random()*canvas.width,
        y: Math.random()*canvas.height,
        r: 20 + Math.random()*60,
        vx: (Math.random()-0.5)*0.25,
        vy: (Math.random()-0.5)*0.25,
        alpha: 0.06 + Math.random()*0.12
      }));
    }
    resize();
    window.addEventListener('resize', resize);

    function step() {
      ctx.clearRect(0,0,canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        // wrap
        if (p.x < -100) p.x = canvas.width+100;
        if (p.x > canvas.width+100) p.x = -100;
        if (p.y < -100) p.y = canvas.height+100;
        if (p.y > canvas.height+100) p.y = -100;

        const g = ctx.createRadialGradient(p.x, p.y, p.r*0.1, p.x, p.y, p.r);
        g.addColorStop(0, 'rgba(19,164,236,' + (p.alpha+0.04) + ')');
        g.addColorStop(0.5, 'rgba(138,43,226,' + (p.alpha*0.9) + ')');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.fillStyle = g;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.fill();
      }
      raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={ref} className="particle-canvas" />;
}