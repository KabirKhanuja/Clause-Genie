"use client";

import { useEffect, useRef, useState } from 'react';

export default function IntroHero() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showNextPage, setShowNextPage] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      // Calculate progress based on how much of the 300vh has been scrolled
      const totalScrollHeight = containerRef.current.scrollHeight - windowHeight;
      const progress = Math.min(Math.max(window.scrollY / totalScrollHeight, 0), 1);
      
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Animation calculations
  const eyeScale = 0.3 + (scrollProgress * 0.7); // Eyes grow from 30% to 100%
  const mouthHeight = scrollProgress * 50; // Mouth opens
  const genieY = -20 + (scrollProgress * 20); // Genie rises up
  const genieOpacity = 0.3 + (scrollProgress * 0.7);
  const titleSize = 3 - (scrollProgress * 0.8); // Title shrinks
  const ctaOpacity = Math.max(0, (scrollProgress - 0.75) * 4);
  const ctaY = 30 - (Math.max(0, (scrollProgress - 0.75) * 4) * 30);

  const handleGetStarted = () => {
    setShowNextPage(true);
  };

  if (showNextPage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white">
        <nav className="flex justify-between items-center p-6 max-w-7xl mx-auto">
          <div className="text-xl font-bold">Clause Genie</div>
          <div className="flex gap-8">
            <a href="#" className="hover:text-blue-400 transition-colors">Home</a>
            <a href="#" className="hover:text-blue-400 transition-colors">Upload</a>
            <a href="#" className="hover:text-blue-400 transition-colors">Document</a>
            <a href="#" className="hover:text-blue-400 transition-colors">Genie</a>
          </div>
        </nav>
        
        <div className="container mx-auto px-6 py-20 max-w-7xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-6xl font-bold mb-6 leading-tight">
                Wanna understand and break down your complex documents? <span className="text-blue-400">Ask Genie</span>
              </h1>
              <p className="text-gray-300 text-lg mb-8">
                Upload contracts, policies or reports and get clause-level insights, visual diagrams and contextual answers — all in one ephemeral session.
              </p>
              <div className="flex gap-6 text-sm">
                <div>
                  <div className="text-gray-400">Average parse</div>
                  <div className="text-2xl font-bold">~3s</div>
                </div>
                <div>
                  <div className="text-gray-400">Languages</div>
                  <div className="text-2xl font-bold">Multi</div>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="bg-blue-500/10 backdrop-blur-sm rounded-3xl p-8 border border-blue-500/20">
                <div className="mb-6">
                  <h3 className="font-semibold mb-2">Quick summary</h3>
                  <p className="text-sm text-gray-300">Upload a doc → Ask the Genie → Get clause-level answers</p>
                </div>
                <div className="text-7xl mb-4">🧞‍♂️</div>
                <p className="text-sm text-gray-400">
                  Tip: Try "Does this policy cover theft?" after uploading.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ height: '300vh' }} className="relative">
      <section 
        className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%)'
        }}
      >
        {/* Title */}
        <div 
          className="absolute top-20 text-center"
          style={{
            fontSize: `${titleSize}rem`,
            transition: 'font-size 0.1s ease-out',
            opacity: 1.2 - scrollProgress
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
            transition: 'transform 0.1s ease-out, opacity 0.1s ease-out'
          }}
        >
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
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            {/* Tail (smoke effect at bottom) */}
            <g>
              <ellipse cx="200" cy="440" rx="50" ry="15" fill="url(#tailGradient)" opacity="0.6"/>
              <path 
                d="M 200 430 Q 180 410, 185 380 Q 190 350, 200 340" 
                fill="url(#tailGradient)" 
                opacity="0.7"
              />
              <path 
                d="M 200 430 Q 220 410, 215 380 Q 210 350, 200 340" 
                fill="url(#tailGradient)" 
                opacity="0.7"
              />
            </g>

            {/* Body (main head) */}
            <ellipse cx="200" cy="220" rx="120" ry="140" fill="url(#bodyGradient)" filter="url(#glow)"/>

            {/* Ears */}
            <ellipse cx="100" cy="200" rx="35" ry="55" fill="#4eb8ff" opacity="0.8" 
              transform="rotate(-15 100 200)"/>
            <ellipse cx="300" cy="200" rx="35" ry="55" fill="#4eb8ff" opacity="0.8" 
              transform="rotate(15 300 200)"/>

            {/* Face shadow */}
            <ellipse cx="200" cy="230" rx="100" ry="120" fill="#3b9eff" opacity="0.3"/>

            {/* Eyebrows */}
            <path d="M 150 160 Q 170 150, 190 155" stroke="#0d2d5e" strokeWidth="8" 
              fill="none" strokeLinecap="round"/>
            <path d="M 210 155 Q 230 150, 250 160" stroke="#0d2d5e" strokeWidth="8" 
              fill="none" strokeLinecap="round"/>

            {/* Eyes (scale based on scroll) */}
            <g transform={`translate(170, 190) scale(${eyeScale})`} 
               style={{ transformOrigin: '0 0', transition: 'transform 0.1s ease-out' }}>
              {/* Left Eye */}
              <ellipse cx="0" cy="0" rx="25" ry="30" fill="#b3f0ff"/>
              <ellipse cx="0" cy="0" rx="20" ry="25" fill="#ffffff"/>
              <circle cx="0" cy="0" r="12" fill="#0d2d5e"/>
              <circle cx="3" cy="-3" r="5" fill="#ffffff" opacity="0.8"/>
            </g>

            <g transform={`translate(230, 190) scale(${eyeScale})`} 
               style={{ transformOrigin: '0 0', transition: 'transform 0.1s ease-out' }}>
              {/* Right Eye */}
              <ellipse cx="0" cy="0" rx="25" ry="30" fill="#b3f0ff"/>
              <ellipse cx="0" cy="0" rx="20" ry="25" fill="#ffffff"/>
              <circle cx="0" cy="0" r="12" fill="#0d2d5e"/>
              <circle cx="3" cy="-3" r="5" fill="#ffffff" opacity="0.8"/>
            </g>

            {/* Nose */}
            <ellipse cx="200" cy="220" rx="15" ry="20" fill="#3b9eff" opacity="0.6"/>

            {/* Mouth - opens with scroll */}
            <g style={{ transition: 'all 0.1s ease-out' }}>
              <path 
                d={`M 160 260 Q 200 ${260 + mouthHeight}, 240 260`}
                stroke="#0d2d5e" 
                strokeWidth="6" 
                fill="none" 
                strokeLinecap="round"
              />
              {mouthHeight > 20 && (
                <>
                  <ellipse 
                    cx="200" 
                    cy={270 + mouthHeight * 0.4} 
                    rx="35" 
                    ry={mouthHeight * 0.6} 
                    fill="#0d2d5e" 
                    opacity="0.8"
                  />
                  <ellipse 
                    cx="200" 
                    cy={275 + mouthHeight * 0.3} 
                    rx="25" 
                    ry={mouthHeight * 0.4} 
                    fill="#ff69b4" 
                    opacity="0.7"
                  />
                </>
              )}
            </g>

            {/* Hair/Top knot */}
            <g>
              <path 
                d="M 200 80 Q 180 60, 190 40 Q 200 20, 210 40 Q 220 60, 200 80" 
                fill="#0d2d5e" 
                opacity="0.9"
              />
              <ellipse cx="200" cy="85" rx="15" ry="10" fill="#0d2d5e" opacity="0.9"/>
            </g>

            {/* Chin beard shadow */}
            <path 
              d="M 150 310 Q 200 330, 250 310" 
              fill="url(#tailGradient)" 
              opacity="0.4"
            />
          </svg>
        </div>

        {/* CTA Button */}
        <button
          onClick={handleGetStarted}
          className="absolute bottom-20 rounded-full px-8 py-4 text-lg font-bold text-white shadow-2xl hover:scale-105 transition-transform"
          style={{
            background: 'linear-gradient(90deg, #13a4ec, #8a2be2)',
            opacity: ctaOpacity,
            transform: `translateY(${ctaY}px)`,
            pointerEvents: ctaOpacity > 0.5 ? 'auto' : 'none',
            transition: 'opacity 0.2s ease-out'
          }}
        >
          Get started
        </button>

        {/* Scroll indicator */}
        {scrollProgress < 0.8 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-gray-500 text-sm animate-bounce">
            ↓ Scroll to wake the genie
          </div>
        )}
      </section>
    </div>
  );
}