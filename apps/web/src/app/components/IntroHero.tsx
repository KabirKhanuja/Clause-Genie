'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import styles from './IntroHero.module.css';

gsap.registerPlugin(ScrollTrigger);

export default function IntroHero() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const eyeL = useRef<SVGPathElement | null>(null);
  const eyeR = useRef<SVGPathElement | null>(null);
  const mouth = useRef<SVGPathElement | null>(null);
  const textEl = useRef<SVGTextElement | null>(null);
  const ctaBtn = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // respect prefers-reduced-motion
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      // apply final state quickly
      gsap.set([eyeL.current, eyeR.current], { attr: { d: 'M30 48 q20 -5 40 0' }});
      gsap.set(mouth.current, { attr: { d: 'M50 88 q40 60 80 0' }, opacity: 1 });
      gsap.set(textEl.current, { attr: { 'font-size': 28 }});
      gsap.set(ctaBtn.current, { opacity: 1, y: 0 });
      return;
    }

    // create timeline controlled by scroll
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top top',
        end: '+=700',
        scrub: 0.6,
        pin: true,
        anticipatePin: 1
      }
    });

    // Eyes: small arc -> wider arc (simulate opening)
    tl.to(eyeL.current, { attr: { d: 'M30 40 q20 -5 40 0' }, duration: 0.6 }, 0);
    tl.to(eyeR.current, { attr: { d: 'M110 40 q20 -5 40 0' }, duration: 0.6 }, 0);

    // Text: shrink slightly
    tl.to(textEl.current, { attr: { 'font-size': 28 }, duration: 0.6 }, 0.15);

    // Mouth opens (line -> big arc)
    tl.to(mouth.current, { attr: { d: 'M50 88 q40 60 80 0' }, duration: 0.8 }, 0.6);

    // Reveal CTA
    tl.fromTo(ctaBtn.current, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45 }, 0.95);

    return () => {
      tl.kill();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <section ref={containerRef} className={styles.wrapper} aria-label="Intro animation">
      <div className={styles.center}>
        <svg viewBox="0 0 200 140" className={styles.face} aria-hidden>
          <text ref={textEl as any} x="12" y="26" fontSize="40" fill="#2f6fb8" fontWeight="700">CLAUSE GENIE</text>
          <line x1="0" x2="200" y1="60" y2="60" stroke="#2f6fb8" strokeWidth="1" opacity="0.45" />

          {/* Eyes (initial small arcs) */}
          <path ref={eyeL as any} d="M30 48 q20 -15 40 0" stroke="#2f6fb8" strokeWidth="2" fill="none" strokeLinecap="round"/>
          <path ref={eyeR as any} d="M110 48 q20 -15 40 0" stroke="#2f6fb8" strokeWidth="2" fill="none" strokeLinecap="round"/>

          {/* Mouth (closed line initially) */}
          <path ref={mouth as any} d="M50 80 q40 0 80 0" stroke="#2f6fb8" strokeWidth="2" fill="none" strokeLinecap="round" opacity="1"/>
        </svg>
      </div>

      <div className={styles.controls}>
        <button
          ref={ctaBtn as any}
          className="rounded-full px-6 py-3 font-semibold"
          style={{ background: 'linear-gradient(90deg,#13a4ec,#8a2be2)', color: 'black', opacity: 0 }}
          onClick={() => {
            // navigate to app page or remove splash — adapt as needed
            // example: scroll to main content
            const el = document.querySelector('main');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          Get started
        </button>
      </div>
    </section>
  );
}