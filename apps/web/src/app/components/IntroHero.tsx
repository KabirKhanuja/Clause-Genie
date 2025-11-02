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
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      gsap.set([eyeL.current, eyeR.current], { attr: { d: 'M48 58 q18 -8 36 0' }});
      gsap.set(mouth.current, { attr: { d: 'M55 100 q45 56 90 0' }, opacity: 1 });
      gsap.set(textEl.current, { attr: { 'font-size': 36 }});
      gsap.set(ctaBtn.current, { opacity: 1, y: 0 });
      return;
    }

    // clear existing triggers if any (helps on HMR)
    ScrollTrigger.getAll().forEach(t => t.kill());

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top top',
        end: '+=600',    // less scroll distance for snappier animation
        scrub: 0.6,
        pin: true,
        anticipatePin: 0.5
      }
    });

    // Make text shrink modestly (not massive)
    tl.to(textEl.current, { attr: { 'font-size': 36 }, duration: 0.6 }, 0);

    // Eyes open: gentle arc change
    tl.to(eyeL.current, { attr: { d: 'M48 58 q18 -8 36 0' }, duration: 0.6, ease: 'power1.out' }, 0.12);
    tl.to(eyeR.current, { attr: { d: 'M124 58 q18 -8 36 0' }, duration: 0.6, ease: 'power1.out' }, 0.12);

    // Mouth opens a little later
    tl.to(mouth.current, { attr: { d: 'M55 100 q45 56 90 0' }, duration: 0.8, ease: 'power2.out' }, 0.5);

    // CTA reveals from below (mouth area)
    tl.fromTo(ctaBtn.current, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power1.out' }, 0.95);

    return () => {
      tl.kill();
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);

  return (
    <section ref={containerRef} className={styles.wrapper} aria-label="Intro animation">
      <div className={styles.center}>
        {/* tuned viewBox & scaled layout so font + shapes fit well */}
        <svg viewBox="0 0 220 140" className={styles.face} aria-hidden>
          {/* headline — smaller so it won't overflow */}
          <text ref={textEl as any} x="12" y="28" fontSize="44" fill="#2f6fb8" fontWeight="700" letterSpacing="0.5">CLAUSE GENIE</text>

          {/* eyebrow-ish lines (eyes closed initial) */}
          <path d="M50 50 q20 -10 40 0" stroke="#2f6fb8" strokeWidth="2.8" fill="none" strokeLinecap="round" opacity="0.95" />
          <path d="M126 50 q20 -10 40 0" stroke="#2f6fb8" strokeWidth="2.8" fill="none" strokeLinecap="round" opacity="0.95" />

          {/* baseline */}
          <line x1="8" x2="212" y1="66" y2="66" stroke="#2f6fb8" strokeWidth="1.4" opacity="0.45" />

          {/* Eyes (start slightly more closed) */}
          <path ref={eyeL as any} d="M48 62 q18 -14 36 0" stroke="#2f6fb8" strokeWidth="3" fill="none" strokeLinecap="round"/>
          <path ref={eyeR as any} d="M124 62 q18 -14 36 0" stroke="#2f6fb8" strokeWidth="3" fill="none" strokeLinecap="round"/>

          {/* Mouth (small line to start) */}
          <path ref={mouth as any} d="M62 92 q46 0 92 0" stroke="#2f6fb8" strokeWidth="3.6" fill="none" strokeLinecap="round" opacity="1"/>
        </svg>
      </div>

      <div className={styles.controls}>
        <button
          ref={ctaBtn as any}
          className={`rounded-full px-6 py-3 font-semibold cta-float`}
          style={{ background: 'linear-gradient(90deg,#13a4ec,#8a2be2)', color: 'black', opacity: 0 }}
          onClick={() => {
            // scroll into main or navigate
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