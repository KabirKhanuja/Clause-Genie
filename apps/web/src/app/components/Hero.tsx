'use client';
import AnimatedBg from './AnimatedBg';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const DOMAINS = ['Insurance','Law','Government','More'];

export default function Hero() {
  const [picked, setPicked] = useState<string | null>(null);
  const router = useRouter();

  return (
    <section
      className="relative overflow-hidden bg-transparent min-h-[72vh] md:min-h-screen flex items-center"
      aria-label="Hero"
    >
      {/* animated background (behind content) */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <AnimatedBg />
        <div
          aria-hidden
          className="blob"
          style={{
            width: 360,
            height: 360,
            left: '6%',
            top: '8%',
            background:
              'radial-gradient(circle at 30% 30%, rgba(19,164,236,0.85), rgba(138,43,226,0.35))',
            animation: 'blob 12s ease-in-out infinite',
            zIndex: 0
          }}
        />
        <div
          aria-hidden
          className="blob"
          style={{
            width: 300,
            height: 300,
            right: '4%',
            bottom: '12%',
            background:
              'radial-gradient(circle at 70% 70%, rgba(0,242,234,0.6), rgba(138,43,226,0.28))',
            animation: 'blob 16s ease-in-out infinite',
            zIndex: 0
          }}
        />
      </div>

      {/* content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-8 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="pt-8 md:pt-0">
            <h1 className="text-white text-4xl md:text-6xl lg:text-7xl font-extrabold leading-tight">
              Wanna understand and break down your complex documents?{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#13a4ec] to-[#8a2be2]">Ask Genie ✨</span>
            </h1>

            <p className="mt-6 text-slate-300 max-w-xl text-lg">
              Upload contracts, policies or reports and get clause-level insights, visual diagrams and contextual answers — all in one ephemeral session.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {DOMAINS.map((d) => (
                <button
                  key={d}
                  onClick={() => setPicked(d)}
                  className={`domain-btn px-4 py-3 text-white font-medium ${picked === d ? 'ring-2 ring-offset-2 ring-[#13a4ec]/40 scale-105' : ''}`}
                >
                  {d}
                </button>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-4">
              <button
                onClick={() => router.push('/upload')}
                className="glow-btn px-5 py-3 rounded-full font-semibold text-black"
              >
                Upload Document
              </button>
              <span className="text-sm text-slate-400">Try demo documents • Session-only</span>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="flex items-center justify-center relative">
            <div className="w-full max-w-md relative">
                {/* Genie image ABOVE the card */}
                <img
                  alt="genie"
                  src="/images/genie-illustration.png"
                  className="absolute right-[-20px] top-[-140px] md:top-[-180px] w-48 md:w-64 opacity-95 drop-shadow-[0_30px_60px_rgba(0,0,0,0.6)] pointer-events-none animate-float"
                  style={{ zIndex: 10 }}
                />

                {/* Quick summary CARD */}
                <div className="panel p-6 rounded-2xl mt-32 md:mt-44" style={{ position: 'relative' }}>
                <h4 className="text-slate-300 text-sm mb-3">Quick summary</h4>
                <div className="text-white font-semibold text-lg">
                  Upload a doc → Ask the Genie → Get clause-level answers
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-[#061026]/50">
                    <div className="text-slate-300 text-xs">Average parse</div>
                    <div className="text-white font-bold">~3s</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#061026]/50">
                    <div className="text-slate-300 text-xs">Languages</div>
                    <div className="text-white font-bold">Multi</div>
                  </div>
                </div>

                <div className="mt-4 text-slate-400 text-sm">
                  Tip: Try “Does this policy cover theft?” after uploading.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* component-scoped styles moved from globals.css (card-glow, panel, domain-btn, glow-btn, blob + keyframes) */}
      <style jsx>{`
        .panel {
          border: 1px solid rgba(255,255,255,0.04);
          background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
          transition: transform .28s ease, box-shadow .28s ease;
          will-change: transform;
        }

        /* float animation when hovering the quick summary card */
        .panel:hover {
          animation: float 2.6s ease-in-out infinite;
          box-shadow: 0 20px 60px rgba(13,20,40,0.7), 0 0 40px rgba(19,164,236,0.06);
        }

        .card-glow {
          transition: transform .28s ease, box-shadow .28s ease;
          box-shadow: 0 6px 24px rgba(2,6,23,0.6), 0 0 0 1px rgba(255,255,255,0.02) inset;
          backdrop-filter: blur(8px);
        }
        .card-glow:hover {
          transform: translateY(-6px);
          box-shadow: 0 18px 48px rgba(13,20,40,0.7), 0 0 40px rgba(19,164,236,0.06);
        }

        .glow-btn {
          background: linear-gradient(90deg, var(--genie-1), var(--genie-2));
          box-shadow: 0 8px 30px rgba(19,164,236,0.12);
          transition: transform .18s ease, box-shadow .18s ease;
        }
        .glow-btn:hover { transform: translateY(-3px) scale(1.01); box-shadow: 0 20px 60px rgba(19,164,236,0.18); }

        .domain-btn {
          transition: transform .18s cubic-bezier(.2,.9,.3,1), box-shadow .18s ease;
          border-radius: 12px;
          background: rgba(7,12,18,0.55);
          border: 1px solid rgba(255,255,255,0.03);
        }
        .domain-btn:hover {
          transform: translateY(-6px);
          box-shadow: 0 12px 40px rgba(19,164,236,0.06);
        }

        .blob {
          position: absolute;
          filter: blur(40px) saturate(120%);
          opacity: .85;
          transform-origin: center;
          mix-blend-mode: screen;
          pointer-events: none;
        }

        @keyframes blob {
          0% { transform: translate(0px,0px) scale(1); }
          33% { transform: translate(-20px, 10px) scale(1.05); }
          66% { transform: translate(15px,-10px) scale(0.95); }
          100% { transform: translate(0px,0px) scale(1); }
        }

        @keyframes float {
          0% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
          100% { transform: translateY(0); }
        }

        /* keep the hero z-index rule scoped to this component */
        section[aria-label="Hero"] > .z-10 { z-index: 10; position: relative; }
        /* keep responsive small tweaks that were in globals for hero */
        @media (max-width: 768px) {
          .blob { opacity: 0.6; filter: blur(30px); }
          .panel { padding: 14px; }
        }
      `}</style>
    </section>
  );
}