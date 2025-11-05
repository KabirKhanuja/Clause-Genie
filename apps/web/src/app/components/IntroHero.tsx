"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

type Props = {
  onStart: () => void;
};

export default function IntroHero({ onStart }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const introRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const windowHeight = window.innerHeight;
      const totalScrollHeight = containerRef.current.scrollHeight - windowHeight;
      const progress = Math.min(Math.max(window.scrollY / totalScrollHeight, 0), 1);
      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!introRef.current) return;
    gsap.fromTo(
      introRef.current,
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 1.2, ease: "power2.out" }
    );
  }, []);

  // Animation calculations 
  const eyeScale = 0.3 + scrollProgress * 0.7;
  const mouthHeight = scrollProgress * 50;
  const genieY = -20 + scrollProgress * 20;
  const genieOpacity = 0.3 + scrollProgress * 0.7;
  const titleSize = 3 - scrollProgress * 0.8;
  const ctaOpacity = Math.max(0, (scrollProgress - 0.75) * 4);
  const ctaY = 30 - Math.max(0, (scrollProgress - 0.75) * 4) * 30;

  // When user clicks Get started we call parent callback (onStart)
  const handleGetStarted = () => {
    const tl = gsap.timeline({
      defaults: { ease: "power3.inOut" },
      onComplete: () => {
        onStart();
        window.scrollTo({ top: 0, behavior: "auto" });
      },
    });

    tl.to(introRef.current, {
      opacity: 0,
      scale: 1.06,
      filter: "blur(6px)",
      boxShadow: "0 0 100px rgba(19,164,236,0.15)",
      duration: 0.9,
    });
  };

  return (
    <div ref={introRef}>
      <div ref={containerRef} style={{ height: "300vh" }} className="relative">
        <section
          className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden"
          style={{
            background: "linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%)",
          }}
          aria-label="Intro hero - Clause Genie"
        >
          {/* Title */}
          <div
            className="absolute top-20 text-center"
            style={{
              fontSize: `${titleSize}rem`,
              transition: "font-size 0.1s ease-out",
              opacity: 1.2 - scrollProgress,
            }}
          >
            <h1 className="font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
              CLAUSE GENIE
            </h1>
          </div>

          {/* Genie Character */}
          <div
            className="relative"
            style={{
              transform: `translateY(${genieY}px)`,
              opacity: genieOpacity,
              transition:
                "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s ease-out",
            }}
          >
            {/* SVG Content */}
            <svg width="400" height="500" viewBox="0 0 400 500" className="drop-shadow-2xl">
              <defs>
                <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#60d5ff" />
                  <stop offset="100%" stopColor="#3b9eff" />
                </linearGradient>
                <linearGradient id="tailGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#1e5ab8" />
                  <stop offset="100%" stopColor="#0d2d5e" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Tail (smoke effect at bottom) */}
              <g>
                <ellipse cx="200" cy="440" rx="50" ry="15" fill="url(#tailGradient)" opacity="0.6" />
                <path d="M 200 430 Q 180 410, 185 380 Q 190 350, 200 340" fill="url(#tailGradient)" opacity="0.7" />
                <path d="M 200 430 Q 220 410, 215 380 Q 210 350, 200 340" fill="url(#tailGradient)" opacity="0.7" />
              </g>

              {/* Body (main head) */}
              <ellipse cx="200" cy="220" rx="120" ry="140" fill="url(#bodyGradient)" filter="url(#glow)" />

              {/* Ears */}
              <ellipse cx="100" cy="200" rx="35" ry="55" fill="#4eb8ff" opacity="0.8" transform="rotate(-15 100 200)" />
              <ellipse cx="300" cy="200" rx="35" ry="55" fill="#4eb8ff" opacity="0.8" transform="rotate(15 300 200)" />

              {/* Face shadow */}
              <ellipse cx="200" cy="230" rx="100" ry="120" fill="#3b9eff" opacity="0.3" />

              {/* Eyebrows */}
              <path d="M 150 160 Q 170 150, 190 155" stroke="#0d2d5e" strokeWidth="8" fill="none" strokeLinecap="round" />
              <path d="M 210 155 Q 230 150, 250 160" stroke="#0d2d5e" strokeWidth="8" fill="none" strokeLinecap="round" />

              {/* Eyes (scale based on scroll) */}
              <g transform={`translate(170, 190) scale(${eyeScale})`} style={{ transformOrigin: '0 0', transition: 'transform 0.1s ease-out' }}>
                <ellipse cx="0" cy="0" rx="25" ry="30" fill="#b3f0ff" />
                <ellipse cx="0" cy="0" rx="20" ry="25" fill="#ffffff" />
                <circle cx="0" cy="0" r="12" fill="#0d2d5e" />
                <circle cx="3" cy="-3" r="5" fill="#ffffff" opacity="0.8" />
              </g>

              <g transform={`translate(230, 190) scale(${eyeScale})`} style={{ transformOrigin: '0 0', transition: 'transform 0.1s ease-out' }}>
                <ellipse cx="0" cy="0" rx="25" ry="30" fill="#b3f0ff" />
                <ellipse cx="0" cy="0" rx="20" ry="25" fill="#ffffff" />
                <circle cx="0" cy="0" r="12" fill="#0d2d5e" />
                <circle cx="3" cy="-3" r="5" fill="#ffffff" opacity="0.8" />
              </g>

              {/* Nose */}
              <ellipse cx="200" cy="220" rx="15" ry="20" fill="#3b9eff" opacity="0.6" />

              {/* Mouth - opens with scroll */}
              <g style={{ transition: 'all 0.1s ease-out' }}>
                <path d={`M 160 260 Q 200 ${260 + mouthHeight}, 240 260`} stroke="#0d2d5e" strokeWidth="6" fill="none" strokeLinecap="round" />
                {mouthHeight > 20 && (
                  <>
                    <ellipse cx="200" cy={270 + mouthHeight * 0.4} rx="35" ry={mouthHeight * 0.6} fill="#0d2d5e" opacity="0.8" />
                    <ellipse cx="200" cy={275 + mouthHeight * 0.3} rx="25" ry={mouthHeight * 0.4} fill="#ff69b4" opacity="0.7" />
                  </>
                )}
              </g>

              {/* Hair/Top knot */}
              <g>
                <path d="M 200 80 Q 180 60, 190 40 Q 200 20, 210 40 Q 220 60, 200 80" fill="#0d2d5e" opacity="0.9" />
                <ellipse cx="200" cy="85" rx="15" ry="10" fill="#0d2d5e" opacity="0.9" />
              </g>

              {/* Chin beard shadow */}
              <path d="M 150 310 Q 200 330, 250 310" fill="url(#tailGradient)" opacity="0.4" />
            </svg>
          </div>

          {/* CTA Button */}
          <button
            onClick={handleGetStarted}
            className="absolute bottom-20 rounded-full px-10 py-4 text-lg shadow-xl fusion-btn"
            style={{
              opacity: ctaOpacity,
              transform: `translateY(${ctaY}px)`,
              transition: 'opacity 0.6s ease-out, transform 0.4s ease-out',
              pointerEvents: ctaOpacity > 0.5 ? 'auto' : 'none',
            }}
            aria-hidden={ctaOpacity <= 0.5}
            aria-label="Get started"
          >
            Get Started
          </button>

          {scrollProgress < 0.8 && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-gray-500 text-sm animate-bounce">
              ↓ Scroll to wake the genie
            </div>
          )}
        </section>
      </div>
      <style jsx>{`
        @keyframes auroraPulse {
          0% {
            box-shadow: 0 0 20px rgba(94, 234, 212, 0.2),
                        0 0 40px rgba(147, 197, 253, 0.1);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 35px rgba(94, 234, 212, 0.4),
                        0 0 70px rgba(147, 197, 253, 0.25);
            transform: scale(1.02);
          }
          100% {
            box-shadow: 0 0 20px rgba(94, 234, 212, 0.2),
                        0 0 40px rgba(147, 197, 253, 0.1);
            transform: scale(1);
          }
        }

        .fusion-btn {
          background: linear-gradient(90deg, #5eead4, #93c5fd);
          color: #0a0e1a;
          font-weight: 700;
          letter-spacing: 0.03em;
          animation: auroraPulse 4s ease-in-out infinite;
          transition: all 0.4s ease;
        }

        .fusion-btn:hover {
          background: linear-gradient(90deg, #67e8f9, #a5b4fc);
          transform: translateY(-3px) scale(1.04);
          box-shadow: 0 0 45px rgba(94, 234, 212, 0.5),
                      0 0 90px rgba(147, 197, 253, 0.3);
        }
        /* float effect when hovering CTA buttons (pulse-btn / fusion-btn) */
        @keyframes pulseFloat {
          0% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
          100% { transform: translateY(0); }
        }

        .pulse-btn:hover,
        .fusion-btn:hover {
          animation: pulseFloat 1.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}