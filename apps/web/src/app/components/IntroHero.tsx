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
  const genieScale = 0.4 + scrollProgress * 0.6; // Genie grows from 40% to 100%
  const genieOpacity = 0.5 + scrollProgress * 0.5; // Fades in
  const titleSize = 3 - scrollProgress * 1.2; // Title shrinks more
  const titleOpacity = 1.3 - scrollProgress * 0.8; // Title fades
  const ctaOpacity = Math.max(0, (scrollProgress - 0.75) * 4);
  const ctaY = 30 - Math.max(0, (scrollProgress - 0.75) * 4) * 30;

  // Eyelid animation - opens from 0% to 100%
  const eyelidOpen = scrollProgress; // 0 = closed, 1 = fully open

  // Mouth animation - opens gradually
  const mouthOpenness = scrollProgress;

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

          {/* Genie Character */}
          <div
            className="relative z-10"
            style={{
              transform: `scale(${genieScale})`,
              opacity: genieOpacity,
              transition: "transform 0.2s ease-out, opacity 0.2s ease-out",
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 508.94 792.31" width="450" height="700" className="drop-shadow-2xl">
              <defs>
                <linearGradient id="linear-gradient" x1="583.55" y1="271.94" x2="523.7" y2="495.31" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#5ad6ff"/>
                  <stop offset="0.09" stopColor="#52cfff"/>
                  <stop offset="0.3" stopColor="#43c4ff"/>
                  <stop offset="0.48" stopColor="#3ec0ff"/>
                  <stop offset="0.63" stopColor="#38aafd"/>
                  <stop offset="1" stopColor="#2976fa"/>
                </linearGradient>
                <linearGradient id="linear-gradient-2" x1="53.82" y1="352.51" x2="190.01" y2="418.93" gradientUnits="userSpaceOnUse">
                  <stop offset="0.37" stopColor="#3ec0ff"/>
                  <stop offset="0.99" stopColor="#003ca8"/>
                </linearGradient>
                <linearGradient id="linear-gradient-3" x1="454.17" y1="204.76" x2="262.95" y2="730.14" gradientUnits="userSpaceOnUse">
                  <stop offset="0.33" stopColor="#3ec0ff"/>
                  <stop offset="0.4" stopColor="#37b5fd"/>
                  <stop offset="0.52" stopColor="#2fa8fb"/>
                  <stop offset="0.68" stopColor="#2aa0fa"/>
                  <stop offset="1" stopColor="#299efa"/>
                </linearGradient>
                <linearGradient id="linear-gradient-4" x1="380.75" y1="199.98" x2="524.76" y2="283.13" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#6ad7fd"/>
                  <stop offset="0.33" stopColor="#67d5fd"/>
                  <stop offset="0.61" stopColor="#5dd0fe"/>
                  <stop offset="0.86" stopColor="#4bc7fe"/>
                  <stop offset="1" stopColor="#3ec0ff"/>
                </linearGradient>
              </defs>

              {/* Ears */}
              <g id="ears">
                <path fill="url(#linear-gradient)" d="M432.6,303.35s29.32-49.44,47-65,23.3-16.24,25.77-15.18,6.7,4.94,0,34.94-9.88,36-12,79.06-1.77,61.41-13.41,77.65-32.83,32.12-32.83,32.12l-31.41-87.18Z"/>
                <path fill="url(#linear-gradient-2)" d="M76.34,303.35s-29.32-49.44-47-65-23.29-16.24-25.76-15.18-6.71,4.94,0,34.94,9.88,36,12,79.06,1.76,61.41,13.41,77.65,32.82,32.12,32.82,32.12l31.42-87.18Z"/>
              </g>

              {/* Shadow in ears */}
              <g id="shadow_in_ears">
                <path fill="#1b81fc" d="M438.27,370.91s0-.32.14-.92c.87-5.71,6-36.7,15.39-52.2,10.41-17.12,15-22.94,15-22.94s-12.35,24.35-15.27,45.17-4.47,29.94-3.61,40.95-1.77,14.11-1.77,14.11l-8.82-11.83Z"/>
              </g>

              {/* Face */}
              <g id="FACE">
                <path fill="url(#linear-gradient-3)" d="M75.33,334.02S57.92,124.61,253.68,126.5s179.3,207.52,179.3,207.52-1.18,13.65,11.76,42.36,19.76,72.47,22.12,88.47,16.94,92.47-37.65,155.76-176,78.36-176,78.36l-94.12-25.89s-61.76-24.23-87.17-61.64-28.94-68.47-32.12-88.24,2.12-59.29,5.65-76.23,6.7-40.24,17.29-68.47,12.35-26.83,12.71-32.83a93.61,93.61,0,0,0-.1-11.65Z"/>
              </g>

              {/* Nose */}
              <g id="nose">
                <path fill="#1871f9" d="M278.88,379.49a38.57,38.57,0,1,1-52.43,0,45.49,45.49,0,1,0,52.43,0Z"/>
              </g>

              {/* Mouth - animates opening */}
              <g id="mouth" style={{
                transform: `translateY(${mouthOpenness * 8}px)`,
                transition: 'transform 0.15s ease-out'
              }}>
                <path 
                  fill="#061c97" 
                  d={`M129.92,${445.08 + mouthOpenness * 8}c24,13.2,67.4,32.54,122.74,33.18,15.6.18,39.32.27,67.84-8.47,0,0,11.4-3.49,63.3-26.82h0s4.47-1.65,6.82,4c3.95,9.47-4.7,25.64-4.7,25.64-20.7,37.8-45.42,55.53-45.42,55.53-10.44,7.5-40.4,28.36-84.47,28.88-6.19.07-52.8-.06-92.8-32.82-9.77-8-19-17.27-33.08-38.88-6.59-10.12-12.7-23.77-13.88-34.35-.13-1.15-.36-3.55,1.07-5.25,1.91-3.7,10.18-1.05,11.38-.65Z`}
                  style={{ transition: 'd 0.15s ease-out' }}
                />
              </g>

              {/* Tongue - shows when mouth opens */}
              <g id="tongue" style={{
                opacity: Math.max(0, (scrollProgress - 0.3) * 2),
                transition: 'opacity 0.2s ease-out'
              }}>
                <path fill="#ce37b0" d="M161.57,522.82s26.93-22.68,50.93-21.27a89.21,89.21,0,0,1,41.41,13.42c6.48-4.61,23-14.93,44.24-13.48,17.1,1.17,31,9.53,32.47,10.42,0,0,1.1.67,16.31,10.91h0s-38.2,36.26-93,34.2-93.36-34.2-93.36-34.2Z"/>
              </g>

              {/* Cap */}
              <g id="cap">
                <path fill="#061c97" d="M231.33,127.26a22.88,22.88,0,0,1,8-14.87c5.74-4.62,12.09-4.67,15.76-4.7,4,0,11.1-.1,16.94,5.17s6.69,12.71,6.83,14.7c-7.81-.64-16.22-1-25.18-1-7.94-.04-15.41.24-22.4.74Z"/>
                <path fill="#061c97" d="M246.32,108.73a76.23,76.23,0,0,0-15-29.88,56,56,0,0,0-16.28-14.08c-4.69-2.62-10.54-4.19-21-5.69-22.23-3.17-33.88-3.88-44.82-12.7s-14.12-15.18-14.12-15.18,14.83,2.47,26.12-3.88,34.24-29.3,61.06-27.18,39.88,10.94,46.94,24.71c12,23.46,7.59,47.84,6,54.7a87.3,87.3,0,0,1-12.47,28.75,42.88,42.88,0,0,0-7.67-.57,42.09,42.09,0,0,0-8.75,1.04Z"/>
              </g>

              {/* Shadows */}
              <g id="shadows">
                <path fill="#25a1ff" d="M396.13,340.91s-1,44.82-42.7,55.59-60-9.71-64.45-15,1.42-6.87,1.42-6.87,8.75,9.2,17.35,12.33,16.08,5.88,34.47,4.53,32.88-17,35-19.83,7.92-10.61,9.25-18.12a110.68,110.68,0,0,0,1.54-14.07Z"/>
                <path fill="url(#linear-gradient-4)" d="M301.11,133.2a109.56,109.56,0,0,1,9.75,13.41c4.23,7.06-1.41,7.41,8.47,17.65s13.08,11.65,15.71,17.29,5.82,6.71,12.88,10.59,3.17,2.83,7.76,7.06,25.15,13.41,32.34,25.06,13.9,8.82,19.9,14.12,4.23,10.94,7.76,13.41,8.05,0,8.05,0-12.64-48-39.11-73.41-39.88-22.24-48.34-25.71-34.14-11.1-34.14-11.1Z"/>
                <path fill="#00127f" d="M170.64,55.55s12.28-7.41,25.51-7.41,30.18,5.83,38.12,15,8,33.6,8,33.6-9.42-20.64-20-27.12-8.41-7.4-20.85-9.33-16.69-2.49-19.9-3-10.88-1.74-10.88-1.74Z"/>
              </g>

              {/* Beard */}
              <g id="beard">
                <path fill="#1b7ff9" d="M204.5,575.44s28.23,10.35,49.41,9.88,52.48-9.88,52.48-9.88-16.52,24.7-51.79,25.41-50.1-25.41-50.1-25.41Z"/>
                <path fill="#061c97" d="M146,423.67s-19.41-12.36-37-11-39.59,21.65-50.89,64-4.23,101.95-4.23,101.95,11,30.93,29.7,46.94,30.82,29.06,64.54,42.71,52.42,22.21,60.72,28.91,21,19.59,22.59,37.06-3.36,25.24-13.77,23.82-9.35-23.82-9.35-23.82-15.18,11.12-9.35,34.41,30.7,23.65,34.05,23.65,33-2.47,39.71-33.18,9.11-45.66,22.24-58.76,39.44-21.42,39.44-21.42,38.46-12.32,60.3-28.91,29.72-24.68,42.19-39.06,20.3-36,20.3-36,2.53-53.63,0-73.52-14-53.42-28.12-71.42-30.88-18.23-38.47-17.41-31.41,11.41-31.41,11.41,30-2.47,40.59,1.77,14.47,8.82,21.53,21.18,20.65,55.76,15,96.17-31.94,67.94-48,77.3-39.53,26.64-80.65,32.64-81.53,6.36-114.18-.88-76.41-24.7-97.94-54-25.23-60-24.35-77.47,1.59-41.12,7.77-56.65,14.29-27.35,19.94-32.64,13.86-8.3,17.25-8.3,1.76-1.18,1.76-1.18Z"/>
              </g>

              {/* Eyes - animated to open with scroll */}
              <g id="eyes">
                {/* Left eye outer */}
                <ellipse fill="#6bfcff" cx="177" cy="341.7" rx="55.5" ry="50.56"/>
                {/* Right eye outer */}
                <ellipse fill="#6bfcff" cx="332.52" cy="341.7" rx="55.5" ry="50.56"/>
                
                {/* Left pupil - always visible */}
                <ellipse fill="#0d2bb7" cx="182.25" cy="344.17" rx="26.16" ry="32.03"/>
                <circle fill="#6bfcff" cx="190.15" cy="343.46" r="6.97"/>

                {/* Right pupil - always visible */}
                <ellipse fill="#0d2bb7" cx="327.27" cy="344.17" rx="26.16" ry="32.03"/>
                <circle fill="#6bfcff" cx="335.25" cy="344.17" r="6.97"/>

                {/* Eyelids shadow */}
                <path fill="#0723a3" d="M113.39,334.08v6.83s34.76-6.6,55.23-6.83,30.53.65,39.53,2.42,27.41,6,27.41,6l-.41-8.42s-27.88-12-60.88-10.63-30.52,2.27-37.87,4-23.01,6.63-23.01,6.63Z"/>
                <path fill="#0723a3" d="M396.13,334.08v6.83s-34.76-6.6-55.23-6.83-30.53.65-39.53,2.42-27.41,6-27.41,6l.42-8.42s27.87-12,60.87-10.63,30.52,2.27,37.87,4,23.01,6.63,23.01,6.63Z"/>

                {/* Upper eyelids - animate to reveal eyes */}
                <g style={{
                  transform: `translateY(${(1 - eyelidOpen) * 50}px)`,
                  transition: 'transform 0.2s ease-out'
                }}>
                  <path fill="#1e9dfa" d="M335.25,323.45a178.45,178.45,0,0,0-60.87,10.63,68.13,68.13,0,0,1-.42-7.47c0-35.8,27.44-64.82,61.29-64.82s61.3,29,61.3,64.82a68.13,68.13,0,0,1-.42,7.47,178.46,178.46,0,0,0-60.88-10.63Z"/>
                  <path fill="#1e9dfa" d="M174.27,323.45a178.5,178.5,0,0,1,60.88,10.63,70.72,70.72,0,0,0,.41-7.47c0-35.8-27.44-64.82-61.29-64.82s-61.29,29-61.29,64.82a70.72,70.72,0,0,0,.41,7.47,178.5,178.5,0,0,1,60.88-10.63Z"/>
                </g>
              </g>

              {/* Eyebrows */}
              <g id="eye_brow">
                <path fill="#061c97" d="M98.74,267.32s-6.12-6.24-.94-18,22-38.47,49.29-44.71,52.24.12,61.41,5.06,25.89,18.12,22,30.94-14.58,9.06-14.58,9.06-21.89-12-47.42-11.29-33.76,4.94-42.94,10.59-18.47,17.05-21.88,18.35-4.94,0-4.94,0Z"/>
                <path fill="#061c97" d="M410.5,267.32s6.12-6.24.95-18-22-38.47-49.3-44.71-52.23.12-61.41,5.06-25.88,18.12-22,30.94,14.59,9.06,14.59,9.06,21.88-12,47.41-11.29,33.76,4.94,42.94,10.59,18.47,17.05,21.88,18.35,4.94,0,4.94,0Z"/>
              </g>
            </svg>
          </div>

          {/* CTA Button */}
          <button
            onClick={handleGetStarted}
            className="absolute bottom-20 rounded-full px-10 py-4 text-lg shadow-xl fusion-btn z-20"
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