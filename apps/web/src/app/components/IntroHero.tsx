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

  // video refs + state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const durationRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const currentTimeRef = useRef<number>(0); // smoothly lerped currentTime
  const targetTimeRef = useRef<number>(0);  // target time from scroll

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const windowHeight = window.innerHeight;
      const totalScrollHeight = containerRef.current.scrollHeight - windowHeight;
      const progress =
        totalScrollHeight > 0
          ? Math.min(Math.max(window.scrollY / totalScrollHeight, 0), 1)
          : 0;
      setScrollProgress(progress);
    };

    // Lenis will dispatch scroll events with smooth interpolated values
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

  // When video metadata loads, capture duration
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onLoadedMeta = () => {
      durationRef.current = isFinite(v.duration) ? v.duration : 0;
      // keep paused (we will scrub by setting currentTime)
      try {
        v.pause();
      } catch (e) {
        /* no-op */
      }
    };

    v.addEventListener("loadedmetadata", onLoadedMeta);
    // If metadata was already present:
    if (v.readyState >= 1 && v.duration) {
      onLoadedMeta();
    }

    return () => {
      v.removeEventListener("loadedmetadata", onLoadedMeta);
    };
  }, []);

  // Smoothly interpolate video.currentTime - lighter lerp since Lenis already smooths scroll
  useEffect(() => {
    const tick = () => {
      const v = videoRef.current;
      const dur = durationRef.current || 0;
      if (v && dur > 0) {
        // map scrollProgress to target time
        const target = Math.max(0, Math.min(scrollProgress * dur, dur));
        targetTimeRef.current = target;

        // lighter lerp since Lenis provides smooth scroll values
        const distance = Math.abs(target - currentTimeRef.current);
        const lerpFactor = distance > 0.5 ? 0.3 : 0.25;
        
        currentTimeRef.current += (target - currentTimeRef.current) * lerpFactor;

        // set video.currentTime to the smoothed value
        const smoothed = currentTimeRef.current;
        if (Math.abs((v.currentTime || 0) - smoothed) > 0.003) {
          try {
            v.currentTime = smoothed;
          } catch (e) {
            // ignore if metadata not ready
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    // start the rAF loop
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [scrollProgress]);

  // Animation calculations
  const genieScale = 0.4 + scrollProgress * 0.6; // Genie grows from 40% to 100%
  const genieOpacity = 0.5 + scrollProgress * 0.5; // Fades in
  const titleSize = 3 - scrollProgress * 1.2; // Title shrinks more
  const titleOpacity = 1.3 - scrollProgress * 0.8; // Title fades
  const ctaOpacity = Math.max(0, (scrollProgress - 0.75) * 4);
  const ctaY = 30 - Math.max(0, (scrollProgress - 0.75) * 4) * 30;

  // Eye + mouth derived from scrollProgress (still used visually)
  const eyeScale = 0.1 + scrollProgress * 0.9;
  const mouthOpenness = scrollProgress;

  const handleGetStarted = () => {
    const tl = gsap.timeline({
      defaults: { ease: "power3.inOut" },
      onComplete: () => {
        // call parent callback to reveal main site
        onStart();
        // ensure we're at top
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
            className="absolute top-20 text-center z-20"
            style={{
              fontSize: `${titleSize}rem`,
              transition: "font-size 0.1s ease-out, opacity 0.1s ease-out",
              opacity: titleOpacity,
            }}
          >
            <h1 className="font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
              CLAUSE GENIE
            </h1>
          </div>

          {/* VIDEO: full-bleed container (position absolute to sticky section) */}
          <div className="video-bleed" aria-hidden={false} style={{ opacity: genieOpacity }}>
            <video
              ref={videoRef}
              src="/videos/genie-intro.mp4"
              preload="auto"
              playsInline
              muted
              // playback is controlled by currentTime
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                background: "#000",
              }}
              aria-label="Genie intro animation"
            />
          </div>
          {/* /VIDEO: full-bleed */}

          {/* CTA Button */}
          <button
            onClick={handleGetStarted}
            className="absolute bottom-20 rounded-full px-10 py-4 text-lg shadow-xl fusion-btn z-20"
            style={{
              opacity: ctaOpacity,
              transform: `translateY(${ctaY}px)`,
              transition: "opacity 0.6s ease-out, transform 0.4s ease-out",
              pointerEvents: ctaOpacity > 0.5 ? "auto" : "none",
            }}
            aria-hidden={ctaOpacity <= 0.5}
            aria-label="Get started"
          >
            Get Started
          </button>

          {scrollProgress < 0.8 && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-gray-500 text-sm animate-bounce z-20">
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

        @keyframes pulseFloat {
          0% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
          100% {
            transform: translateY(0);
          }
        }

        .pulse-btn:hover,
        .fusion-btn:hover {
          animation: pulseFloat 1.2s ease-in-out infinite;
        }

        /* full-bleed video wrapper */
        .video-bleed {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: block;
          overflow: hidden;
          z-index: 8;
          pointer-events: none;
          background: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.06),
            rgba(0, 0, 0, 0.06)
          );
          transition: opacity 0.25s ease-out;
        }

        .video-bleed > video {
          pointer-events: none;
          will-change: transform;
        }
      `}</style>
    </div>
  );
}