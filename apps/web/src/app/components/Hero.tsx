'use client';
import AnimatedBg from './AnimatedBg';
import { useState } from 'react';

const DOMAINS = ['Insurance','Law','Government','More'];

export default function Hero() {
  const [picked, setPicked] = useState<string | null>(null);

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
              <button className="glow-btn px-5 py-3 rounded-full font-semibold text-black">Upload Document</button>
              <span className="text-sm text-slate-400">Try demo documents • Session-only</span>
            </div>
          </div>

          <div className="flex items-center justify-center relative">
            <div className="w-full max-w-md">
              <div className="panel p-6 rounded-2xl card-glow">
                <h4 className="text-slate-300 text-sm mb-3">Quick summary</h4>
                <div className="text-white font-semibold text-lg">Upload a doc → Ask the Genie → Get clause-level answers</div>

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

                <div className="mt-4 text-slate-400 text-sm">Tip: Try “Does this policy cover theft?” after uploading.</div>
              </div>

              {/* Genie image positioned absolutely within this column (safe bounds) */}
              <img
                alt="genie"
                src="/images/genie-illustration.png"
                className="absolute right-[-16px] top-[-40px] w-44 md:w-56 opacity-95 drop-shadow-[0_30px_60px_rgba(0,0,0,0.6)] pointer-events-none"
                style={{ zIndex: 5 }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}